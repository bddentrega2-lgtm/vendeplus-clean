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
import { isStoreSubscriptionPastDue } from "@/lib/supabase/catalog";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";
import { normalizePhone } from "@/lib/customers/normalize-phone";
import { safeUpsertCustomerFromOrder } from "@/lib/customers/upsert-customer-from-order";
import { getVenezuelaRelativeRange } from "@/lib/time/venezuela";
import { getStoreServiceFeeUsd } from "@/lib/plans";

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
  transport_agency_id,
  transport_agency_name,
  transport_agency_fee_usd,
  transport_agency_status,
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

const compactOrdersSelect = `
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
  transport_agency_id,
  transport_agency_name,
  transport_agency_fee_usd,
  transport_agency_status,
  total_usd,
  total_bs,
  distance_km,
  delivery_lat,
  delivery_lng,
  delivery_reference,
  status,
  whatsapp_message,
  created_at,
  stores (
    name,
    latitude,
    longitude,
    usd_to_bs
  ),
  order_integrations (
    order_id,
    provider,
    external_id,
    status,
    last_error,
    updated_at
  ),
  transport_orders (
    id,
    order_id,
    agency_id,
    agency_name_snapshot,
    agency_whatsapp_snapshot,
    status,
    delivery_fee_usd,
    agency_status_note,
    rejection_reason,
    updated_at
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

function cleanOrderSearch(value: unknown) {
  return cleanText(value)
    .replace(/[,.%()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
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
      selectedOptions: Array.isArray(item?.selectedOptions)
        ? item.selectedOptions
            .map((option: any) => ({
              groupId: cleanText(option?.groupId),
              valueId: cleanText(option?.valueId),
            }))
            .filter((option: any) => option.groupId && option.valueId)
        : [],
    }))
    .filter((item) => item.productId);
}

async function loadManualOptionAssignments(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  storeId: string,
  productIds: string[]
) {
  const { data, error } = await supabase
    .from("product_option_group_products")
    .select(`
      product_id,
      sort_order,
      product_option_groups (
        id,
        name,
        selection_type,
        required,
        min_select,
        max_select,
        is_active,
        product_option_values (
          id,
          name,
          price_delta_usd,
          is_active
        )
      )
    `)
    .eq("store_id", storeId)
    .in("product_id", productIds);

  if (error) throw error;

  const byProduct = new Map<string, any[]>();
  for (const assignment of data || []) {
    const productId = String((assignment as any).product_id);
    byProduct.set(productId, [...(byProduct.get(productId) || []), assignment]);
  }
  return byProduct;
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
  deliveryType: "delivery" | "pickup" | "table" | "bar";
  paymentMethod: string;
  deliveryReference: string;
  orderDetails: string;
  originalMessage: string;
  items: Array<{ product_name: string; quantity: number; total_usd: number; selectedOptions?: Array<{ groupName: string; valueName: string }> }>;
  subtotalUsd: number;
  deliveryUsd: number;
  totalUsd: number;
}) {
  const lines = [
    "Hola, ya está listo mi pedido.",
    `Código: ${publicCode}`,
    `Cliente: ${customerName}`,
    customerPhone ? `Telefono: ${customerPhone}` : "",
    `Modalidad: ${deliveryType === "delivery" ? "Delivery" : deliveryType === "pickup" ? "Retiro (pick up)" : deliveryType === "table" ? "Mesa" : "Barra"}`,
    paymentMethod ? `Pago: ${paymentMethod}` : "",
    deliveryReference ? `Referencia: ${deliveryReference}` : "",
    "",
    "Productos:",
    ...items.map(
      (item) => {
        const options = (item.selectedOptions || []).map((option) => option.valueName).join(", ");
        return `- ${item.quantity}x ${item.product_name}${options ? ` (${options})` : ""} ($${item.total_usd.toFixed(2)})`;
      }
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

async function attachTransportOrders(supabase: any, orders: any[], options: { includeEvents?: boolean } = {}) {
  if (!orders.length) return orders;

  try {
    const orderIds = orders.map((order) => order.id).filter(Boolean);
    const selectColumns = options.includeEvents === false
      ? `
        id,
        order_id,
        agency_id,
        agency_name_snapshot,
        agency_whatsapp_snapshot,
        status,
        delivery_fee_usd,
        agency_status_note,
        rejection_reason,
        updated_at
      `
      : `
        id,
        order_id,
        agency_id,
        agency_name_snapshot,
        agency_whatsapp_snapshot,
        status,
        delivery_fee_usd,
        agency_status_note,
        rejection_reason,
        updated_at,
        transport_order_events (
          id,
          event_type,
          status_from,
          status_to,
          note,
          actor_type,
          actor_name,
          created_at
        )
      `;
    const { data, error } = await supabase
      .from("transport_orders")
      .select(selectColumns)
      .in("order_id", orderIds)
      .order("updated_at", { ascending: false });

    if (error) return orders;

    const byOrder = new Map<string, any[]>();
    for (const entry of data || []) {
      const current = byOrder.get(entry.order_id) || [];
      current.push(entry);
      byOrder.set(entry.order_id, current);
    }

    return orders.map((order) => ({
      ...order,
      transport_orders: byOrder.get(order.id) || [],
    }));
  } catch {
    return orders;
  }
}

async function attachOrderRelations(
  supabase: any,
  orders: any[],
  options: { includeEvents?: boolean } = {}
) {
  if (!orders.length) return orders;

  const [withIntegrations, withTransport] = await Promise.all([
    attachOrderIntegrations(supabase, orders),
    attachTransportOrders(supabase, orders, options),
  ]);
  const integrationsByOrder = new Map(
    withIntegrations.map((order: any) => [order.id, order.order_integrations || []])
  );

  return withTransport.map((order: any) => ({
    ...order,
    order_integrations: integrationsByOrder.get(order.id) || [],
  }));
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
    transport_agency_id: order?.transport_agency_id || null,
    transport_agency_name: order?.transport_agency_name || null,
    transport_agency_fee_usd: order?.transport_agency_fee_usd ?? null,
    transport_agency_status: order?.transport_agency_status || null,
    stores: order?.stores
      ? {
          ...order.stores,
          payment_details: order.stores.payment_details || {},
        }
      : order?.stores,
  };
}

async function isOrderDeliveredByExternalDelivery(supabase: any, order: any) {
  if (
    order?.delivery_status === "delivered" ||
    order?.transport_agency_status === "delivered"
  ) {
    return true;
  }

  const [{ data: integrations }, { data: transportOrders }] = await Promise.all([
    supabase
      .from("order_integrations")
      .select("provider, status")
      .eq("order_id", order.id)
      .in("provider", ["entrega2", "transport_agency"]),
    supabase
      .from("transport_orders")
      .select("status")
      .eq("order_id", order.id),
  ]);

  return (
    (integrations || []).some((entry: any) =>
      ["delivered", "completed"].includes(entry.status)
    ) || (transportOrders || []).some((entry: any) => entry.status === "delivered")
  );
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
    const search = cleanOrderSearch(searchParams.get("search"));
    const compact = searchParams.get("compact") === "true";
    const requestedLimit = Number(searchParams.get("limit") || (compact ? 40 : 80));
    const limit = Math.min(80, Math.max(10, Number.isFinite(requestedLimit) ? requestedLimit : 40));
    const requestedOffset = Number(searchParams.get("offset") || 0);
    const offset = Math.max(0, Number.isFinite(requestedOffset) ? Math.floor(requestedOffset) : 0);
    const to = offset + limit;

    const buildQuery = (includePaymentFields: boolean) => {
      const client = supabase as any;
      const selectColumns = compact
        ? compactOrdersSelect
        : includePaymentFields
          ? ordersSelect
          : baseOrdersSelect;
      let query = client
        .from("orders")
        .select(selectColumns)
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
        if (deliveryType === "table" || deliveryType === "bar") {
          query = query.eq("delivery_pricing_type", deliveryType);
        } else if (deliveryType === "pickup") {
          query = query.eq("delivery_type", "pickup").is("delivery_pricing_type", null);
        } else {
          query = query.eq("delivery_type", deliveryType);
        }
      }

      if (search) {
        const pattern = `%${search}%`;
        query = query.or(
          [
            `public_code.ilike.${pattern}`,
            `customer_name.ilike.${pattern}`,
            `customer_phone.ilike.${pattern}`,
            `payment_method.ilike.${pattern}`,
            `delivery_reference.ilike.${pattern}`,
          ].join(",")
        );
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

      const [order] = await attachOrderRelations(supabase, data ? [withPaymentFallback(data)] : [], {
        includeEvents: true,
      });

      return NextResponse.json({ order: order || null });
    }

    query = applyDateFilter(query);

    let { data, error } = await query.range(offset, to);

    if (error) {
      let fallbackQuery = buildQuery(false);

      fallbackQuery = applyDateFilter(fallbackQuery);

      const fallbackResult = await fallbackQuery.range(offset, to);
      data = (fallbackResult.data || []).map(withPaymentFallback);
      error = fallbackResult.error;
    }

    if (error) throw error;

    const pageRows = data || [];
    const hasMore = pageRows.length > limit;
    const visibleRows = hasMore ? pageRows.slice(0, limit) : pageRows;

    const ordersWithTransport = compact
      ? visibleRows.map(withPaymentFallback)
      : await attachOrderRelations(supabase, visibleRows.map(withPaymentFallback), {
          includeEvents: true,
        });

    return NextResponse.json({
      orders: ordersWithTransport,
      page: {
        limit,
        offset,
        nextOffset: offset + ordersWithTransport.length,
        hasMore,
      },
      auth: {
        mode: auth.mode,
        email: auth.email || null,
        role: auth.role || null,
        storeIds: auth.storeIds || [],
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
    const deliveryType: "delivery" | "pickup" | "table" | "bar" =
      body.deliveryType === "pickup" || body.deliveryType === "table" || body.deliveryType === "bar"
        ? body.deliveryType
        : "delivery";
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

    const isOnPremise = deliveryType === "table" || deliveryType === "bar";
    if (!isOnPremise && !customerName) return badRequest("El nombre del cliente es obligatorio.");
    if (!isOnPremise && !customerPhone) return badRequest("El teléfono del cliente es obligatorio.");
    if (deliveryType === "table" && !deliveryReference) {
      return badRequest("Indica el número o nombre de la mesa.");
    }
    if (!paymentMethod) return badRequest("Selecciona un método de pago.");
    if (!requestedItems.length) return badRequest("Agrega al menos un producto.");

    const supabase = createSupabaseAdminClient();

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, usd_to_bs, plan_type, monthly_price_usd, service_fee_payer, service_fee_billing_cycle, subscription_status, trial_ends_at, subscription_ends_at, next_payment_due_at")
      .eq("id", storeId)
      .single();

    if (storeError) throw storeError;
    if (isStoreSubscriptionPastDue(store as any)) {
      return badRequest("La suscripcion de este comercio esta vencida. Elige un plan en Suscripcion para volver a crear pedidos.");
    }

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

    const optionAssignments = await loadManualOptionAssignments(supabase, storeId, productIds);

    const itemsPayload = requestedItems.map((item) => {
      const product: any = productMap.get(item.productId);

      if (product.is_available === false) {
        throw new Error(`El producto ${product.name} no está disponible.`);
      }

      const groups = (optionAssignments.get(item.productId) || [])
        .map((assignment) => assignment.product_option_groups)
        .filter((group) => group && group.is_active !== false);
      const selectedByGroup = new Map<string, string[]>();

      for (const option of item.selectedOptions) {
        selectedByGroup.set(option.groupId, [
          ...(selectedByGroup.get(option.groupId) || []),
          option.valueId,
        ]);
      }

      const frozenOptions = groups.flatMap((group: any) => {
        const selectedValueIds = selectedByGroup.get(String(group.id)) || [];
        const values = Array.isArray(group.product_option_values)
          ? group.product_option_values.filter((value: any) => value.is_active !== false)
          : [];
        const minSelect = group.required ? Math.max(1, toSafeNumber(group.min_select, 1)) : 0;
        const maxSelect = toSafeNumber(group.max_select, group.selection_type === "single" ? 1 : 0);

        if (selectedValueIds.length < minSelect) {
          throw new Error(minSelect === 1
            ? `Selecciona una opción para ${group.name}.`
            : `Selecciona ${minSelect} opciones para ${group.name}.`);
        }
        if (maxSelect > 0 && selectedValueIds.length > maxSelect) {
          throw new Error(`Seleccionaste demasiadas opciones en ${group.name}.`);
        }
        if (group.selection_type === "single" && selectedValueIds.length > 1) {
          throw new Error(`Solo puedes seleccionar una opción en ${group.name}.`);
        }

        return selectedValueIds.map((valueId) => {
          const value = values.find((entry: any) => String(entry.id) === valueId);
          if (!value) throw new Error(`Una opción de ${group.name} ya no está disponible.`);
          return {
            groupName: group.name || "Opciones",
            valueName: value.name || "Opción",
            priceDeltaUsd: Math.max(0, toSafeNumber(value.price_delta_usd, 0)),
          };
        });
      });

      const optionExtraUsd = frozenOptions.reduce(
        (sum, option) => sum + option.priceDeltaUsd,
        0
      );
      const unitPriceUsd = toSafeNumber(product.price_usd, 0) + optionExtraUsd;
      const totalUsd = unitPriceUsd * item.quantity;

      return {
        product_id: item.productId,
        product_name: product.name || "Producto",
        variant_name: null,
        quantity: item.quantity,
        unit_price_usd: unitPriceUsd,
        total_usd: totalUsd,
        notes: item.notes || null,
        selectedOptions: frozenOptions,
      };
    });

    const subtotalUsd = itemsPayload.reduce(
      (sum, item) => sum + toSafeNumber(item.total_usd),
      0
    );
    const deliveryUsd =
      deliveryType === "delivery" ? Math.max(0, toSafeNumber(body.deliveryUsd, 0)) : 0;
    const platformServiceFeeUsd = getStoreServiceFeeUsd(store as any);
    const platformServiceFeePayer = (store as any).service_fee_payer === "customer" ? "customer" : "merchant";
    const platformServiceFeeCustomerUsd = platformServiceFeePayer === "customer" ? platformServiceFeeUsd : 0;
    const totalUsd = subtotalUsd + deliveryUsd + platformServiceFeeCustomerUsd;
    const usdToBs = toSafeNumber((store as any)?.usd_to_bs, 600);
    const totalBs = totalUsd * usdToBs;
    const orderId = randomUUID();
    const publicCode = createManualPublicCode();
    const effectiveCustomerName = customerName || (deliveryType === "table" ? "Cliente de mesa" : "Cliente de barra");
    const storedDeliveryType: "delivery" | "pickup" = deliveryType === "delivery" ? "delivery" : "pickup";
    const serviceModeLabel = deliveryType === "table" ? "Mesa" : deliveryType === "bar" ? "Barra" : null;
    const whatsappMessage = buildManualMessage({
      publicCode,
      customerName: effectiveCustomerName,
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
      customer_name: effectiveCustomerName,
      customer_phone: customerPhone || "",
      customer_phone_normalized: normalizePhone(customerPhone) || null,
      delivery_type: storedDeliveryType,
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
      delivery_pricing_type: deliveryType === "delivery" ? "manual" : serviceModeLabel ? deliveryType : null,
      delivery_status: deliveryType === "delivery" ? "pending" : "pickup",
      delivery_notes: deliveryType === "delivery" ? "Pedido manual." : serviceModeLabel ? `Atención en ${serviceModeLabel.toLowerCase()}.` : null,
      delivery_address: deliveryType === "delivery" ? deliveryReference || null : null,
      total_usd: totalUsd,
      total_bs: totalBs,
      platform_service_fee_usd: platformServiceFeeUsd,
      platform_service_fee_payer: platformServiceFeeUsd > 0 ? platformServiceFeePayer : null,
      platform_service_fee_customer_usd: platformServiceFeeCustomerUsd,
      platform_service_fee_billing_cycle: platformServiceFeeUsd > 0 ? "monthly" : null,
      distance_km: null,
      delivery_lat: null,
      delivery_lng: null,
      delivery_reference: deliveryReference || null,
      order_details: orderDetails || null,
      notes: originalMessage
        ? `Pedido manual. Mensaje recibido: ${originalMessage}`
        : serviceModeLabel
          ? `Pedido manual · ${serviceModeLabel}.`
          : "Pedido manual.",
      status: "received",
      whatsapp_message: whatsappMessage,
    };

    let { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderPayload)
      .select()
      .single();

    if (orderError && isMissingColumnError(orderError, ["payment_", "customer_", "delivery_", "platform_service_"])) {
      const {
        payment_status: _paymentStatus,
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

    const { data: insertedItems, error: itemsError } = await supabase.from("order_items").insert(
      itemsPayload.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        variant_name: item.variant_name,
        quantity: item.quantity,
        unit_price_usd: item.unit_price_usd,
        total_usd: item.total_usd,
        notes: item.notes,
        order_id: orderId,
      }))
    ).select("id");

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", orderId);
      throw itemsError;
    }

    const optionRows = itemsPayload.flatMap((item, index) => {
      const orderItemId = insertedItems?.[index]?.id;
      if (!orderItemId) return [];
      return item.selectedOptions.map((option) => ({
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
        await supabase.from("orders").delete().eq("id", orderId);
        throw optionsError;
      }
    }

    if (customerPhone) {
      await safeUpsertCustomerFromOrder(supabase, {
        id: orderId,
        store_id: storeId,
        customer_name: effectiveCustomerName,
        customer_phone: customerPhone,
        delivery_type: storedDeliveryType,
        payment_method: paymentMethod,
        delivery_reference: deliveryReference || null,
        total_usd: totalUsd,
        created_at: new Date().toISOString(),
      });
    }

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
      .select("id, store_id, delivery_status, transport_agency_status")
      .eq("id", id)
      .single();

    if (existingError) throw existingError;

    assertStoreAccess(
      auth,
      existingOrder.store_id,
      "No tienes permiso para operar este pedido."
    );

    const { data: activeTransportOrder, error: activeTransportError } = await supabase
      .from("transport_orders")
      .select("id, status")
      .eq("order_id", id)
      .not("status", "in", "(agency_rejected,cancelled,delivery_failed)")
      .maybeSingle();

    if (activeTransportError) throw activeTransportError;

    if (activeTransportOrder?.id) {
      return badRequest("La empresa delivery ya recibio este pedido. El estado operativo lo actualiza la empresa delivery.");
    }

    if (
      status === "cancelled" &&
      (await isOrderDeliveredByExternalDelivery(supabase, existingOrder))
    ) {
      return badRequest("No puedes cancelar un pedido ya entregado por la empresa delivery.");
    }

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
