import type { Category, Product, ProductVariant, Store } from "@/types";
import { getStoreBySlug as getFallbackStoreBySlug, stores as fallbackStores } from "@/data/stores";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";
import type { ProductOptionGroup } from "@/types";
import {
  disableUnavailableTransportAgencySettings,
  mapStoreDeliverySettings,
} from "@/lib/delivery";
import { getStoreOpenState } from "@/lib/business-hours";
import { getEntrega2AppBrand, loadTransportAgencyDeliverySettings } from "@/lib/transport";
import { normalizePublicBrandText } from "@/lib/brand-copy";
import { isSubscriptionPastDue } from "@/lib/subscription-status";

type AnyRecord = Record<string, any>;

const defaultPaymentMethods = ["Pago móvil", "Transferencia", "Efectivo", "Binance"];

const fallbackHeroImages: Record<string, string> = {
  "don-aniello": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1400&q=80",
  "china-twon": "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1400&q=80",
  "bizcochos-ascoli": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1400&q=80",
};

function allowDemoFallbacks() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ALLOW_DEMO_FALLBACKS === "true"
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringArray(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) {
    const clean = value.map((item) => String(item).trim()).filter(Boolean);
    return clean.length ? clean : fallback;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const clean = parsed.map((item) => String(item).trim()).filter(Boolean);
        return clean.length ? clean : fallback;
      }
    } catch {
      const clean = value.split(",").map((item) => item.trim()).filter(Boolean);
      return clean.length ? clean : fallback;
    }
  }

  return fallback;
}

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export function isStoreSubscriptionPastDue(row: AnyRecord) {
  return isSubscriptionPastDue(row);
}

function mapVariant(row: AnyRecord, productPriceUsd: number, discountPercent = 0): ProductVariant {
  const originalVariantPrice = toNumber(row.price_usd, productPriceUsd);
  const variantPrice = discountPercent > 0
    ? Number((originalVariantPrice * (1 - discountPercent / 100)).toFixed(2))
    : originalVariantPrice;

  return {
    id: String(row.id),
    name: row.name || "Presentación",
    priceDeltaUsd: Math.max(0, variantPrice - productPriceUsd),
    originalPriceUsd: originalVariantPrice,
    isAvailable: row.is_available !== false,
  };
}

export function mapOptionGroups(product: AnyRecord): ProductOptionGroup[] {
  const assignmentsRaw: AnyRecord[] = Array.isArray(product.product_option_group_products)
    ? product.product_option_group_products
    : [];

  return assignmentsRaw
    .sort((a, b) => toNumber(a.sort_order) - toNumber(b.sort_order))
    .map((assignment) => assignment.product_option_groups)
    .filter((group) => group && group.is_active !== false)
    .sort((a, b) => toNumber(a.sort_order) - toNumber(b.sort_order))
    .map((group) => {
      const valuesRaw: AnyRecord[] = Array.isArray(group.product_option_values)
        ? group.product_option_values
        : [];
      const selectionType: ProductOptionGroup["selectionType"] =
        group.selection_type === "multiple" ? "multiple" : "single";

      return {
        id: String(group.id),
        name: group.name || "Opciones",
        description: group.description || "",
        selectionType,
        required: Boolean(group.required),
        minSelect: Math.max(0, toNumber(group.min_select, group.required ? 1 : 0)),
        maxSelect: Math.max(
          0,
          toNumber(group.max_select, selectionType === "single" ? 1 : 0)
        ),
        isActive: group.is_active !== false,
        values: valuesRaw
          .filter((value) => value.is_active !== false)
          .sort((a, b) => toNumber(a.sort_order) - toNumber(b.sort_order))
          .map((value) => {
            const variantPricesRaw: AnyRecord[] = Array.isArray(
              value.product_option_value_variant_prices
            )
              ? value.product_option_value_variant_prices
              : [];
            const variantPriceDeltas = Object.fromEntries(
              variantPricesRaw
                .map((price) => [
                  String(price.variant_id || ""),
                  toNumber(price.price_delta_usd, toNumber(value.price_delta_usd, 0)),
                ])
                .filter(([variantId]) => variantId)
            );

            return {
              id: String(value.id),
              name: value.name || "Opción",
              description: value.description || "",
              priceDeltaUsd: toNumber(value.price_delta_usd, 0),
              variantPriceDeltas,
              isActive: value.is_active !== false,
            };
          }),
      };
    })
    .filter((group) => group.values.length > 0);
}

