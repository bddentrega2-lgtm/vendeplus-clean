import { randomUUID } from "crypto";
import { getStoreServiceFeeUsd } from "@/lib/plans";
import { NextRequest, NextResponse } from "next/server";
import type { CartItem, CheckoutFormData, SavedOrder, Store } from "@/types";
import { getInitialPaymentStatus, getSuggestedPaymentCurrency, isCashPaymentMethod } from "@/lib/payments";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isStoreSubscriptionPastDue } from "@/lib/supabase/catalog";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";
import { normalizePhone } from "@/lib/customers/normalize-phone";
import {
  isPrepaidTablePaymentMethod,
} from "@/lib/table-orders";
import { safeUpsertCustomerFromOrder } from "@/lib/customers/upsert-customer-from-order";
import {
  calculateDeliveryQuoteFromSettings,
  disableUnavailableTransportAgencySettings,
  mapStoreDeliverySettings,
} from "@/lib/delivery";
import { loadTransportAgencyDeliverySettings } from "@/lib/transport";
import { verifyDeliveryQuote } from "@/lib/server/signed-delivery-quote";
import { getStoreOpenState } from "@/lib/business-hours";
import {
  checkDistributedRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/server/rate-limit";
import {
  attachApiResponseHeaders,
  createApiRequestContext,
  logApiError,
  logApiEvent,
} from "@/lib/server/observability";
import { isValidTableOrderTokenForStore } from "@/lib/server/table-order-tokens";
import { createOrderAtomic } from "@/lib/server/create-order-atomic";

const MAX_ORDER_BODY_BYTES = 180_000;
const MAX_ORDER_ITEMS = 80;
const MAX_ITEM_QUANTITY = 99;
const ORDER_IP_LIMIT = 60;
const ORDER_STORE_IP_LIMIT = 24;
const ORDER_RATE_WINDOW_MS = 10 * 60 * 1000;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function orderErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const publicPrefixes = [
    "El producto ",
    "La presentación ",
    "Selecciona ",
    "Seleccionaste ",
    "Solo puedes ",
    "Una opción ",
  ];

  if (publicPrefixes.some((prefix) => message.startsWith(prefix))) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json(
    { error: "No se pudo guardar el pedido. Revisa los datos e intenta de nuevo." },
    { status: 500 }
  );
}

function cleanText(value: unknown, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeCustomerId(value: unknown) {
  const match = cleanText(value, 30).toUpperCase().match(/^([VEJ])[-\s]?([0-9]{1,12})$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function toSafeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isUuid(value?: string) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}

function normalizeItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      productId: cleanText(item?.productId),
      productName: cleanText(item?.productName, 140),
      productSlug: cleanText(item?.productSlug, 140),
      productImageUrl: cleanText(item?.productImageUrl, 1000),
      variantId: cleanText(item?.variantId) || undefined,
      variantName: cleanText(item?.variantName, 140) || undefined,
      quantity: Math.min(
        MAX_ITEM_QUANTITY,
        Math.max(1, Math.floor(toSafeNumber(item?.quantity, 1)))
      ),
      unitPriceUsd: toSafeNumber(item?.unitPriceUsd, 0),
      notes: cleanText(item?.notes, 280) || undefined,
      selectedOptions: Array.isArray(item?.selectedOptions)
        ? item.selectedOptions.map((option: any) => ({
            groupId: cleanText(option?.groupId),
            groupName: cleanText(option?.groupName, 140),
            valueId: cleanText(option?.valueId),
            valueName: cleanText(option?.valueName, 140),
            priceDeltaUsd: toSafeNumber(option?.priceDeltaUsd, 0),
          }))
        : [],
    }))
    .slice(0, MAX_ORDER_ITEMS)
    .filter((item) => item.productId);
}

