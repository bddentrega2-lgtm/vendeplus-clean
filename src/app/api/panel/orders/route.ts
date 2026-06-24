import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";
import {
  assertStoreAccess,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { getInitialPaymentStatus, getSuggestedPaymentCurrency, isPaymentStatus } from "@/lib/payments";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";
import { normalizePhone } from "@/lib/customers/normalize-phone";
import { safeUpsertCustomerFromOrder } from "@/lib/customers/upsert-customer-from-order";
import { getVenezuelaRelativeRange } from "@/lib/time/venezuela";

const allowedStatuses = [
  "received",
  "accepted",
  "preparing",
  "ready",
  "delivering",
  "completed",
  "cancelled",
];

const ordersSelect = `
  id,
  public_code,
  store_id,
  customer_id,
  customer_name,
  customer_phone,
  delivery_type,
  payment_method,
  payment_status,
  payment_reference,
  payment_currency,
  amount_paid,
  payment_verified_at,
  payment_notes,
  payment_bank,
  payment_verified_by,
  subtotal_usd,
  delivery_usd,
  delivery_provider,
  delivery_fee_usd,
  delivery_zone_id,
  delivery_zone_name,
  delivery_distance_km,
  delivery_pricing_type,
  delivery_status,
  delivery_notes,
  delivery_address,
  total_usd,
  total_bs,
  distance_km,
  delivery_lat,
  delivery_lng,
  delivery_reference,
  order_details,
  notes,
  status,
  whatsapp_message,
  created_at,
  stores (
    name,
    latitude,
    longitude,
    usd_to_bs,
    payment_details
  ),
  customers (
    id,
    orders_count,
    total_spent_usd
  ),
  order_items (
    id,
    product_name,
    variant_name,
    quantity,
    unit_price_usd,
    total_usd,
    notes,
    order_item_options (
      id,
      option_group_name,
      option_name,
      price_delta_usd,
      quantity
    )
  )
`;

const baseOrdersSelect = `
  id,
  public_code,
  store_id,
  customer_id,
  customer_name,
  customer_phone,
  delivery_type,
  payment_method,
  subtotal_usd,
  delivery_usd,
  total_usd,
  total_bs,
  distance_km,
  delivery_lat,
  delivery_lng,
  delivery_reference,
  order_details,
  notes,
  status,
  whatsapp_message,
  created_at,
  stores (
    name,
    latitude,
    longitude,
    usd_to_bs
  ),
  order_items (
    id,
    product_name,
    variant_name,
    quantity,
    unit_price_usd,
    total_usd,
    notes
  )
`;

function createManualPublicCode() {
  const now = new Date();
  const dayCode = `${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const suffix = randomUUID().slice(0, 3).toUpperCase();
  return `VP-${dayCode}-${suffix}`;
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function toSafeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeManualItems(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      productId: cleanText(item?.productId),
      quantity: Math.max(1, Math.floor(toSafeNumber(item?.quantity, 1))),
      notes: cleanText(item?.notes),
    }))
    .filter((item) => item.productId);
}

function buildManualMessage({
  publicCode,
  customerName,
  customerPhone,
  deliveryType,
  paymentMethod,
  deliveryReference,
  orderDetails,
  originalMessage,
  items,
  subtotalUsd,
  deliveryUsd,
  totalUsd,
}: {
  publicCode: string;
  customerName: string;
  customerPhone: string;
  deliveryType: "delivery" | "pickup";
  paymentMethod: string;
  deliveryReference: string;
  orderDetails: string;
  originalMessage: string;
  items: Array<{ product_name: string; quantity: number; total_usd: number }>;
  subtotalUsd: number;
  deliveryUsd: number;
  totalUsd: number;
}) {
  const lines = [
    "Hola, ya está listo mi pedido.",
    `Código: ${publicCode}`,
    `Cliente: ${customerName}`,
    customerPhone ? `Telefono: ${customerPhone}` : "",
    `Modalidad: ${deliveryType === "delivery" ? "Delivery" : "Retiro (pick up)"}`,
    paymentMethod ? `Pago: ${paymentMethod}` : "",
    deliveryReference ? `Referencia: ${deliveryReference}` : "",
    "",
    "Productos:",
    ...items.map(
      (item) => `- ${item.quantity}x ${item.product_name} ($${item.total_usd.toFixed(2)})`
    ),
    "",
    `Subtotal: $${subtotalUsd.toFixed(2)}`,
    `Entrega: $${deliveryUsd.toFixed(2)}`,
    `Total: $${totalUsd.toFixed(2)}`,
    orderDetails ? `Nota: ${orderDetails}` : "",
    originalMessage ? `Mensaje original: ${originalMessage}` : "",
  ];

  return lines.filter(Boolean).join("\n");
}

async function attachOrderIntegrations(supabase: any, orders: any[]) {
  if (!orders.length) return orders;

  try {
    const orderIds = orders.map((order) => order.id).filter(Boolean);
    const { data, error } = await supabase
      .from("order_integrations")
      .select("order_id, provider, external_id, status, last_error, updated_at")
      .in("order_id", orderIds);

    if (error) return orders;

    const integrationsByOrder = new Map<string, any[]>();
    for (const integration of data || []) {
      const current = integrationsByOrder.get(integration.order_id) || [];
      current.push(integration);
      integrationsByOrder.set(integration.order_id, current);
    }

    return orders.map((order) => ({
      ...order,
      order_integrations: integrationsByOrder.get(order.id) || [],
    }));
  } catch {
    return orders;
  }
}

function withPaymentFallback(order: any) {
  return {
    ...order,
    payment_status:
      order?.payment_status || getInitialPaymentStatus(order?.payment_method),
    payment_reference: order?.payment_reference || null,
    payment_currency:
      order?.payment_currency ||
      getSuggestedPaymentCurrency(order?.payment_method) ||
      null,
    amount_paid: order?.amount_paid ?? null,
    payment_verified_at: order?.payment_verified_at || null,
    payment_notes: order?.payment_notes || null,
    payment_bank: order?.payment_bank || null,
    payment_verified_by: order?.payment_verified_by || null,
    delivery_provider: order?.delivery_provider || null,
    delivery_fee_usd: order?.delivery_fee_usd ?? order?.delivery_usd ?? null,
    delivery_zone_id: order?.delivery_zone_id || null,
    delivery_zone_name: order?.delivery_zone_name || null,
    delivery_distance_km: order?.delivery_distance_km ?? order?.distance_km ?? null,
    delivery_pricing_type: order?.delivery_pricing_type || null,
    delivery_status: order?.delivery_status || null,
    delivery_notes: order?.delivery_notes || null,
    delivery_address: order?.delivery_address || order?.delivery_reference || null,
    stores: order?.stores
      ? {
          ...order.stores,
          payment_details: order.stores.payment_details || {},
        }
      : order?.stores,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const orderId = searchParams.get("orderId");
    const paymentMethod = searchParams.get("paymentMethod");
    const paymentStatus = searchParams.get("paymentStatus");
    const deliveryType = searchParams.get("deliveryType");
    const date = searchParams.get("date");

    const buildQuery = (includePaymentFields: boolean) => {
      const client = supabase as any;
      let query = client
        .from("orders")
        .select(includePaymentFields ? ordersSelect : baseOrdersSelect)
        .order("created_at", { ascending: false });

      if (auth.storeIds !== null) {
        query = query.in("store_id", auth.storeIds);
      }

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      if (paymentMethod && paymentMethod !== "all") {
        query = query.eq("payment_method", paymentMethod);
      }

      if (
        includePaymentFields &&
        paymentStatus &&
        paymentStatus !== "all" &&
        isPaymentStatus(paymentStatus)
      ) {
        query = query.eq("payment_status", paymentStatus);
      }

      if (deliveryType && deliveryType !== "all") {
        query = query.eq("delivery_type", deliveryType);
      }

      return query;
    };

    let query = buildQuery(true);

    const applyDateFilter = (targetQuery: any) => {
      if (!date || date === "all") return targetQuery;
      if (!["today", "last_7_days", "last_30_days"].includes(date)) return targetQuery;

      const range = getVenezuelaRelativeRange(
        date as "today" | "last_7_days" | "last_30_days"
      );

      return targetQuery
        .gte("created_at", range.start.toISOString())
        .lte("created_at", range.end.toISOString());
    };

    if (orderId) {
      let { data, error } = await query.eq("id", orderId).maybeSingle();

      if (error) {
        const fallbackResult = await buildQuery(false).eq("id", orderId).maybeSingle();
        data = fallbackResult.data ? withPaymentFallback(fallbackResult.data) : null;
        error = fallbackResult.error;
      }

      if (error) throw error;

      const [order] = await attachOrderIntegrations(
        supabase,
        data ? [withPaymentFallback(data)] : []
      );

      return NextResponse.json({ order: order || null });
    }

    query = applyDateFilter(query);

    let { data, error } = await query.limit(80);

    if (error) {
      let fallbackQuery = buildQuery(false);

      fallbackQuery = applyDateFilter(fallbackQuery);

      const fallbackResult = await fallbackQuery.limit(80);
      data = (fallbackResult.data || []).map(withPaymentFallback);
      error = fallbackResult.error;
    }

    if (error) throw error;

    const orders = await attachOrderIntegrations(
      supabase,
      (data || []).map(withPaymentFallback)
    );

    return NextResponse.json({
      orders,
      auth: {
        mode: auth.mode,
        email: auth.email || null,
        role: auth.role || null,
      },
    });
  } catch (error: any) {
    return panelErrorResponse(error, "Error cargando pedidos.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();

    const storeId = cleanText(body.storeId);
    const customerName = cleanText(body.customerName);
    const customerPhone = cleanText(body.customerPhone);
    const deliveryType: "delivery" | "pickup" =
      body.deliveryType === "pickup" ? "pickup" : "delivery";
    const paymentMethod = cleanText(body.paymentMethod);
    const deliveryReference = cleanText(body.deliveryReference);
    const orderDetails = cleanText(body.orderDetails);
    const originalMessage = cleanText(body.originalMessage);
    const requestedItems = normalizeManualItems(body.items);

    if (!storeId) return badRequest("Selecciona un comercio.");
    assertStoreAccess(
      auth,
      storeId,
      "No tienes permiso para crear pedidos en este comercio."
    );

    if (!customerName) return badRequest("El nombre del cliente es obligatorio.");
    if (!customerPhone) return badRequest("El teléfono del cliente es obligatorio.");
    if (!paymentMethod) return badRequest("Selecciona un método de pago.");
    if (!requestedItems.length) return badRequest("Agrega al menos un producto.");

    const supabase = createSupabaseAdminClient();

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, usd_to_bs")
      .eq("id", storeId)
      .single();

    if (storeError) throw storeError;

    const productIds = Array.from(
      new Set(requestedItems.map((item) => item.productId))
    );
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, store_id, name, price_usd, is_available")
      .eq("store_id", storeId)
      .in("id", productIds);

    if (productsError) throw productsError;

    const productMap = new Map(
      (products || []).map((product: any) => [String(product.id), product])
    );

    if (productMap.size !== productIds.length) {
      return badRequest("Uno o más productos no pertenecen al comercio seleccionado.");
    }

    const itemsPayload = requestedItems.map((item) => {
      const product: any = productMap.get(item.productId);

      if (product.is_available === false) {
        throw new Error(`El producto ${product.name} no está disponible.`);
      }

      const unitPriceUsd = toSafeNumber(product.price_usd, 0);
      const totalUsd = unitPriceUsd * item.quantity;

      return {
        product_id: item.productId,
        product_name: product.name || "Producto",
        variant_name: null,
        quantity: item.quantity,
        unit_price_usd: unitPriceUsd,
        total_usd: totalUsd,
        notes: item.notes || null,
      };
    });

    const subtotalUsd = itemsPayload.reduce(
      (sum, item) => sum + toSafeNumber(item.total_usd),
      0
    );
    const deliveryUsd =
      deliveryType === "delivery" ? Math.max(0, toSafeNumber(body.deliveryUsd, 0)) : 0;
    const totalUsd = subtotalUsd + deliveryUsd;
    const usdToBs = toSafeNumber((store as any)?.usd_to_bs, 600);
    const totalBs = totalUsd * usdToBs;
    const orderId = randomUUID();
    const publicCode = createManualPublicCode();
    const whatsappMessage = buildManualMessage({
      publicCode,
      customerName,
      customerPhone,
      deliveryType,
      paymentMethod,
      deliveryReference,
      orderDetails,
      originalMessage,
      items: itemsPayload,
      subtotalUsd,
      deliveryUsd,
      totalUsd,
    });

    const orderPayload = {
      id: orderId,
      public_code: publicCode,
      store_id: storeId,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_phone_normalized: normalizePhone(customerPhone) || null,
      delivery_type: deliveryType,
      payment_method: paymentMethod,
      payment_status: getInitialPaymentStatus(paymentMethod),
      payment_currency: getSuggestedPaymentCurrency(paymentMethod) || null,
      subtotal_usd: subtotalUsd,
    delivery_usd: deliveryUsd,
      delivery_provider:
        deliveryType === "delivery" ? cleanText(body.deliveryProvider) || "own_delivery" : null,
      delivery_fee_usd: deliveryUsd,
      delivery_zone_id: null,
      delivery_zone_name: cleanText(body.deliveryZoneName) || null,
      delivery_distance_km: null,
      delivery_pricing_type: deliveryType === "delivery" ? "manual" : null,
      delivery_status: deliveryType === "delivery" ? "pending" : "pickup",
      delivery_notes: deliveryType === "delivery" ? "Pedido manual asistido." : null,
      delivery_address: deliveryType === "delivery" ? deliveryReference || null : null,
      total_usd: totalUsd,
      total_bs: totalBs,
      distance_km: null,
      delivery_lat: null,
      delivery_lng: null,
      delivery_reference: deliveryType === "delivery" ? deliveryReference || null : null,
      order_details: orderDetails || null,
      notes: originalMessage
        ? `Pedido manual asistido. Mensaje recibido: ${originalMessage}`
        : "Pedido manual asistido.",
      status: "received",
      whatsapp_message: whatsappMessage,
    };

    let { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderPayload)
      .select()
      .single();

    if (orderError && isMissingColumnError(orderError, ["payment_", "customer_", "delivery_"])) {
      const {
        payment_status: _paymentStatus,
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

      const fallbackResult = await supabase
        .from("orders")
        .insert(baseOrderPayload)
        .select()
        .single();

      order = fallbackResult.data;
      orderError = fallbackResult.error;
    }

    if (orderError) throw orderError;

    const { error: itemsError } = await supabase.from("order_items").insert(
      itemsPayload.map((item) => ({
        ...item,
        order_id: orderId,
      }))
    );

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", orderId);
      throw itemsError;
    }

    await safeUpsertCustomerFromOrder(supabase, {
      id: orderId,
      store_id: storeId,
      customer_name: customerName,
      customer_phone: customerPhone,
      delivery_type: deliveryType,
      payment_method: paymentMethod,
      delivery_reference: deliveryReference || null,
      total_usd: totalUsd,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      order,
      items: itemsPayload,
      store: {
        id: storeId,
        name: (store as any)?.name || "Comercio",
      },
    });
  } catch (error: any) {
    return panelErrorResponse(error, "Error creando pedido manual.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const id = body.id;
    const status = body.status;

    if (!id) {
      return badRequest("Falta el ID del pedido.");
    }

    if (!allowedStatuses.includes(status)) {
      return badRequest("Estado inválido.");
    }

    const supabase = createSupabaseAdminClient();

    const { data: existingOrder, error: existingError } = await supabase
      .from("orders")
      .select("id, store_id")
      .eq("id", id)
      .single();

    if (existingError) throw existingError;

    assertStoreAccess(
      auth,
      existingOrder.store_id,
      "No tienes permiso para operar este pedido."
    );

    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ order: data });
  } catch (error: any) {
    return panelErrorResponse(error, "Error actualizando pedido.");
  }
}