function mapStore(
  row: AnyRecord,
  options: { includeFallbackCatalog?: boolean } = {}
): Store {
  const includeFallbackCatalog = options.includeFallbackCatalog !== false;
  const categoriesRaw: AnyRecord[] = Array.isArray(row.categories) ? row.categories : [];
  const productsRaw: AnyRecord[] = Array.isArray(row.products) ? row.products : [];

  const categories: Category[] = categoriesRaw
    .filter((category) => category.is_active !== false)
    .sort((a, b) => toNumber(a.sort_order) - toNumber(b.sort_order))
    .map((category) => ({
      id: String(category.id),
      name: category.name || "General",
      slug: slugify(category.name || "general"),
    }));

  const products: Product[] = productsRaw
    .filter((product) => product.is_available !== false)
    .sort((a, b) => toNumber(a.sort_order) - toNumber(b.sort_order))
    .map((product) => {
      const originalPriceUsd = toNumber(product.price_usd);
      const discountPercent = Math.max(0, Math.min(95, toNumber(product.discount_percent, 0)));
      const priceUsd = discountPercent > 0
        ? Number((originalPriceUsd * (1 - discountPercent / 100)).toFixed(2))
        : originalPriceUsd;
      const variantsRaw: AnyRecord[] = Array.isArray(product.product_variants)
        ? product.product_variants
        : [];
      const gallery = Array.isArray(product.product_images) ? product.product_images : [];
      const imageUrls = [product.image_url, ...gallery.sort((a: AnyRecord, b: AnyRecord) => toNumber(a.sort_order) - toNumber(b.sort_order)).map((image: AnyRecord) => image.image_url)]
        .map((url) => String(url || "").trim()).filter((url, index, urls) => Boolean(url) && urls.indexOf(url) === index).slice(0, 2);

      return {
        id: String(product.id),
        storeId: String(row.id),
        categoryId: product.category_id ? String(product.category_id) : categories[0]?.id || "general",
        name: product.name || "Producto",
        slug: `${slugify(product.name || "producto")}-${String(product.id).slice(0, 6)}`,
        description: product.description || "Producto disponible para pedir desde Somos.",
        priceUsd,
        originalPriceUsd,
        discountPercent,
        imageUrl: imageUrls[0] || row.logo_url || row.cover_image_url || fallbackHeroImages[row.slug] || fallbackHeroImages["don-aniello"],
        imageUrls,
        imageAlt: product.name || "Producto",
        imageEmoji: "?",
        isAvailable: product.is_available !== false,
        isFeatured: Boolean(product.is_featured),
        tags: [
          ...(discountPercent > 0 ? [`-${discountPercent}%`] : []),
          ...(product.is_featured ? ["Recomendado"] : []),
        ],
        variants: variantsRaw
          .filter((variant) => variant.is_available !== false)
          .sort((a, b) => toNumber(a.sort_order) - toNumber(b.sort_order))
          .map((variant) => mapVariant(variant, priceUsd, discountPercent)),
        optionGroups: mapOptionGroups(product),
        hasOptionGroups: Array.isArray(product.product_option_group_products)
          ? product.product_option_group_products.length > 0
          : false,
      };
    });

  const fallback = getFallbackStoreBySlug(row.slug);

  return {
    id: String(row.id),
    name: row.name || fallback?.name || "Comercio",
    slug: row.slug,
    category: normalizePublicBrandText(row.business_type || fallback?.category || row.description) || "Comercio aliado",
    description: normalizePublicBrandText(row.description || fallback?.description) || "Catalogo disponible en Somos.",
    whatsappPhone: row.whatsapp || fallback?.whatsappPhone || "584245666025",
    address: row.address || fallback?.address || "Maracay, Aragua",
    latitude: toNumber(row.latitude, fallback?.latitude || 0),
    longitude: toNumber(row.longitude, fallback?.longitude || 0),
    openingHours: String(row.opening_hours || "").trim().toLowerCase() === "disponible hoy"
      ? ""
      : String(row.opening_hours || "").trim(),
    deliveryEstimate: row.delivery_estimate || fallback?.deliveryEstimate || "25-40 min",
    pickupEstimate: row.pickup_estimate || fallback?.pickupEstimate || "15-25 min",
    badge: fallback?.badge || "Aliado Somos",
    heroImageUrl: row.cover_image_url || fallback?.heroImageUrl || fallbackHeroImages[row.slug] || fallbackHeroImages["don-aniello"],
    categories: categories.length ? categories : includeFallbackCatalog ? fallback?.categories || [] : [],
    products: products.length ? products : includeFallbackCatalog ? fallback?.products || [] : [],
    paymentMethods: toStringArray(row.payment_methods, fallback?.paymentMethods || defaultPaymentMethods),
    usdToBs: toNumber(row.usd_to_bs, 600),
    baseCurrency: String(row.base_currency || "USD").toUpperCase() === "EUR" ? "EUR" : "USD",
    showPricesInBs: row.show_prices_in_bs !== false,
    paymentDetails: toRecord(row.payment_details),
    logoUrl: row.logo_url || fallback?.logoUrl || "",
    coverImageUrl: row.cover_image_url || fallback?.coverImageUrl || fallback?.heroImageUrl || "",
    primaryColor: row.primary_color || fallback?.primaryColor || "#1F464C",
    accentColor: row.accent_color || fallback?.accentColor || "#F27533",
    buttonTextColor: row.button_text_color || fallback?.buttonTextColor || "#042332",
    deliverySettings: mapStoreDeliverySettings(row),
    businessHours: toRecord(row.business_hours),
    manualOpenStatus: row.manual_open_status || "auto",
    manualOpenNote: row.manual_open_note || "",
    openState: getStoreOpenState({
      manualOpenStatus: row.manual_open_status,
      manualOpenNote: row.manual_open_note,
      businessHours: toRecord(row.business_hours),
      openingHoursText: row.opening_hours,
    }),
    planType: row.plan_type || "monthly",
    serviceFeeUsd: Number(row.monthly_price_usd ?? (row.plan_type === "per_service" ? 0.1 : 0)),
    serviceFeePayer: row.service_fee_payer === "customer" ? "customer" : "merchant",
    serviceFeeBillingCycle: "monthly",
    requestCustomerIdNumber: row.request_customer_id_number === true,
    checkoutNotePlaceholder: normalizePublicBrandText(row.checkout_note_placeholder) || undefined,
  };
}