async function loadOptionAssignments(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  storeId: string,
  productIds: string[]
) {
  const { data, error } = await supabase
    .from("product_option_group_products")
    .select(
      `
      product_id,
      sort_order,
      product_option_groups (
        id,
        name,
        description,
        selection_type,
        required,
        min_select,
        max_select,
        is_active,
        sort_order,
        product_option_values (
          id,
          name,
          description,
          price_delta_usd,
          is_active,
          sort_order,
          product_option_value_variant_prices (
            variant_id,
            price_delta_usd
          )
        )
      )
    `
    )
    .eq("store_id", storeId)
    .in("product_id", productIds);

  if (error) throw error;

  const byProduct = new Map<string, any[]>();
  for (const assignment of data || []) {
    const productId = String((assignment as any).product_id);
    const current = byProduct.get(productId) || [];
    current.push(assignment);
    byProduct.set(productId, current);
  }

  return byProduct;
}

async function loadStoreDeliverySettings(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  storeId: string,
  legacy?: {
    acceptsDelivery?: boolean | null;
    acceptsPickup?: boolean | null;
    acceptsNationalShipping?: boolean | null;
  }
) {
  const row: any = {
    id: storeId,
    accepts_delivery: legacy?.acceptsDelivery,
    accepts_pickup: legacy?.acceptsPickup,
    accepts_national_shipping: legacy?.acceptsNationalShipping,
  };

  try {
    const [settingsResult, zonesResult, ratesResult] = await Promise.all([
      supabase
        .from("store_delivery_settings")
        .select(
          "delivery_enabled, pickup_enabled, delivery_provider, pricing_type, fixed_fee_usd, free_delivery_min_usd, delivery_promo_enabled, delivery_promo_min_subtotal_usd, delivery_promo_discount_type, delivery_promo_discount_value, max_distance_km, distance_factor, manual_quote_message, transport_agency_connection_id, transport_agency_id"
        )
        .eq("store_id", storeId)
        .maybeSingle(),
      supabase
        .from("store_delivery_zones")
        .select("id, name, description, fee_usd, is_active, sort_order")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("store_delivery_distance_rates")
        .select("id, min_km, max_km, fee_usd, is_active, sort_order")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    if (settingsResult.error || zonesResult.error || ratesResult.error) {
      return mapStoreDeliverySettings(row);
    }

    row.store_delivery_settings = settingsResult.data ? [settingsResult.data] : [];
    row.store_delivery_zones = zonesResult.data || [];
    row.store_delivery_distance_rates = ratesResult.data || [];
  } catch {
    return mapStoreDeliverySettings(row);
  }

  return mapStoreDeliverySettings(row);
}

export async function POST(request: NextRequest) {
  const apiContext = createApiRequestContext(request, "orders-create");
  const withApiHeaders = (response: NextResponse) =>
    attachApiResponseHeaders(response, apiContext, "orders-create");
  const requestBadRequest = (message: string) => withApiHeaders(badRequest(message));

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);

    if (contentLength > MAX_ORDER_BODY_BYTES) {
      return withApiHeaders(
        NextResponse.json(
          { error: "El pedido es demasiado grande. Reduce productos o notas." },
          { status: 413 }
        )
      );
    }

    const clientIp = getClientIp(request);
    const globalLimit = await checkDistributedRateLimit({
      key: `orders:ip:${clientIp}`,
      limit: ORDER_IP_LIMIT,
      windowMs: ORDER_RATE_WINDOW_MS,
    });

    if (!globalLimit.allowed) {
      return withApiHeaders(
        NextResponse.json(
          { error: "Demasiados intentos. Espera unos minutos y vuelve a intentar." },
          {
            status: 429,
            headers: rateLimitHeaders(globalLimit, ORDER_IP_LIMIT),
          }
        )
      );
    }

    const body = await request.json();
    const order = body.order as SavedOrder | undefined;
    const storeId = cleanText(body.storeId);
    const idempotencyKey = cleanText(body.idempotencyKey, 100);
    const tableOrder = order?.tableOrder;

    if (!order || !storeId) return requestBadRequest("Pedido inválido.");
    if (!isUuid(idempotencyKey)) {
      return requestBadRequest("No se pudo identificar este intento de pedido.");
    }

    const storeLimit = await checkDistributedRateLimit({
      key: `orders:store:${storeId}:ip:${clientIp}`,
      limit: ORDER_STORE_IP_LIMIT,
      windowMs: ORDER_RATE_WINDOW_MS,
    });

    if (!storeLimit.allowed) {
      return withApiHeaders(
        NextResponse.json(
          { error: "Demasiados pedidos para este comercio desde esta conexión. Intenta de nuevo en unos minutos." },
          {
            status: 429,
            headers: rateLimitHeaders(storeLimit, ORDER_STORE_IP_LIMIT),
          }
        )
      );
    }

    const items = normalizeItems(order.items);
    if (!items.length) return requestBadRequest("Tu carrito está vacío.");
    if (!cleanText(order.form?.customerName)) {
      return requestBadRequest("Escribe el nombre del cliente.");
    }
    if (!cleanText(order.form?.customerPhone)) {
      return requestBadRequest("Escribe el teléfono del cliente.");
    }
    if (!cleanText(order.form?.paymentMethod)) {
      return requestBadRequest("Selecciona un método de pago.");
    }


    const requestedDeliveryType: CheckoutFormData["deliveryType"] =
      order.form?.deliveryType === "table"
        ? "table"
        : order.form?.deliveryType === "pickup"
        ? "pickup"
        : order.form?.deliveryType === "national_shipping"
          ? "national_shipping"
          : "delivery";
    order.form.deliveryType = requestedDeliveryType;
    const supabase = createSupabaseAdminClient();
    let storeResult = await supabase
      .from("stores")
      .select("id, slug, name, whatsapp, usd_to_bs, base_currency, is_active, latitude, longitude, opening_hours, business_hours, manual_open_status, manual_open_note, accepts_delivery, accepts_pickup, accepts_national_shipping, request_customer_id_number, payment_methods, table_orders_access_enabled, table_orders_enabled, table_payment_methods, table_order_fulfillment_mode, plan_type, monthly_price_usd, service_fee_payer, service_fee_billing_cycle, subscription_status, trial_ends_at, subscription_ends_at, next_payment_due_at")
      .eq("id", storeId)
      .single();

    if (
      storeResult.error &&
      isMissingColumnError(storeResult.error, [
        "business_hours",
        "manual_open_status",
        "manual_open_note",
        "base_currency",
        "accepts_national_shipping",
        "request_customer_id_number",
        "subscription_status",
        "trial_ends_at",
        "subscription_ends_at",
        "next_payment_due_at",
        "table_orders_enabled",
        "table_orders_access_enabled",
        "table_payment_methods",
        "table_order_fulfillment_mode",
      ])
    ) {
      storeResult = await supabase
        .from("stores")
        .select("id, slug, name, whatsapp, usd_to_bs, is_active, latitude, longitude, accepts_delivery, accepts_pickup, payment_methods, plan_type, monthly_price_usd, service_fee_payer, service_fee_billing_cycle")
        .eq("id", storeId)
        .single();
    }

    const { data: store, error: storeError } = storeResult;

    if (storeError) throw storeError;
    if (!store || (store as any).is_active === false) {
      return requestBadRequest("El comercio no está disponible.");
    }

    let validatedTable: { id: string | null; name: string; zone: string | null } | null = null;
    let tableFulfillmentMode: "table_service" | "counter_pickup" | null = null;
    if (requestedDeliveryType === "table") {
      if (!tableOrder?.storeToken) {
        return requestBadRequest("Vuelve a escanear el QR para continuar.");
      }
      if (
        (store as any).table_orders_access_enabled !== true ||
        (store as any).table_orders_enabled !== true ||
        !(await isValidTableOrderTokenForStore(supabase, storeId, tableOrder.storeToken))
      ) {
        return requestBadRequest("Los pedidos en mesa no están disponibles en este momento.");
      }

      const storePaymentMethods = Array.isArray((store as any).payment_methods)
        ? (store as any).payment_methods
        : [];
      const tablePaymentMethods = Array.isArray((store as any).table_payment_methods)
        ? (store as any).table_payment_methods
        : [];
      const paymentMethod = cleanText(order.form.paymentMethod);
      if (
        !isPrepaidTablePaymentMethod(paymentMethod) ||
        !storePaymentMethods.includes(paymentMethod) ||
        !tablePaymentMethods.includes(paymentMethod)
      ) {
        return requestBadRequest("Ese método de pago no está disponible para pedidos en mesa.");
      }

      tableFulfillmentMode = (store as any).table_order_fulfillment_mode === "counter_pickup"
        ? "counter_pickup"
        : "table_service";

      if (tableFulfillmentMode === "counter_pickup") {
        validatedTable = { id: null, name: "Retiro en barra", zone: null };
        order.form.deliveryReference = "Retiro en barra";
      } else {
        if (!tableOrder.tableId) {
          return requestBadRequest("Vuelve a escanear el QR y selecciona tu mesa.");
        }
        const { data: table, error: tableError } = await supabase
        .from("store_tables")
        .select("id, name, zone")
        .eq("id", tableOrder.tableId)
        .eq("store_id", storeId)
        .eq("is_enabled", true)
        .maybeSingle();
      if (tableError) throw tableError;
      if (!table) return requestBadRequest("La mesa seleccionada ya no está disponible.");
      validatedTable = table;
      order.form.deliveryReference = table.name;
      }
    }

    if (isStoreSubscriptionPastDue(store as any)) {
      return requestBadRequest("El catalogo de este comercio esta inactivo temporalmente.");
    }

    const openState = getStoreOpenState({
      manualOpenStatus: (store as any).manual_open_status,
      manualOpenNote: (store as any).manual_open_note,
      businessHours: (store as any).business_hours,
      openingHoursText: (store as any).opening_hours,
    });

    if (!openState.isOpen) {
      return requestBadRequest(`${openState.label}. El comercio no está recibiendo pedidos en este momento.`);
    }

    const productIds = Array.from(new Set(items.map((item) => item.productId)));
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, store_id, name, price_usd, discount_percent, image_url, is_available")
      .eq("store_id", storeId)
      .in("id", productIds);

    if (productsError) throw productsError;

    const productMap = new Map(
      (products || []).map((product: any) => [String(product.id), product])
    );

    if (productMap.size !== productIds.length) {
      return requestBadRequest("Uno o más productos no pertenecen al comercio.");
    }

    const variantIds = Array.from(
      new Set(items.map((item) => item.variantId).filter(Boolean))
    ) as string[];
    const variantsById = new Map<string, any>();

    if (variantIds.length) {
      const { data: variants, error: variantsError } = await supabase
        .from("product_variants")
        .select("id, product_id, name, price_usd, is_available")
        .in("id", variantIds);

      if (variantsError) throw variantsError;
      for (const variant of variants || []) {
        variantsById.set(String((variant as any).id), variant);
      }
    }

    const hasSelectedOptions = items.some((item) => item.selectedOptions?.length);
    let optionAssignments = new Map<string, any[]>();

    try {
      optionAssignments = await loadOptionAssignments(supabase, storeId, productIds);
    } catch (error) {
      if (hasSelectedOptions) throw error;
    }

    const validatedItems = items.map((item) => {
      const product: any = productMap.get(item.productId);
      if (product.is_available === false) {
        throw new Error(`El producto ${product.name} no está disponible.`);
      }

      const basePriceUsd = toSafeNumber(product.price_usd, 0);
      const discountPercent = Math.max(0, Math.min(95, toSafeNumber(product.discount_percent, 0)));
      let productUnitPriceUsd = basePriceUsd;
      let variantName = item.variantName || null;

      if (item.variantId) {
        const variant = variantsById.get(item.variantId);
        if (!variant || String(variant.product_id) !== item.productId) {
          throw new Error(`La presentación de ${product.name} no es válida.`);
        }
        if (variant.is_available === false) {
          throw new Error(`La presentación ${variant.name} no está disponible.`);
        }
        variantName = variant.name || variantName;
        productUnitPriceUsd = toSafeNumber(variant.price_usd, basePriceUsd);
      }

      let unitPriceUsd = discountPercent > 0
        ? Number((productUnitPriceUsd * (1 - discountPercent / 100)).toFixed(2))
        : productUnitPriceUsd;

      const assignments = optionAssignments.get(item.productId) || [];
      const groups = assignments
        .map((assignment) => assignment.product_option_groups)
        .filter((group) => group && group.is_active !== false);
      const selectedByGroup = new Map<string, string[]>();

      for (const option of item.selectedOptions || []) {
        if (!option.groupId || !option.valueId) continue;
        const current = selectedByGroup.get(option.groupId) || [];
        current.push(option.valueId);
        selectedByGroup.set(option.groupId, current);
      }

      const frozenOptions = groups.flatMap((group: any) => {
        const selectedValueIds = selectedByGroup.get(String(group.id)) || [];
        const values = Array.isArray(group.product_option_values)
          ? group.product_option_values.filter((value: any) => value.is_active !== false)
          : [];
        const minSelect = group.required
          ? Math.max(1, toSafeNumber(group.min_select, 1))
          : 0;
        const maxSelect = toSafeNumber(
          group.max_select,
          group.selection_type === "single" ? 1 : 0
        );

        if (selectedValueIds.length < minSelect) {
          throw new Error(
            minSelect === 1
              ? `Selecciona una opción para ${group.name}.`
              : `Selecciona ${minSelect} opciones para ${group.name}.`
          );
        }
        if (maxSelect > 0 && selectedValueIds.length > maxSelect) {
          throw new Error(`Seleccionaste demasiadas opciones en ${group.name}.`);
        }
        if (group.selection_type === "single" && selectedValueIds.length > 1) {
          throw new Error(`Solo puedes seleccionar una opción en ${group.name}.`);
        }

        return selectedValueIds.map((valueId) => {
          const value = values.find((entry: any) => String(entry.id) === valueId);
          if (!value) {
            throw new Error(`Una opción de ${group.name} ya no está disponible.`);
          }
          const variantPrice = Array.isArray(value.product_option_value_variant_prices)
            ? value.product_option_value_variant_prices.find(
                (price: any) => String(price.variant_id) === item.variantId
              )
            : null;

          return {
            groupId: String(group.id),
            groupName: group.name || "Opciones",
            valueId: String(value.id),
            valueName: value.name || "Opción",
            priceDeltaUsd: variantPrice
              ? toSafeNumber(variantPrice.price_delta_usd, 0)
              : toSafeNumber(value.price_delta_usd, 0),
          };
        });
      });

      const optionExtraUsd = frozenOptions.reduce(
        (sum, option) => sum + option.priceDeltaUsd,
        0
      );
      unitPriceUsd += optionExtraUsd;

      return {
        productId: item.productId,
        productName: product.name || item.productName || "Producto",
        productSlug: item.productSlug,
        productImageUrl: product.image_url || item.productImageUrl,
        variantId: item.variantId,
        variantName: variantName || undefined,
        quantity: item.quantity,
        unitPriceUsd,
        notes: item.notes,
        selectedOptions: frozenOptions,
      } satisfies CartItem;
    });

    const subtotalUsd = validatedItems.reduce(
      (sum, item) => sum + item.unitPriceUsd * item.quantity,
      0
    );
    let deliverySettings = await loadStoreDeliverySettings(supabase, storeId, {
      acceptsDelivery: (store as any).accepts_delivery,
      acceptsPickup: (store as any).accepts_pickup,
      acceptsNationalShipping: (store as any).accepts_national_shipping,
    });
    const transportSettings = await loadTransportAgencyDeliverySettings(
      supabase,
      storeId,
      deliverySettings.pickupEnabled
    );
    if (transportSettings) {
      deliverySettings = {
        ...transportSettings.settings,
        nationalShippingEnabled: deliverySettings.nationalShippingEnabled === true,
      };
    }
    else deliverySettings = disableUnavailableTransportAgencySettings(deliverySettings);

    if (order.form.deliveryType === "delivery" && !deliverySettings.deliveryEnabled) {
      return requestBadRequest("Este comercio no tiene delivery activo en este momento.");
    }
    if (order.form.deliveryType === "pickup" && !deliverySettings.pickupEnabled) {
      return requestBadRequest("Este comercio no tiene retiro activo en este momento.");
    }
    if (order.form.deliveryType === "national_shipping" && !deliverySettings.nationalShippingEnabled) {
      return requestBadRequest("Este comercio no tiene envio nacional activo en este momento.");
    }
    const customerIdNumber = normalizeCustomerId(order.form.nationalIdNumber);
    if ((store as any).request_customer_id_number === true && !customerIdNumber) {
      return requestBadRequest("Escribe la cédula del cliente.");
    }
    if (order.form.deliveryType === "national_shipping" && !customerIdNumber) {
      return requestBadRequest("Escribe la cedula para el envio nacional.");
    }
    if (order.form.deliveryType === "national_shipping" && !cleanText(order.form.nationalShippingCity)) {
      return requestBadRequest("Escribe la ciudad de destino para el envio nacional.");
    }
    order.form.nationalIdNumber = customerIdNumber;

    const requiresLocationQuote =
      order.form.deliveryType === "delivery" &&
      (deliverySettings.deliveryProvider === "entrega2" ||
        ["zones", "fixed_distance", "distance_ranges"].includes(deliverySettings.pricingType));

    if (requiresLocationQuote && !order.location) {
      return requestBadRequest("Carga la ubicación GPS para cotizar el delivery.");
    }

    let serverQuote;
    if (requiresLocationQuote && order.location) {
      serverQuote = verifyDeliveryQuote({
        token: order.quote.quoteToken,
        storeId,
        latitude: order.location.latitude,
        longitude: order.location.longitude,
        subtotalUsd,
        zoneId: order.form.deliveryZoneId || order.quote.zoneId || null,
      });
      if (!serverQuote) {
        return requestBadRequest(
          "La cotización de delivery cambió o venció. Vuelve a cotizar antes de confirmar."
        );
      }
    } else {
      serverQuote = calculateDeliveryQuoteFromSettings({
        settings: deliverySettings,
        deliveryType: order.form.deliveryType,
        subtotalUsd,
        distanceKm: null,
        zoneId: order.form.deliveryZoneId || order.quote.zoneId || null,
        source: "manual",
      });
    }

    if (serverQuote.available === false) {
      return requestBadRequest(serverQuote.message || serverQuote.label || "La modalidad de entrega no está disponible.");
    }
    if (order.form.deliveryType === "delivery" && serverQuote.source === "pending") {
      return requestBadRequest(serverQuote.label || "Completa los datos de entrega.");
    }

    const deliveryUsd = order.form.deliveryType === "delivery" ? serverQuote.feeUsd : 0;
    const platformServiceFeeUsd = getStoreServiceFeeUsd(store as any);
    const platformServiceFeePayer = (store as any).service_fee_payer === "customer" ? "customer" : "merchant";
    const platformServiceFeeCustomerUsd = platformServiceFeePayer === "customer" ? platformServiceFeeUsd : 0;
    const totalUsd = subtotalUsd + deliveryUsd + platformServiceFeeCustomerUsd;
    const totalBs = totalUsd * toSafeNumber((store as any).usd_to_bs, 600);
    const totals = { subtotalUsd, deliveryUsd, serviceFeeUsd: platformServiceFeeCustomerUsd, totalUsd, totalBs };
    const publicCode = cleanText(order.id) || `VP-${randomUUID().slice(0, 3).toUpperCase()}`;
    const storeForMessage = {
      name: (store as any).name || order.storeName || "Comercio",
      baseCurrency: String((store as any).base_currency || "USD").toUpperCase() === "EUR" ? "EUR" : "USD",
    } as Store;
    const whatsappMessage = buildOrderMessage({
      orderId: publicCode,
      store: storeForMessage,
      items: validatedItems,
      form: order.form,
      location: order.location,
      quote: serverQuote,
      totals,
      mapsUrl: order.mapsUrl,
      routeUrl: order.routeUrl,
    });
    const orderDbId = randomUUID();
    const paymentReference = cleanText(order.form.paymentReference);
    const initialPaymentStatus = getInitialPaymentStatus(order.form.paymentMethod);
    const orderPayload = {
      id: orderDbId,
      public_code: publicCode,
      store_id: storeId,
      idempotency_key: idempotencyKey,
      customer_name: cleanText(order.form.customerName),
      customer_phone: cleanText(order.form.customerPhone),
      customer_phone_normalized: normalizePhone(order.form.customerPhone) || null,
      delivery_type: order.form.deliveryType,
      payment_method: cleanText(order.form.paymentMethod),
      payment_status:
        paymentReference && initialPaymentStatus !== "cash_on_delivery"
          ? "review"
          : initialPaymentStatus,
      payment_reference: paymentReference || null,
      payment_currency: getSuggestedPaymentCurrency(order.form.paymentMethod) || null,
      payment_notes: isCashPaymentMethod(order.form.paymentMethod)
        ? cleanText(order.form.cashPaymentNote, 500) || null
        : null,
      subtotal_usd: subtotalUsd,
      delivery_usd: deliveryUsd,
      total_usd: totalUsd,
      total_bs: totalBs,
      platform_service_fee_usd: platformServiceFeeUsd,
      platform_service_fee_payer: platformServiceFeeUsd > 0 ? platformServiceFeePayer : null,
      platform_service_fee_customer_usd: platformServiceFeeCustomerUsd,
      platform_service_fee_billing_cycle: platformServiceFeeUsd > 0 ? "monthly" : null,
      distance_km:
        order.form.deliveryType === "delivery" && serverQuote.distanceKm !== null
          ? serverQuote.distanceKm
          : null,
      delivery_lat:
        order.form.deliveryType === "delivery" && order.location
          ? order.location.latitude
          : null,
      delivery_lng:
        order.form.deliveryType === "delivery" && order.location
          ? order.location.longitude
          : null,
      delivery_reference:
        order.form.deliveryType === "national_shipping"
          ? cleanText(order.form.nationalIdNumber) || null
          : order.form.deliveryReference || null,
      store_table_id: validatedTable?.id || null,
      table_name_snapshot: validatedTable?.name || null,
      table_zone_snapshot: validatedTable?.zone || null,
      table_fulfillment_snapshot: tableFulfillmentMode,
      delivery_provider: order.form.deliveryType === "delivery" ? serverQuote.provider || null : null,
      delivery_fee_usd: deliveryUsd,
      delivery_zone_id:
        serverQuote.provider === "transport_agency" ? null : serverQuote.zoneId || null,
      delivery_zone_name: serverQuote.zoneName || null,
      delivery_distance_km: serverQuote.distanceKm,
      delivery_pricing_type: serverQuote.pricingType || null,
      delivery_status:
        order.form.deliveryType === "national_shipping"
          ? "national_shipping"
          : order.form.deliveryType === "delivery"
          ? serverQuote.provider === "entrega2"
            ? "pending_entrega2"
            : serverQuote.provider === "transport_agency"
              ? "pending_agency"
            : "pending"
          : "pickup",
      delivery_notes:
        order.form.deliveryType === "national_shipping"
          ? `Envio nacional. Cedula: ${cleanText(order.form.nationalIdNumber)}. Ciudad: ${cleanText(order.form.nationalShippingCity)}. Detalles por WhatsApp.`
          : serverQuote.ruleSummary || serverQuote.message || null,
      delivery_address:
        order.form.deliveryType === "national_shipping"
          ? cleanText(order.form.nationalShippingCity) || null
          : order.form.deliveryReference || null,
      transport_agency_id:
        order.form.deliveryType === "delivery" ? serverQuote.transportAgencyId || null : null,
      transport_agency_name:
        order.form.deliveryType === "delivery" ? serverQuote.transportAgencyName || null : null,
      transport_agency_fee_usd:
        order.form.deliveryType === "delivery" && serverQuote.provider === "transport_agency"
          ? serverQuote.originalFeeUsd ?? deliveryUsd
          : null,
      transport_agency_pricing_type:
        order.form.deliveryType === "delivery" && serverQuote.provider === "transport_agency"
          ? serverQuote.pricingType || null
          : null,
      transport_agency_zone_name:
        order.form.deliveryType === "delivery" && serverQuote.provider === "transport_agency"
          ? serverQuote.zoneName || null
          : null,
      transport_agency_status:
        order.form.deliveryType === "delivery" && serverQuote.provider === "transport_agency"
          ? "pending"
          : null,
      order_details: [
        cleanText(order.form.nationalIdNumber)
          ? `Cédula: ${cleanText(order.form.nationalIdNumber)}`
          : "",
        cleanText(order.form.orderDetails),
      ].filter(Boolean).join("\n") || null,
      notes: order.form.notes || null,
      status: "received",
      whatsapp_message: whatsappMessage,
    };

    const itemsPayload = validatedItems.map((item) => ({
      id: randomUUID(),
      product_id: isUuid(item.productId) ? item.productId : null,
      product_name: item.productName,
      variant_name: item.variantName || null,
      quantity: item.quantity,
      unit_price_usd: item.unitPriceUsd,
      total_usd: item.unitPriceUsd * item.quantity,
      notes: item.notes || null,
      options: (item.selectedOptions || []).map((option) => ({
        option_group_name: option.groupName,
        option_name: option.valueName,
        price_delta_usd: option.priceDeltaUsd,
        quantity: 1,
      })),
    }));

    const atomicResult = await createOrderAtomic({
      supabase,
      order: orderPayload,
      items: itemsPayload,
    });
    const persistedOrder = atomicResult.order;
    const cashPaymentNote = isCashPaymentMethod(order.form.paymentMethod)
      ? cleanText(order.form.cashPaymentNote, 500) || null
      : null;

    if (cashPaymentNote && persistedOrder.payment_notes !== cashPaymentNote) {
      const { error: paymentNoteError } = await supabase
        .from("orders")
        .update({ payment_notes: cashPaymentNote })
        .eq("id", persistedOrder.id)
        .eq("store_id", storeId);

      if (paymentNoteError) throw paymentNoteError;
      persistedOrder.payment_notes = cashPaymentNote;
    }

    if (!atomicResult.idempotentReplay) {
      await safeUpsertCustomerFromOrder(supabase, {
        id: persistedOrder.id,
        store_id: storeId,
        customer_name: cleanText(order.form.customerName),
        customer_phone: cleanText(order.form.customerPhone),
        delivery_type: order.form.deliveryType,
        payment_method: cleanText(order.form.paymentMethod),
        delivery_reference:
          order.form.deliveryType === "national_shipping"
            ? cleanText(order.form.nationalIdNumber) || null
            : order.form.deliveryReference || null,
        total_usd: totalUsd,
        created_at: persistedOrder.created_at || new Date().toISOString(),
      });
    }
    const savedOrder: SavedOrder = {
      ...order,
      id: persistedOrder.public_code || publicCode,
      databaseId: persistedOrder.id,
      storeName: (store as any).name || order.storeName,
      items: validatedItems,
      quote: serverQuote,
      totals,
      whatsappMessage: persistedOrder.whatsapp_message || whatsappMessage,
      whatsappUrl: buildWhatsAppUrl(
        (store as any).whatsapp || "",
        persistedOrder.whatsapp_message || whatsappMessage
      ),
      tableOrder: validatedTable
        ? {
            storeToken: tableOrder?.storeToken || "",
            tableId: validatedTable.id || "",
            tableName: validatedTable.name,
            tableZone: validatedTable.zone,
            paymentMethods: [],
            fulfillmentMode: tableFulfillmentMode || "table_service",
          }
        : null,
    };

    const response = NextResponse.json({
      orderId: persistedOrder.id,
      order: savedOrder,
      idempotentReplay: atomicResult.idempotentReplay,
    });
    logApiEvent(apiContext, "order_created", {
      orderId: persistedOrder.id,
      storeId,
      itemCount: validatedItems.length,
      deliveryType: order.form.deliveryType,
      deliveryProvider: serverQuote.provider || null,
    });
    return withApiHeaders(response);
  } catch (error) {
    logApiError(apiContext, "order_create_failed", error);
    const response = orderErrorResponse(error);
    return withApiHeaders(response);
  }
}
