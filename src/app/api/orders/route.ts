import { randomUUID } from "crypto";
import { getStoreServiceFeeUsd } from "@/lib/plans";
import { NextRequest, NextResponse } from "next/server";
import type { CartItem, CheckoutFormData, SavedOrder, Store } from "@/types";
import { getInitialPaymentStatus, getSuggestedPaymentCurrency } from "@/lib/payments";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isStoreSubscriptionPastDue } from "@/lib/supabase/catalog";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";
import { normalizePhone } from "@/lib/customers/normalize-phone";
import { safeUpsertCustomerFromOrder } from "@/lib/customers/upsert-customer-from-order";
import {
  calculateEntrega2FallbackQuote,
  calculateDeliveryQuoteFromSettings,
  calculateRouteDistanceKm,
  disableUnavailableTransportAgencySettings,
  mapStoreDeliverySettings,
} from "@/lib/delivery";
import { loadTransportAgencyDeliverySettings } from "@/lib/transport";
import {
  getEntrega2DefaultVehicleType,
  quoteEntrega2Delivery,
} from "@/lib/integrations/entrega2";
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
      order.form?.deliveryType === "pickup"
        ? "pickup"
        : order.form?.deliveryType === "national_shipping"
          ? "national_shipping"
          : "delivery";
    order.form.deliveryType = requestedDeliveryType;
    const supabase = createSupabaseAdminClient();
    let storeResult = await supabase
      .from("stores")
      .select("id, slug, name, whatsapp, usd_to_bs, base_currency, is_active, latitude, longitude, opening_hours, business_hours, manual_open_status, manual_open_note, accepts_delivery, accepts_pickup, accepts_national_shipping, plan_type, monthly_price_usd, service_fee_payer, service_fee_billing_cycle, subscription_status, trial_ends_at, subscription_ends_at, next_payment_due_at")
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
        "subscription_status",
        "trial_ends_at",
        "subscription_ends_at",
        "next_payment_due_at",
      ])
    ) {
      storeResult = await supabase
        .from("stores")
        .select("id, slug, name, whatsapp, usd_to_bs, is_active, latitude, longitude, accepts_delivery, accepts_pickup, plan_type, monthly_price_usd, service_fee_payer, service_fee_billing_cycle")
        .eq("id", storeId)
        .single();
    }

    const { data: store, error: storeError } = storeResult;

    if (storeError) throw storeError;
    if (!store || (store as any).is_active === false) {
      return requestBadRequest("El comercio no está disponible.");
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
    if (order.form.deliveryType === "national_shipping" && !cleanText(order.form.nationalIdNumber)) {
      return requestBadRequest("Escribe la cedula para el envio nacional.");
    }
    if (order.form.deliveryType === "national_shipping" && !cleanText(order.form.nationalShippingCity)) {
      return requestBadRequest("Escribe la ciudad de destino para el envio nacional.");
    }

    if (
      order.form.deliveryType === "delivery" &&
      deliverySettings.pricingType === "zones" &&
      !["manual_quote", "disabled"].includes(deliverySettings.deliveryProvider) &&
      !order.location
    ) {
      return requestBadRequest("Carga la ubicación GPS para que el repartidor pueda llegar.");
    }

    const serverDistance =
      order.form.deliveryType === "delivery" && order.location
        ? await calculateRouteDistanceKm({
            originLat: toSafeNumber((store as any).latitude, 0),
            originLng: toSafeNumber((store as any).longitude, 0),
            destinationLat: order.location.latitude,
            destinationLng: order.location.longitude,
          })
        : null;
    const serverDistanceKm = serverDistance?.distanceKm ?? null;
    let serverQuote = calculateDeliveryQuoteFromSettings({
      settings: deliverySettings,
      deliveryType: order.form.deliveryType,
      subtotalUsd,
      distanceKm: serverDistanceKm,
      zoneId: order.form.deliveryZoneId || order.quote.zoneId || null,
      source: serverDistance?.source || "manual",
    });

    if (
      order.form.deliveryType === "delivery" &&
      deliverySettings.deliveryProvider === "entrega2"
    ) {
      if (!order.location) {
        return requestBadRequest("Comparte tu ubicacion para cotizar el delivery con Entrega2 App.");
      }

      const storeLat = toSafeNumber((store as any).latitude, Number.NaN);
      const storeLng = toSafeNumber((store as any).longitude, Number.NaN);
      if (!Number.isFinite(storeLat) || !Number.isFinite(storeLng)) {
        return requestBadRequest("El comercio necesita ubicacion GPS configurada para cotizar con Entrega2 App.");
      }

      try {
        const entrega2Quote = await quoteEntrega2Delivery({
          latitud_retiro: storeLat,
          longitud_retiro: storeLng,
          latitud_entrega: order.location.latitude,
          longitud_entrega: order.location.longitude,
          tipo_vehiculo: getEntrega2DefaultVehicleType(),
        });
        const payload = (entrega2Quote.payload || {}) as any;
        const cost = toSafeNumber(payload.costo_total, Number.NaN);

        if (!Number.isFinite(cost) || cost < 0) {
          throw new Error("Entrega2 App no devolvio una cotizacion valida para este delivery.");
        }

        const roundedCost = Number(cost.toFixed(2));
        const entrega2Distance = Number.isFinite(Number(payload.distancia_km))
          ? Number(Number(payload.distancia_km).toFixed(2))
          : null;
        const quotedDistance =
          entrega2Distance !== null && entrega2Distance > 0
            ? entrega2Distance
            : serverQuote.distanceKm;
        const duration = String(payload.duracion_estimada || "").trim();
        const quoteDetail = [
          quotedDistance !== null ? `${quotedDistance.toFixed(2)} km` : null,
          duration && duration.toLowerCase() !== "n/a" ? duration : null,
        ].filter(Boolean).join(" · ");

        serverQuote = {
          ...serverQuote,
          distanceKm: quotedDistance,
          feeUsd: roundedCost,
          originalFeeUsd: roundedCost,
          discountUsd: 0,
          label: quoteDetail
            ? `Entrega2 App · ${quoteDetail} · $${roundedCost.toFixed(2)}`
            : `Entrega2 App · $${roundedCost.toFixed(2)}`,
          source: "route",
          available: true,
          provider: "entrega2",
          pricingType: "manual",
          message: undefined,
          ruleSummary: quoteDetail || "Cotizado por Entrega2 App",
        };
      } catch (error) {
        logApiError(apiContext, "entrega2_quote_failed", error, {
          storeId,
        });
        const fallbackDistanceKm =
          serverQuote.distanceKm !== null && serverQuote.distanceKm !== undefined
            ? serverQuote.distanceKm
            : serverDistanceKm;
        serverQuote = calculateEntrega2FallbackQuote({
          settings: deliverySettings,
          subtotalUsd,
          distanceKm: fallbackDistanceKm,
          source: serverDistance?.source || "fallback",
        });
      }
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
    const whatsappUrl = buildWhatsAppUrl((store as any).whatsapp || "", whatsappMessage);
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
      delivery_provider: order.form.deliveryType === "delivery" ? serverQuote.provider || null : null,
      delivery_fee_usd: deliveryUsd,
      delivery_zone_id: serverQuote.zoneId || null,
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
      order_details: order.form.orderDetails || null,
      notes: order.form.notes || null,
      status: "received",
      whatsapp_message: whatsappMessage,
    };

    let { error: orderError } = await supabase.from("orders").insert(orderPayload);

    if (orderError?.code === "23505") {
      const { data: existingOrder, error: existingOrderError } = await supabase
        .from("orders")
        .select("id, public_code, whatsapp_message")
        .eq("store_id", storeId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingOrderError) throw existingOrderError;
      if (existingOrder) {
        const savedOrder: SavedOrder = {
          ...order,
          id: existingOrder.public_code || publicCode,
          storeName: (store as any).name || order.storeName,
          items: validatedItems,
          quote: serverQuote,
          totals,
          whatsappMessage: existingOrder.whatsapp_message || whatsappMessage,
          whatsappUrl: buildWhatsAppUrl(
            (store as any).whatsapp || "",
            existingOrder.whatsapp_message || whatsappMessage
          ),
        };
        return withApiHeaders(NextResponse.json({
          orderId: existingOrder.id,
          order: savedOrder,
          idempotentReplay: true,
        }));
      }
    }

    if (orderError && isMissingColumnError(orderError, ["payment_", "customer_", "delivery_", "platform_service_"])) {
      const {
        payment_status: _paymentStatus,
        payment_reference: _paymentReference,
        payment_currency: _paymentCurrency,
        customer_phone_normalized: _customerPhoneNormalized,
        platform_service_fee_usd: _platformServiceFeeUsd,
        platform_service_fee_payer: _platformServiceFeePayer,
        platform_service_fee_customer_usd: _platformServiceFeeCustomerUsd,
        platform_service_fee_billing_cycle: _platformServiceFeeBillingCycle,
        delivery_provider: _deliveryProvider,
        delivery_fee_usd: _deliveryFeeUsd,
        delivery_zone_id: _deliveryZoneId,
        delivery_zone_name: _deliveryZoneName,
        delivery_distance_km: _deliveryDistanceKm,
        delivery_pricing_type: _deliveryPricingType,
        delivery_status: _deliveryStatus,
        delivery_notes: _deliveryNotes,
        delivery_address: _deliveryAddress,
        transport_agency_id: _transportAgencyId,
        transport_agency_name: _transportAgencyName,
        transport_agency_fee_usd: _transportAgencyFeeUsd,
        transport_agency_pricing_type: _transportAgencyPricingType,
        transport_agency_zone_name: _transportAgencyZoneName,
        transport_agency_status: _transportAgencyStatus,
        ...baseOrderPayload
      } = orderPayload;
      const fallbackResult = await supabase.from("orders").insert(baseOrderPayload);
      orderError = fallbackResult.error;
    }

    if (orderError) throw orderError;

    const customerUpsertPromise = safeUpsertCustomerFromOrder(supabase, {
      id: orderDbId,
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
      created_at: new Date().toISOString(),
    });

    const itemsPayload = validatedItems.map((item) => ({
      order_id: orderDbId,
      product_id: isUuid(item.productId) ? item.productId : null,
      product_name: item.productName,
      variant_name: item.variantName || null,
      quantity: item.quantity,
      unit_price_usd: item.unitPriceUsd,
      total_usd: item.unitPriceUsd * item.quantity,
      notes: item.notes || null,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsPayload)
      .select("id");

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", orderDbId);
      throw itemsError;
    }

    const optionRows = validatedItems.flatMap((item, index) => {
      const orderItemId = insertedItems?.[index]?.id;
      if (!orderItemId) return [];

      return (item.selectedOptions || []).map((option) => ({
        order_item_id: orderItemId,
        option_group_name: option.groupName,
        option_name: option.valueName,
        price_delta_usd: option.priceDeltaUsd,
        quantity: 1,
      }));
    });

    if (optionRows.length) {
      const { error: optionsError } = await supabase
        .from("order_item_options")
        .insert(optionRows);

      if (optionsError) {
        await supabase.from("orders").delete().eq("id", orderDbId);
        throw optionsError;
      }
    }

    await customerUpsertPromise;

    const savedOrder: SavedOrder = {
      ...order,
      id: publicCode,
      storeName: (store as any).name || order.storeName,
      items: validatedItems,
      quote: serverQuote,
      totals,
      whatsappMessage,
      whatsappUrl,
    };

    const response = NextResponse.json({
      orderId: orderDbId,
      order: savedOrder,
    });
    logApiEvent(apiContext, "order_created", {
      orderId: orderDbId,
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