const storeSelect = `
  id,
  slug,
  name,
  description,
  address,
  latitude,
  longitude,
  whatsapp,
  cover_image_url,
  logo_url,
  primary_color,
  accent_color,
  button_text_color,
  business_type,
  opening_hours,
  business_hours,
  manual_open_status,
  manual_open_note,
  delivery_estimate,
  pickup_estimate,
  payment_methods,
  payment_details,
  usd_to_bs,
  base_currency,
  show_prices_in_bs,
  whatsapp_message_note,
  is_active,
  marketplace_visible,
  subscription_status,
  plan_type,
  monthly_price_usd,
  service_fee_payer,
  service_fee_billing_cycle,
  trial_ends_at,
  subscription_ends_at,
  next_payment_due_at,
  accepts_delivery,
  accepts_pickup,
  request_customer_id_number,
  checkout_note_placeholder,
  accepts_national_shipping,
  store_delivery_settings (
    delivery_enabled,
    pickup_enabled,
    national_shipping_enabled,
    delivery_provider,
    pricing_type,
    fixed_fee_usd,
    free_delivery_min_usd,
    delivery_promo_enabled,
    delivery_promo_min_subtotal_usd,
    delivery_promo_discount_type,
    delivery_promo_discount_value,
    max_distance_km,
    distance_factor,
    manual_quote_message
  ),
  store_delivery_zones (
    id,
    name,
    description,
    fee_usd,
    is_active,
    sort_order
  ),
  store_delivery_distance_rates (
    id,
    min_km,
    max_km,
    fee_usd,
    is_active,
    sort_order
  ),
  categories (
    id,
    name,
    sort_order,
    is_active
  ),
  products (
    id,
    store_id,
    category_id,
    name,
    description,
    price_usd,
    discount_percent,
    image_url,
    is_available,
    is_featured,
    sort_order,
    product_variants (
      id,
      name,
      price_usd,
      is_available,
      sort_order
    ),
    product_option_group_products (
      id
    )
  )
`;

const baseStoreSelect = `
  id,
  plan_type,
  monthly_price_usd,
  service_fee_payer,
  service_fee_billing_cycle,
  slug,
  name,
  description,
  address,
  latitude,
  longitude,
  whatsapp,
  cover_image_url,
  logo_url,
  primary_color,
  accent_color,
  button_text_color,
  business_type,
  opening_hours,
  delivery_estimate,
  pickup_estimate,
  payment_methods,
  usd_to_bs,
  base_currency,
  show_prices_in_bs,
  whatsapp_message_note,
  is_active,
  subscription_status,
  trial_ends_at,
  subscription_ends_at,
  next_payment_due_at,
  accepts_delivery,
  accepts_pickup,
  request_customer_id_number,
  checkout_note_placeholder,
  categories (
    id,
    name,
    sort_order,
    is_active
  ),
  products (
    id,
    store_id,
    category_id,
    name,
    description,
    price_usd,
    discount_percent,
    image_url,
    is_available,
    is_featured,
    sort_order,
    product_variants (
      id,
      name,
      price_usd,
      is_available,
      sort_order
    ),
    product_option_group_products (
      id
    )
  )
`;

