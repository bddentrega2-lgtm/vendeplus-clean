import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { CartItem, SavedOrder, Store } from "@/types";
import { getInitialPaymentStatus, getSuggestedPaymentCurrency } from "@/lib/payments";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";
import { normalizePhone } from "@/lib/customers/normalize-phone";
import { safeUpsertCustomerFromOrder } from "@/lib/customers/upsert-customer-from-order";
import {
  calculateDeliveryQuoteFromSettings,
  calculateRouteDistanceKm,
  mapStoreDeliverySettings,
} from "@/lib/delivery";
import { getStoreOpenState } from "@/lib/business-hours";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

const MAX_ORDER_BODY_BYTES = 180_000;
const MAX_ORDER_ITEMS = 80;
const MAX_ITEM_QUANTITY = 99;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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
          sort_order
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
  storeId: string
) {
  const row: any = { id: storeId };

  try {
    const [settingsResult, zonesResult, ratesResult] = await Promise.all([
      supabase
        .from("store_delivery_settings")
        .select("*")
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
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);

    if (contentLength > MAX_ORDER_BODY_BYTES) {
      return NextResponse.json(
        { error: "El pedido es demasiado grande. Reduce productos o notas." },
        { status: 413 }
      );
    }

    const clientIp = getClientIp(request);
    const globalLimit = checkRateLimit({
      key: `orders:ip:${clientIp}`,
      limit: 60,
      windowMs: 10 * 60 * 1000,
    });

    if (!globalLimit.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espera unos minutos y vuelve a intentar." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const order = body.order as SavedOrder | undefined;
    const storeId = cleanText(body.storeId);

    if (!order || !storeId) return badRequest("Pedido inválido.");

    const storeLimit = checkRateLimit({
      key: `orders:store:${storeId}:ip:${clientIp}`,
      limit: 24,
      windowMs: 10 * 60 * 1000,
    });

    if (!storeLimit.allowed) {
      return NextResponse.json(
        { error: "Demasiados pedidos para este comercio desde esta conexión. Intenta de nuevo en unos minutos." },
        { status: 429 }
      );
    }

    const items = normalizeItems(order.items);
    if (!items.length) return badRequest("Tu carrito está vacío.");
    if (!cleanText(order.form?.customerName)) {
      return badRequest("Escribe el nombre del cliente.");
    }
    if (!cleanText(order.form?.customerPhone)) {
      return badRequest("Escribe el teléfono del cliente.");
    }
    if (!cleanText(order.form?.paymentMethod)) {
      return badRequest("Selecciona un método de pago.");
    }

    const supabase = createSupabaseAdminClient();
    let storeResult = await supabase
      .from("stores")
      .select("id, slug, name, whatsapp, usd_to_bs, is_active, latitude, longitude, opening_hours, business_hours, manual_open_status, manual_open_note, accepts_delivery, accepts_pickup")
      .eq("id", storeId)
      .single();

    if (
      storeResult.error &&
      isMissingColumnError(storeResult.error, [
        "business_hours",
        "manual_open_status",
        "manual_open_note",
      ])
    ) {
      storeResult = await supabase
        .from("stores")
        .select("id, slug, name, whatsapp, usd_to_bs, is_active, latitude, longitude, accepts_delivery, accepts_pickup")
        .eq("id", storeId)
        .single();
    }

    const { data: store, error: storeError } = storeResult;

    if (storeError) throw storeError;
    if (!store || (store as any).is_active === false) {
      return badRequest("El comercio no está disponible.");
    }

    const openState = getStoreOpenState({
      manualOpenStatus: (store as any).manual_open_status,
      manualOpenNote: (store as any).manual_open_note,
      businessHours: (store as any).business_hours,
      openingHoursText: (store as any).opening_hours,
    });

    if (!openState.isOpen) {
      return badRequest(`${openState.label}. El comercio no está recibiendo pedidos en este momento.`);
    }

    const productIds = Array.from(new Set(items.map((item) => item.productId)));
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, store_id, name, price_usd, image_url, is_available")
      .eq("store_id", storeId)
      .in("id", productIds);

    if (productsError) throw productsError;

    const productMap = new Map(
      (products || []).map((product: any) => [String(product.id), product])
    );

    if (productMap.size !== productIds.length) {
      return badRequest("Uno o más productos no pertenecen al comercio.");
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
      let unitPriceUsd = basePriceUsd;
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
        unitPriceUsd = toSafeNumber(variant.price_usd, basePriceUsd);
      }

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
          throw new Error(`Selecciona una opción para ${group.name}.`);
        }
        if (maxSelect > 0 && selectedValueIds.length > maxSelect) {
          throw new Error(`Seleccionaste demasiadas opciones en ${group.name}.`);
        }
        if (group.selection_type === "single" && selectedValueIds.length > 1) {
          throw new Error(`Solo puedes elegir una opción en ${group.name}.`);
        }

        return selectedValueIds.map((valueId) => {
          const value = values.find((entry: any) => String(entry.id) === valueId);
          if (!value) {
            throw new Error(`Una opción de ${group.name} ya no está disponible.`);
          }

          return {
            groupId: String(group.id),
            groupName: group.name || "Opciones",
            valueId: String(value.id),
            valueName: value.name || "Opción",
            priceDeltaUsd: toSafeNumber(value.price_delta_usd, 0),
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
    const deliverySettings = await loadStoreDeliverySettings(supabase, storeId);

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
    const serverQuote = calculateDeliveryQuoteFromSettings({
      settings: deliverySettings,
      deliveryType: order.form.deliveryType === "pickup" ? "pickup" : "delivery",
      subtotalUsd,
      distanceKm: serverDistanceKm,
      zoneId: order.form.deliveryZoneId || order.quote.zoneId || null,
      source: serverDistance?.source || "manual",
    });

    if (serverQuote.available === false) {
      return badRequest(serverQuote.message || serverQuote.label || "La modalidad de entrega no está disponible.");
    }
    if (order.form.deliveryType === "delivery" && serverQuote.source === "pending") {
      return badRequest(serverQuote.label || "Completa los datos de entrega.");
    }

    const deliveryUsd = order.form.deliveryType === "delivery" ? serverQuote.feeUsd : 0;
    const totalUsd = subtotalUsd + deliveryUsd;
    const totalBs = totalUsd * toSafeNumber((store as any).usd_to_bs, 600);
    const totals = { subtotalUsd, deliveryUsd, totalUsd, totalBs };
    const publicCode = cleanText(order.id) || `VP-${randomUUID().slice(0, 3).toUpperCase()}`;
    const storeForMessage = {
      name: (store as any).name || order.storeName || "Comercio",
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
      customer_name: cleanText(order.form.customerName),
      customer_phone: cleanText(order.form.customerPhone),
      customer_phone_normalized: normalizePhone(order.form.customerPhone) || null,
      delivery_type: order.form.deliveryType === "pickup" ? "pickup" : "delivery",
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
      delivery_reference: order.form.deliveryReference || null,
      delivery_provider: order.form.deliveryType === "delivery" ? serverQuote.provider || null : null,
      delivery_fee_usd: deliveryUsd,
      delivery_zone_id: serverQuote.zoneId || null,
      delivery_zone_name: serverQuote.zoneName || null,
      delivery_distance_km: serverQuote.distanceKm,
      delivery_pricing_type: serverQuote.pricingType || null,
      delivery_status:
        order.form.deliveryType === "delivery"
          ? serverQuote.provider === "entrega2"
            ? "pending_entrega2"
            : "pending"
          : "pickup",
      delivery_notes: serverQuote.message || null,
      delivery_address: order.form.deliveryReference || null,
      order_details: order.form.orderDetails || null,
      notes: order.form.notes || null,
      status: "received",
      whatsapp_message: whatsappMessage,
    };

    let { error: orderError } = await supabase.from("orders").insert(orderPayload);

    if (orderError && isMissingColumnError(orderError, ["payment_", "customer_", "delivery_"])) {
      const {
        payment_status: _paymentStatus,
        payment_reference: _paymentReference,
        payment_currency: _paymentCurrency,
        customer_phone_normalized: _customerPhoneNormalized,
        delivery_provider: _deliveryProvider,
        delivery_fee_usd: _deliveryFeeUsd,
        delivery_zone_id: _deliveryZoneId,
        delivery_zone_name: _deliveryZoneName,
        delivery_distance_km: _deliveryDistanceKm,
        delivery_pricing_type: _deliveryPricingType,
        delivery_status: _deliveryStatus,
        delivery_notes: _deliveryNotes,
        delivery_address: _deliveryAddress,
        ...baseOrderPayload
      } = orderPayload;
      const fallbackResult = await supabase.from("orders").insert(baseOrderPayload);
      orderError = fallbackResult.error;
    }

    if (orderError) throw orderError;

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

    await safeUpsertCustomerFromOrder(supabase, {
      id: orderDbId,
      store_id: storeId,
      customer_name: cleanText(order.form.customerName),
      customer_phone: cleanText(order.form.customerPhone),
      delivery_type: order.form.deliveryType === "pickup" ? "pickup" : "delivery",
      payment_method: cleanText(order.form.paymentMethod),
      delivery_reference: order.form.deliveryReference || null,
      total_usd: totalUsd,
      created_at: new Date().toISOString(),
    });

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

    return NextResponse.json({
      orderId: orderDbId,
      order: savedOrder,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "No se pudo guardar el pedido." },
      { status: 500 }
    );
  }
}
