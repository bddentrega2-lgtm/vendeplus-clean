import type { Category, Product, ProductVariant, Store } from "@/types";
import { getStoreBySlug as getFallbackStoreBySlug, stores as fallbackStores } from "@/data/stores";
import { createSupabasePublicClient } from "@/lib/supabase/server";

type AnyRecord = Record<string, any>;

const defaultPaymentMethods = ["Pago móvil", "Transferencia", "Efectivo", "Binance"];

const fallbackHeroImages: Record<string, string> = {
  "don-aniello": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1400&q=80",
  "china-twon": "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1400&q=80",
  "bizcochos-ascoli": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1400&q=80",
};

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

function mapVariant(row: AnyRecord, productPriceUsd: number): ProductVariant {
  const variantPrice = toNumber(row.price_usd, productPriceUsd);

  return {
    id: String(row.id),
    name: row.name || "Presentación",
    priceDeltaUsd: Math.max(0, variantPrice - productPriceUsd),
    isAvailable: row.is_available !== false,
  };
}

function mapStore(row: AnyRecord): Store {
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
      const priceUsd = toNumber(product.price_usd);
      const variantsRaw: AnyRecord[] = Array.isArray(product.product_variants)
        ? product.product_variants
        : [];

      return {
        id: String(product.id),
        storeId: String(row.id),
        categoryId: product.category_id ? String(product.category_id) : categories[0]?.id || "general",
        name: product.name || "Producto",
        slug: `${slugify(product.name || "producto")}-${String(product.id).slice(0, 6)}`,
        description: product.description || "Producto disponible para pedir desde Vende+.",
        priceUsd,
        imageUrl: product.image_url || row.cover_image_url || fallbackHeroImages[row.slug] || fallbackHeroImages["don-aniello"],
        imageAlt: product.name || "Producto",
        imageEmoji: "✨",
        isAvailable: product.is_available !== false,
        isFeatured: Boolean(product.is_featured),
        tags: product.is_featured ? ["Recomendado"] : [],
        variants: variantsRaw
          .filter((variant) => variant.is_available !== false)
          .sort((a, b) => toNumber(a.sort_order) - toNumber(b.sort_order))
          .map((variant) => mapVariant(variant, priceUsd)),
      };
    });

  const fallback = getFallbackStoreBySlug(row.slug);

  return {
    id: String(row.id),
    name: row.name || fallback?.name || "Comercio",
    slug: row.slug,
    category: row.business_type || fallback?.category || row.description || "Comercio aliado",
    description: row.description || fallback?.description || "Catálogo disponible en Vende+.",
    whatsappPhone: row.whatsapp || fallback?.whatsappPhone || "584245666025",
    address: row.address || fallback?.address || "Maracay, Aragua",
    latitude: toNumber(row.latitude, fallback?.latitude || 0),
    longitude: toNumber(row.longitude, fallback?.longitude || 0),
    openingHours: row.opening_hours || fallback?.openingHours || "Disponible hoy",
    deliveryEstimate: row.delivery_estimate || fallback?.deliveryEstimate || "25-40 min",
    pickupEstimate: row.pickup_estimate || fallback?.pickupEstimate || "15-25 min",
    badge: fallback?.badge || "Aliado Vende+",
    heroImageUrl: row.cover_image_url || fallback?.heroImageUrl || fallbackHeroImages[row.slug] || fallbackHeroImages["don-aniello"],
    categories: categories.length ? categories : fallback?.categories || [],
    products: products.length ? products : fallback?.products || [],
    paymentMethods: toStringArray(row.payment_methods, fallback?.paymentMethods || defaultPaymentMethods),
    logoUrl: row.logo_url || fallback?.logoUrl || "",
    coverImageUrl: row.cover_image_url || fallback?.coverImageUrl || fallback?.heroImageUrl || "",
    primaryColor: row.primary_color || fallback?.primaryColor || "#2E3A79",
    accentColor: row.accent_color || fallback?.accentColor || "#FFB547",
    buttonTextColor: row.button_text_color || fallback?.buttonTextColor || "#25262B",
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
  delivery_estimate,
  pickup_estimate,
  payment_methods,
  usd_to_bs,
  whatsapp_message_note,
  is_active,
  accepts_delivery,
  accepts_pickup,
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

export async function getPublicStores(): Promise<Store[]> {
  const supabase = createSupabasePublicClient();

  if (!supabase) return fallbackStores;

  const { data, error } = await supabase
    .from("stores")
    .select(storeSelect)
    .eq("is_active", true);

  if (error || !data?.length) {
    console.warn("Using fallback stores. Supabase error:", error?.message);
    return fallbackStores;
  }

  return data.map(mapStore);
}

export async function getPublicStoreBySlug(slug: string): Promise<Store | null> {
  const supabase = createSupabasePublicClient();

  if (!supabase) return getFallbackStoreBySlug(slug) || null;

  const { data, error } = await supabase
    .from("stores")
    .select(storeSelect)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    console.warn("Using fallback store. Supabase error:", error?.message);
    return getFallbackStoreBySlug(slug) || null;
  }

  return mapStore(data);
}

export async function getPublicStoreSlugs() {
  const stores = await getPublicStores();
  return stores.map((store) => store.slug);
}