const storeShellSelect = `
  id,
  is_test,
  plan_type,
  monthly_price_usd,
  service_fee_payer,
  service_fee_billing_cycle,
  slug,
  name,
  description,
  address,
  latitude,
  longitude,
  whatsapp,
  cover_image_url,
  logo_url,
  primary_color,
  accent_color,
  button_text_color,
  business_type,
  opening_hours,
  business_hours,
  manual_open_status,
  manual_open_note,
  delivery_estimate,
  pickup_estimate,
  payment_methods,
  payment_details,
  usd_to_bs,
  base_currency,
  show_prices_in_bs,
  whatsapp_message_note,
  is_active,
  subscription_status,
  trial_ends_at,
  subscription_ends_at,
  next_payment_due_at,
  accepts_delivery,
  accepts_pickup,
  request_customer_id_number,
  checkout_note_placeholder,
  accepts_national_shipping,
  store_delivery_settings (
    delivery_enabled,
    pickup_enabled,
    national_shipping_enabled,
    delivery_provider,
    pricing_type,
    fixed_fee_usd,
    free_delivery_min_usd,
    delivery_promo_enabled,
    delivery_promo_min_subtotal_usd,
    delivery_promo_discount_type,
    delivery_promo_discount_value,
    max_distance_km,
    distance_factor,
    manual_quote_message
  ),
  store_delivery_zones (
    id,
    name,
    description,
    fee_usd,
    is_active,
    sort_order
  ),
  store_delivery_distance_rates (
    id,
    min_km,
    max_km,
    fee_usd,
    is_active,
    sort_order
  )
`;

const storeShellCompatibleSelect = `
  id,
  plan_type,
  monthly_price_usd,
  service_fee_payer,
  service_fee_billing_cycle,
  slug,
  name,
  description,
  address,
  latitude,
  longitude,
  whatsapp,
  cover_image_url,
  logo_url,
  primary_color,
  accent_color,
  button_text_color,
  business_type,
  opening_hours,
  business_hours,
  manual_open_status,
  manual_open_note,
  delivery_estimate,
  pickup_estimate,
  payment_methods,
  payment_details,
  usd_to_bs,
  whatsapp_message_note,
  is_active,
  subscription_status,
  trial_ends_at,
  subscription_ends_at,
  next_payment_due_at,
  accepts_delivery,
  accepts_pickup,
  request_customer_id_number,
  checkout_note_placeholder,
  store_delivery_settings (
    delivery_enabled,
    pickup_enabled,
    delivery_provider,
    pricing_type,
    fixed_fee_usd,
    free_delivery_min_usd,
    delivery_promo_enabled,
    delivery_promo_min_subtotal_usd,
    delivery_promo_discount_type,
    delivery_promo_discount_value,
    max_distance_km,
    distance_factor,
    manual_quote_message
  ),
  store_delivery_zones (
    id,
    name,
    description,
    fee_usd,
    is_active,
    sort_order
  ),
  store_delivery_distance_rates (
    id,
    min_km,
    max_km,
    fee_usd,
    is_active,
    sort_order
  )
`;

const deliveryCompatibleStoreSelect = `
  id,
  plan_type,
  monthly_price_usd,
  service_fee_payer,
  service_fee_billing_cycle,
  slug,
  name,
  description,
  address,
  latitude,
  longitude,
  whatsapp,
  cover_image_url,
  logo_url,
  primary_color,
  accent_color,
  button_text_color,
  business_type,
  opening_hours,
  business_hours,
  manual_open_status,
  manual_open_note,
  delivery_estimate,
  pickup_estimate,
  payment_methods,
  payment_details,
  usd_to_bs,
  whatsapp_message_note,
  is_active,
  subscription_status,
  trial_ends_at,
  subscription_ends_at,
  next_payment_due_at,
  accepts_delivery,
  accepts_pickup,
  request_customer_id_number,
  checkout_note_placeholder,
  store_delivery_settings (
    delivery_enabled,
    pickup_enabled,
    delivery_provider,
    pricing_type,
    fixed_fee_usd,
    free_delivery_min_usd,
    delivery_promo_enabled,
    delivery_promo_min_subtotal_usd,
    delivery_promo_discount_type,
    delivery_promo_discount_value,
    max_distance_km,
    distance_factor,
    manual_quote_message
  ),
  store_delivery_zones (
    id,
    name,
    description,
    fee_usd,
    is_active,
    sort_order
  ),
  store_delivery_distance_rates (
    id,
    min_km,
    max_km,
    fee_usd,
    is_active,
    sort_order
  ),
  categories (
    id,
    name,
    sort_order,
    is_active
  ),
  products (
    id,
    store_id,
    category_id,
    name,
    description,
    price_usd,
    discount_percent,
    image_url,
    is_available,
    is_featured,
    sort_order,
    product_variants (
      id,
      name,
      price_usd,
      is_available,
      sort_order
    ),
    product_option_group_products (
      id
    )
  )
`;

const legacyStoreSelect = `
  id,
  plan_type,
  monthly_price_usd,
  service_fee_payer,
  service_fee_billing_cycle,
  slug,
  name,
  description,
  address,
  latitude,
  longitude,
  whatsapp,
  cover_image_url,
  logo_url,
  primary_color,
  accent_color,
  button_text_color,
  business_type,
  opening_hours,
  delivery_estimate,
  pickup_estimate,
  payment_methods,
  usd_to_bs,
  whatsapp_message_note,
  is_active,
  accepts_delivery,
  accepts_pickup,
  request_customer_id_number,
  checkout_note_placeholder,
  categories (
    id,
    name,
    sort_order,
    is_active
  ),
  products (
    id,
    store_id,
    category_id,
    name,
    description,
    price_usd,
    discount_percent,
    image_url,
    is_available,
    is_featured,
    sort_order,
    product_variants (
      id,
      name,
      price_usd,
      is_available,
      sort_order
    )
  )
`;

function withPaymentDetailsFallback(row: AnyRecord) {
  return {
    ...row,
    payment_details: row.payment_details || {},
  };
}

async function applyTransportDeliverySettings(store: Store) {
  try {
    const supabase = createSupabaseAdminClient();
    const transport = await loadTransportAgencyDeliverySettings(
      supabase,
      store.id,
      store.deliverySettings?.pickupEnabled !== false
    );
    if (transport) {
      return {
        ...store,
        deliverySettings: {
            ...transport.settings,
            nationalShippingEnabled: store.deliverySettings?.nationalShippingEnabled === true,
          },
      };
    }

    if (store.deliverySettings?.deliveryProvider === "entrega2") {
      const entrega2Brand = await getEntrega2AppBrand();
      if (entrega2Brand?.logoUrl) {
        return {
          ...store,
          deliverySettings: {
            ...store.deliverySettings,
            transportAgencyId: entrega2Brand.id,
            transportAgencyName: entrega2Brand.name,
            transportAgencyLogoUrl: entrega2Brand.logoUrl,
          },
        };
      }
    }
  } catch {
    return store;
  }

  if (!store.deliverySettings) return store;

  return {
    ...store,
    deliverySettings: disableUnavailableTransportAgencySettings(store.deliverySettings),
  };
}

async function hydrateStoreDeliveryRelations(row: AnyRecord | null): Promise<AnyRecord | null> {
  if (!row?.id) return row;

  try {
    const supabase = createSupabaseAdminClient();
    const [settingsResult, zonesResult, ratesResult] = await Promise.all([
      supabase
        .from("store_delivery_settings")
        .select(
          "delivery_enabled, pickup_enabled, national_shipping_enabled, delivery_provider, pricing_type, fixed_fee_usd, free_delivery_min_usd, delivery_promo_enabled, delivery_promo_min_subtotal_usd, delivery_promo_discount_type, delivery_promo_discount_value, max_distance_km, distance_factor, manual_quote_message, transport_agency_connection_id, transport_agency_id"
        )
        .eq("store_id", row.id)
        .maybeSingle(),
      supabase
        .from("store_delivery_zones")
        .select("id, name, description, fee_usd, is_active, sort_order")
        .eq("store_id", row.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("store_delivery_distance_rates")
        .select("id, min_km, max_km, fee_usd, is_active, sort_order")
        .eq("store_id", row.id)
        .order("sort_order", { ascending: true }),
    ]);

    return {
      ...row,
      store_delivery_settings: settingsResult.data ? [settingsResult.data] : [],
      store_delivery_zones: zonesResult.data || row.store_delivery_zones || [],
      store_delivery_distance_rates:
        ratesResult.data || row.store_delivery_distance_rates || [],
    };
  } catch {
    return row;
  }
}

async function hydrateStoresDeliveryRelations(rows: AnyRecord[]): Promise<AnyRecord[]> {
  const storeIds = Array.from(
    new Set(rows.map((row) => String(row?.id || "")).filter(Boolean))
  );
  if (!storeIds.length) return rows;

  try {
    const supabase = createSupabaseAdminClient();
    const [settingsResult, zonesResult, ratesResult] = await Promise.all([
      supabase
        .from("store_delivery_settings")
        .select(
          "store_id, delivery_enabled, pickup_enabled, national_shipping_enabled, delivery_provider, pricing_type, fixed_fee_usd, free_delivery_min_usd, delivery_promo_enabled, delivery_promo_min_subtotal_usd, delivery_promo_discount_type, delivery_promo_discount_value, max_distance_km, distance_factor, manual_quote_message, transport_agency_connection_id, transport_agency_id"
        )
        .in("store_id", storeIds),
      supabase
        .from("store_delivery_zones")
        .select("id, store_id, name, description, fee_usd, is_active, sort_order")
        .in("store_id", storeIds)
        .order("sort_order", { ascending: true }),
      supabase
        .from("store_delivery_distance_rates")
        .select("id, store_id, min_km, max_km, fee_usd, is_active, sort_order")
        .in("store_id", storeIds)
        .order("sort_order", { ascending: true }),
    ]);

    const settingsByStore = new Map<string, AnyRecord>();
    const zonesByStore = new Map<string, AnyRecord[]>();
    const ratesByStore = new Map<string, AnyRecord[]>();

    if (!settingsResult.error) {
      for (const setting of settingsResult.data || []) {
        settingsByStore.set(String(setting.store_id), setting);
      }
    }
    if (!zonesResult.error) {
      for (const zone of zonesResult.data || []) {
        const storeId = String(zone.store_id);
        zonesByStore.set(storeId, [...(zonesByStore.get(storeId) || []), zone]);
      }
    }
    if (!ratesResult.error) {
      for (const rate of ratesResult.data || []) {
        const storeId = String(rate.store_id);
        ratesByStore.set(storeId, [...(ratesByStore.get(storeId) || []), rate]);
      }
    }

    return rows.map((row) => {
      const storeId = String(row.id);
      const setting = settingsByStore.get(storeId);
      return {
        ...row,
        store_delivery_settings: settingsResult.error
          ? row.store_delivery_settings || []
          : setting
            ? [setting]
            : [],
        store_delivery_zones: zonesResult.error
          ? row.store_delivery_zones || []
          : zonesByStore.get(storeId) || [],
        store_delivery_distance_rates: ratesResult.error
          ? row.store_delivery_distance_rates || []
          : ratesByStore.get(storeId) || [],
      };
    });
  } catch {
    return rows;
  }
}

async function getMarketplaceEligibleStoreIds(
  supabase: ReturnType<typeof createSupabasePublicClient>,
  storeIds: string[]
) {
  if (!supabase || !storeIds.length) return new Set<string>();

  const rpcResult = await supabase.rpc("marketplace_eligible_store_ids", {
    p_store_ids: storeIds,
  });
  if (!rpcResult.error) {
    return new Set((rpcResult.data || []).map((row: AnyRecord) => String(row.store_id)));
  }

  const productsResult = await supabase
    .from("products")
    .select("store_id")
    .in("store_id", storeIds)
    .gt("price_usd", 0);

  if (productsResult.error) return new Set<string>();
  return new Set((productsResult.data || []).map((row: AnyRecord) => String(row.store_id)));
}

export async function getPublicStores(): Promise<Store[]> {
  const supabase = createSupabasePublicClient();

  if (!supabase) return allowDemoFallbacks() ? fallbackStores : [];

  const storesResult = await supabase
    .from("stores")
    .select(storeShellSelect)
    .eq("is_active", true)
    .order("name", { ascending: true });
  let data: any[] | null = storesResult.data as any;
  let error = storesResult.error;

  if (error) {
    const deliveryFallbackResult = await supabase
      .from("stores")
      .select(storeShellCompatibleSelect)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (!deliveryFallbackResult.error) {
      data = deliveryFallbackResult.data?.map(withPaymentDetailsFallback) || [];
      error = null;
    } else {
      const fallbackResult = await supabase
        .from("stores")
        .select(legacyStoreSelect)
        .eq("is_active", true)
        .order("name", { ascending: true });

      data = fallbackResult.data?.map(withPaymentDetailsFallback) || [];
      error = fallbackResult.error;
    }
  }

  if (error || !data?.length) {
    console.warn("Using fallback stores. Supabase error:", error?.message);
    return allowDemoFallbacks() ? fallbackStores : [];
  }

  const candidateRows = (data as AnyRecord[]).filter(
    (row) =>
      row.is_test !== true &&
      row.marketplace_visible !== false &&
      !isStoreSubscriptionPastDue(row) &&
      Boolean(String(row.logo_url || "").trim())
  );
  const candidateIds = candidateRows.map((row) => String(row.id));
  if (!candidateIds.length) return [];

  const eligibleIds = await getMarketplaceEligibleStoreIds(supabase, candidateIds);
  const hydratedData = await hydrateStoresDeliveryRelations(
    candidateRows.filter((row) => eligibleIds.has(String(row.id)))
  );

  return hydratedData
    .map((row) => mapStore(row, { includeFallbackCatalog: false }));
}

export async function getPublicTransportAgencyMarketplaceBySlug(slug: string): Promise<{
  agency: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    bannerImageUrl: string | null;
    city: string | null;
    state: string | null;
    coverageNotes: string | null;
  };
  stores: Store[];
} | null> {
  const supabase = createSupabaseAdminClient();
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  if (!normalizedSlug) return null;

  let { data: agency, error: agencyError } = await supabase
    .from("transport_agencies")
    .select("id, name, slug, logo_url, banner_image_url, city, state, coverage_notes, status, is_active")
    .eq("slug", normalizedSlug)
    .eq("status", "active")
    .eq("is_active", true)
    .maybeSingle();

  if (agencyError && /banner_image_url/i.test(agencyError.message || "")) {
    const fallback = await supabase
      .from("transport_agencies")
      .select("id, name, slug, logo_url, city, state, coverage_notes, status, is_active")
      .eq("slug", normalizedSlug)
      .eq("status", "active")
      .eq("is_active", true)
      .maybeSingle();

    agency = fallback.data ? { ...fallback.data, banner_image_url: null } : null;
    agencyError = fallback.error;
  }

  if (agencyError || !agency?.id) return null;

  const { data: connections, error: connectionsError } = await supabase
    .from("store_transport_agency_connections")
    .select("store_id, disengagement_effective_at")
    .eq("agency_id", agency.id)
    .eq("status", "active")
    .order("connected_at", { ascending: false })
    .limit(200);

  if (connectionsError) return null;

  const now = Date.now();
  const storeIds = Array.from(
    new Set(
      (connections || [])
        .filter((connection) => {
          if (!connection.store_id) return false;
          if (!connection.disengagement_effective_at) return true;
          return new Date(connection.disengagement_effective_at).getTime() > now;
        })
        .map((connection) => connection.store_id)
    )
  );

  if (!storeIds.length) {
    return {
      agency: {
        id: String(agency.id),
        name: agency.name,
        slug: agency.slug,
        logoUrl: agency.logo_url || null,
        bannerImageUrl: agency.banner_image_url || null,
        city: agency.city || null,
        state: agency.state || null,
        coverageNotes: normalizePublicBrandText(agency.coverage_notes) || null,
      },
      stores: [],
    };
  }

  const { data: storesData, error: storesError } = await supabase
    .from("stores")
    .select(storeShellSelect)
    .in("id", storeIds)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (storesError) return null;

  const marketplaceCandidates = ((storesData || []) as AnyRecord[]).filter(
    (row) => !isStoreSubscriptionPastDue(row) && Boolean(String(row.logo_url || "").trim())
  );
  const eligibleStoreIds = await getMarketplaceEligibleStoreIds(
    supabase,
    marketplaceCandidates.map((row) => String(row.id))
  );
  const eligibleMarketplaceStores = marketplaceCandidates.filter((row) =>
    eligibleStoreIds.has(String(row.id))
  );

  return {
    agency: {
      id: String(agency.id),
      name: agency.name,
      slug: agency.slug,
      logoUrl: agency.logo_url || null,
      bannerImageUrl: agency.banner_image_url || null,
      city: agency.city || null,
      state: agency.state || null,
      coverageNotes: normalizePublicBrandText(agency.coverage_notes) || null,
    },
    stores: (await hydrateStoresDeliveryRelations(eligibleMarketplaceStores))
      .map((row) => mapStore(row, { includeFallbackCatalog: false })),
  };
}

export async function getPublicStoreShellBySlug(slug: string): Promise<Store | null> {
  const supabase = createSupabasePublicClient();

  if (!supabase) {
    const fallback = allowDemoFallbacks() ? getFallbackStoreBySlug(slug) || null : null;
    return fallback
      ? {
          ...fallback,
          categories: [],
          products: [],
        }
      : null;
  }

  const storeResult = await supabase
    .from("stores")
    .select(storeShellSelect)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  let data: any | null = storeResult.data as any;
  let error = storeResult.error;

  if (error) {
    const deliveryFallbackResult = await supabase
      .from("stores")
      .select(storeShellCompatibleSelect)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (!deliveryFallbackResult.error) {
      data = deliveryFallbackResult.data
        ? withPaymentDetailsFallback(deliveryFallbackResult.data)
        : null;
      error = null;
    } else {
      const fallbackResult = await supabase
        .from("stores")
        .select(baseStoreSelect)
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      data = fallbackResult.data
        ? withPaymentDetailsFallback(fallbackResult.data)
        : null;
      error = fallbackResult.error;
    }
  }

  if (error || !data) {
    console.warn("Using fallback store shell. Supabase error:", error?.message);
    const fallback = allowDemoFallbacks() ? getFallbackStoreBySlug(slug) || null : null;
    return fallback
      ? {
          ...fallback,
          categories: [],
          products: [],
        }
      : null;
  }

  data = await hydrateStoreDeliveryRelations(data);

  if (isStoreSubscriptionPastDue(data)) return null;

  return applyTransportDeliverySettings(mapStore(data, { includeFallbackCatalog: false }));
}

export async function getPublicStoreBySlug(slug: string): Promise<Store | null> {
  const supabase = createSupabasePublicClient();

  if (!supabase) {
    return allowDemoFallbacks() ? getFallbackStoreBySlug(slug) || null : null;
  }

  const storeResult = await supabase
    .from("stores")
    .select(storeSelect)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  let data: any | null = storeResult.data as any;
  let error = storeResult.error;

  if (error) {
    const deliveryFallbackResult = await supabase
      .from("stores")
      .select(deliveryCompatibleStoreSelect)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (!deliveryFallbackResult.error) {
      data = deliveryFallbackResult.data
        ? withPaymentDetailsFallback(deliveryFallbackResult.data)
        : null;
      error = null;
    } else {
      const fallbackResult = await supabase
        .from("stores")
        .select(legacyStoreSelect)
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      data = fallbackResult.data
        ? withPaymentDetailsFallback(fallbackResult.data)
        : null;
      error = fallbackResult.error;
    }
  }

  if (error || !data) {
    console.warn("Using fallback store. Supabase error:", error?.message);
    return allowDemoFallbacks() ? getFallbackStoreBySlug(slug) || null : null;
  }

  data = await hydrateStoreDeliveryRelations(data);

  if (isStoreSubscriptionPastDue(data)) return null;

  const productIds = (data.products || []).map((product: AnyRecord) => product.id).filter(Boolean);
  if (productIds.length) {
    const imagesResult = await supabase.from("product_images")
      .select("product_id, image_url, sort_order, is_active")
      .in("product_id", productIds).eq("is_active", true).order("sort_order");
    if (!imagesResult.error) {
      const imagesByProductId = new Map<string, AnyRecord[]>();
      for (const image of imagesResult.data || []) {
        const productId = String((image as AnyRecord).product_id || "");
        if (!productId) continue;
        const currentImages = imagesByProductId.get(productId) || [];
        currentImages.push(image as AnyRecord);
        imagesByProductId.set(productId, currentImages);
      }

      data.products = (data.products || []).map((product: AnyRecord) => ({
        ...product,
        product_images: imagesByProductId.get(String(product.id)) || [],
      }));
    }
  }

  return applyTransportDeliverySettings(mapStore(data));
}

export async function getUnavailableStoreContactBySlug(slug: string) {
  const supabase = createSupabasePublicClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("stores")
    .select("slug, name, whatsapp, is_active, subscription_status, trial_ends_at, subscription_ends_at, next_payment_due_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return null;

  const unavailable =
    (data as any).is_active === false || isStoreSubscriptionPastDue(data as AnyRecord);

  return unavailable
    ? {
        name: (data as any).name || "la tienda",
        whatsapp: String((data as any).whatsapp || "").replace(/[^0-9]/g, ""),
      }
    : null;
}

export async function getPublicStoreSlugs() {
  const stores = await getPublicStores();
  return stores.map((store) => store.slug);
}









