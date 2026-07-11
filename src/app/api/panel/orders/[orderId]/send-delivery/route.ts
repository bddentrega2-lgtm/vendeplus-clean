import { NextRequest, NextResponse } from "next/server";
import {
  getEntrega2ExternalOrderId,
  getEntrega2Provider,
  sendEntrega2Order,
} from "@/lib/integrations/entrega2";
import {
  assertStoreAccess,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  attachApiResponseHeaders,
  createApiRequestContext,
  logApiError,
  logApiEvent,
} from "@/lib/server/observability";
import {
  insertTransportOrderEvent,
  mapTransportStatusToOrderDeliveryStatus,
  normalizeTransportOrderStatus,
} from "@/lib/transport/orders";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function optionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Error desconocido enviando a Entrega2.";
}

function buildWhatsappUrl(phone: string, message: string) {
  const cleanPhone = cleanText(phone).replace(/[^0-9]/g, "");
  if (!cleanPhone) return null;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

function buildEntrega2Payload(order: any) {
  const externalOrderId = getEntrega2ExternalOrderId(order.id);

  return {
    externalOrderId,
    orderId: order.id,
    publicCode: order.public_code,
    source: "vendeplus",
    store: {
      id: order.store_id,
      name: order.stores?.name || "Comercio",
      phone: order.stores?.whatsapp || null,
      address: order.stores?.address || null,
      latitude: optionalNumber(order.stores?.latitude),
      longitude: optionalNumber(order.stores?.longitude),
    },
    customer: {
      name: order.customer_name,
      phone: order.customer_phone,
    },
    delivery: {
      reference: order.delivery_reference,
      notes: order.order_details || order.notes || null,
      latitude: optionalNumber(order.delivery_lat),
      longitude: optionalNumber(order.delivery_lng),
      distanceKm: optionalNumber(order.distance_km),
    },
    payment: {
      method: order.payment_method,
      subtotalUsd: optionalNumber(order.subtotal_usd) || 0,
      deliveryUsd: optionalNumber(order.delivery_usd) || 0,
      totalUsd: optionalNumber(order.total_usd) || 0,
      totalBs: optionalNumber(order.total_bs) || 0,
    },
    items: (order.order_items || []).map((item: any) => ({
      name: item.product_name,
      variant: item.variant_name || null,
      quantity: optionalNumber(item.quantity) || 1,
      unitPriceUsd: optionalNumber(item.unit_price_usd) || 0,
      totalUsd: optionalNumber(item.total_usd) || 0,
      notes: item.notes || null,
    })),
  };
}

function buildTransportAgencyMessage(order: any, agency: any, transportOrder?: any) {
  const mapsUrl =
    optionalNumber(order.delivery_lat) !== null && optionalNumber(order.delivery_lng) !== null
      ? `https://www.google.com/maps/search/?api=1&query=${order.delivery_lat},${order.delivery_lng}`
      : "";
  const paymentStatus = cleanText(order.payment_status) || "pending";
  const items = (order.order_items || []).map((item: any) => {
    const quantity = optionalNumber(item.quantity) || 1;
    const totalUsd = optionalNumber(item.total_usd) || 0;
    const variant = cleanText(item.variant_name) ? ` (${item.variant_name})` : "";
    const notes = cleanText(item.notes) ? ` - ${item.notes}` : "";
    return `- ${quantity}x ${item.product_name}${variant} - $${totalUsd.toFixed(2)}${notes}`;
  });

  return [
    `Pedido confirmado - ${agency.name || "empresa delivery"}`,
    "Enviado desde el panel del comercio.",
    "",
    `Codigo: ${order.public_code}`,
    `Comercio: ${order.stores?.name || "Comercio"}`,
    order.stores?.whatsapp ? `WhatsApp comercio: ${order.stores.whatsapp}` : "",
    "",
    `Cliente: ${order.customer_name}`,
    `Telefono cliente: ${order.customer_phone}`,
    `Entrega: ${order.delivery_reference || order.delivery_address || "Por confirmar"}`,
    mapsUrl ? `Mapa: ${mapsUrl}` : "",
    order.distance_km ? `Distancia: ${Number(order.distance_km).toFixed(2)} km` : "",
    "",
    "Productos:",
    ...items,
    "",
    `Subtotal: $${Number(optionalNumber(order.subtotal_usd) || 0).toFixed(2)}`,
    `Delivery empresa: $${Number(optionalNumber(order.transport_agency_fee_usd) ?? optionalNumber(order.delivery_usd) ?? 0).toFixed(2)}`,
    `Total pedido: $${Number(optionalNumber(order.total_usd) || 0).toFixed(2)}`,
    `Pago: ${order.payment_method || "No indicado"} - ${paymentStatus}`,
    order.order_details || order.notes ? `Notas: ${order.order_details || order.notes}` : "",
    transportOrder?.id
      ? `Panel empresa delivery: ${process.env.NEXT_PUBLIC_SITE_URL || "https://vendeplus-clean.vercel.app"}/transporte/panel/pedidos`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function upsertTransportOrderFromOrder(params: {
  supabase: any;
  order: any;
  agency: any;
  actorUserId?: string | null;
}) {
  const { supabase, order, agency, actorUserId } = params;
  const now = new Date().toISOString();

  const { data: connection } = await supabase
    .from("store_transport_agency_connections")
    .select("id")
    .eq("store_id", order.store_id)
    .eq("agency_id", agency.id)
    .eq("status", "active")
    .order("is_default", { ascending: false })
    .maybeSingle();

  const { data: existing, error: existingError } = await supabase
    .from("transport_orders")
    .select("*")
    .eq("order_id", order.id)
    .eq("agency_id", agency.id)
    .maybeSingle();

  if (existingError) throw existingError;

  const previousStatus = existing?.status || null;
  const shouldRefreshStatus = !existing || ["agency_rejected", "cancelled", "delivery_failed"].includes(existing.status);
  const nextStatus = shouldRefreshStatus ? "sent_to_agency" : existing.status;
  const payload = {
    order_id: order.id,
    store_id: order.store_id,
    agency_id: agency.id,
    connection_id: connection?.id || existing?.connection_id || null,
    status: nextStatus,
    store_name_snapshot: order.stores?.name || null,
    store_whatsapp_snapshot: order.stores?.whatsapp || null,
    agency_name_snapshot: agency.name || null,
    agency_whatsapp_snapshot: agency.whatsapp_phone || agency.contact_phone || null,
    customer_name_snapshot: order.customer_name || null,
    customer_phone_snapshot: order.customer_phone || null,
    pickup_address: order.stores?.address || null,
    pickup_reference: order.stores?.name || null,
    delivery_address: order.delivery_address || order.delivery_reference || null,
    delivery_reference: order.delivery_reference || null,
    delivery_zone_name: order.delivery_zone_name || order.transport_agency_zone_name || null,
    delivery_fee_usd: optionalNumber(order.transport_agency_fee_usd) ?? optionalNumber(order.delivery_usd),
    pricing_type: order.transport_agency_pricing_type || order.delivery_pricing_type || null,
    commerce_note: order.order_details || order.notes || null,
    sent_to_agency_at: existing?.sent_to_agency_at || now,
    updated_at: now,
  };

  const { data: transportOrder, error: upsertError } = await supabase
    .from("transport_orders")
    .upsert(payload, { onConflict: "order_id,agency_id" })
    .select("*")
    .single();

  if (upsertError) throw upsertError;

  if (!existing || shouldRefreshStatus) {
    await insertTransportOrderEvent(supabase, {
      transportOrderId: transportOrder.id,
      eventType: existing ? "resent_to_agency" : "sent_to_agency",
      statusFrom: previousStatus,
      statusTo: transportOrder.status,
      note: "Pedido enviado a la empresa delivery desde el panel del comercio.",
      actorType: "commerce",
      actorUserId,
      actorName: order.stores?.name || "Comercio",
    });
  }

  return transportOrder;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const apiContext = createApiRequestContext(request, "send-delivery");
  let scopedOrderId = "";

  try {
    const auth = await requirePanelAuth(request);
    const { orderId } = await context.params;
    scopedOrderId = orderId;

    if (!orderId) {
      return badRequest("Falta el ID del pedido.");
    }

    const supabase = createSupabaseAdminClient();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        id,
        public_code,
        store_id,
        customer_name,
        customer_phone,
        delivery_type,
        delivery_provider,
        delivery_address,
        delivery_zone_name,
        delivery_pricing_type,
        payment_status,
        payment_method,
        subtotal_usd,
        delivery_usd,
        transport_agency_id,
        transport_agency_name,
        transport_agency_fee_usd,
        transport_agency_pricing_type,
        transport_agency_zone_name,
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
        stores (
          id,
          name,
          whatsapp,
          address,
          latitude,
          longitude
        ),
        order_items (
          product_name,
          variant_name,
          quantity,
          unit_price_usd,
          total_usd,
          notes
        )
      `
      )
      .eq("id", orderId)
      .single();

    if (orderError) throw orderError;

    assertStoreAccess(
      auth,
      order.store_id,
      "No tienes permiso para enviar este pedido."
    );

    if (order.delivery_type !== "delivery") {
      return badRequest("Solo los pedidos delivery se pueden enviar a un proveedor.");
    }

    if (order.delivery_provider === "transport_agency") {
      if (!order.transport_agency_id) {
        return badRequest("Este pedido no tiene empresa delivery asignada.");
      }

      if (!cleanText(order.customer_name) || !cleanText(order.customer_phone)) {
        return badRequest("El pedido necesita nombre y telefono del cliente.");
      }

      if (
        !cleanText(order.delivery_reference) &&
        !cleanText(order.delivery_address) &&
        (optionalNumber(order.delivery_lat) === null ||
          optionalNumber(order.delivery_lng) === null)
      ) {
        return badRequest(
          "El pedido necesita referencia o coordenadas de entrega antes de enviarlo."
        );
      }

      const { data: agency, error: agencyError } = await supabase
        .from("transport_agencies")
        .select("id, name, whatsapp_phone, contact_phone, contact_email")
        .eq("id", order.transport_agency_id)
        .maybeSingle();
      if (agencyError) throw agencyError;
      if (!agency) return badRequest("No se encontro la empresa delivery.");

      const agencyPhone = agency.whatsapp_phone || agency.contact_phone;
      const transportOrder = await upsertTransportOrderFromOrder({
        supabase,
        order,
        agency,
        actorUserId: auth.userId || null,
      });
      const transportStatus = normalizeTransportOrderStatus(transportOrder.status);
      const message = buildTransportAgencyMessage(order, agency, transportOrder);
      const whatsappUrl = buildWhatsappUrl(agencyPhone, message);

      if (!whatsappUrl) {
        return badRequest("La empresa delivery no tiene telefono WhatsApp configurado.");
      }

      const provider = "transport_agency";
      const externalOrderId = `agency-${order.id}`;
      const requestPayload = {
        channel: "whatsapp",
        agencyId: agency.id,
        agencyName: agency.name,
        agencyPhone,
        transportOrderId: transportOrder.id,
        message,
      };

      const { error: integrationError } = await supabase
        .from("order_integrations")
        .upsert(
          {
            order_id: order.id,
            provider,
            external_id: externalOrderId,
            status: transportOrder.status,
            request_payload: requestPayload,
            last_payload: { whatsappUrl, transportOrderId: transportOrder.id },
            last_error: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "order_id,provider" }
        );
      if (integrationError) throw integrationError;

      const { error: orderUpdateError } = await supabase
        .from("orders")
        .update({
          delivery_status: mapTransportStatusToOrderDeliveryStatus(transportStatus),
          transport_agency_status: transportOrder.status,
        })
        .eq("id", order.id);
      if (orderUpdateError) throw orderUpdateError;

      logApiEvent(apiContext, "transport_agency_order_sent", {
        orderId: order.id,
        storeId: order.store_id,
        agencyId: agency.id,
        transportOrderId: transportOrder.id,
      });

      return attachApiResponseHeaders(NextResponse.json({
        ok: true,
        provider,
        transportOrder,
        whatsappUrl,
        message,
      }), apiContext, "send-delivery");
    }

    if (order.delivery_provider !== "entrega2") {
      return badRequest("Este pedido no esta configurado para Entrega2.");
    }
    if (!cleanText(order.customer_name) || !cleanText(order.customer_phone)) {
      return badRequest("El pedido necesita nombre y telefono del cliente.");
    }

    if (
      !cleanText(order.delivery_reference) &&
      (optionalNumber(order.delivery_lat) === null ||
        optionalNumber(order.delivery_lng) === null)
    ) {
      return badRequest(
        "El pedido necesita referencia o coordenadas de entrega antes de enviarlo."
      );
    }

    const provider = getEntrega2Provider();
    const externalOrderId = getEntrega2ExternalOrderId(order.id);
    const { data: existingIntegration, error: existingError } = await supabase
      .from("order_integrations")
      .select("id, status")
      .eq("order_id", order.id)
      .eq("provider", provider)
      .maybeSingle();

    if (existingError) throw existingError;

    if (
      existingIntegration &&
      !["error", "failed"].includes(existingIntegration.status)
    ) {
      return attachApiResponseHeaders(
        NextResponse.json(
          { error: "Este pedido ya fue enviado a Entrega2." },
          { status: 409 }
        ),
        apiContext,
        "send-delivery"
      );
    }

    const requestPayload = buildEntrega2Payload(order);

    const { error: pendingIntegrationError } = await supabase
      .from("order_integrations")
      .upsert(
        {
          order_id: order.id,
          provider,
          external_id: externalOrderId,
          status: "sending",
          request_payload: requestPayload,
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id,provider" }
      );

    if (pendingIntegrationError) throw pendingIntegrationError;

    try {
      const entrega2Response = await sendEntrega2Order(requestPayload);

      const { data: integration, error: integrationError } = await supabase
        .from("order_integrations")
        .upsert(
          {
            order_id: order.id,
            provider,
            external_id: externalOrderId,
            status: "sent",
            request_payload: requestPayload,
            last_payload: entrega2Response.payload,
            last_error: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "order_id,provider" }
        )
        .select()
        .single();

      if (integrationError) throw integrationError;

      logApiEvent(apiContext, "entrega2_order_sent", {
        orderId: order.id,
        storeId: order.store_id,
        integrationId: integration.id,
      });

      return attachApiResponseHeaders(NextResponse.json({
        ok: true,
        integration,
        entrega2: entrega2Response.payload,
      }), apiContext, "send-delivery");
    } catch (error) {
      await supabase.from("order_integrations").upsert(
        {
          order_id: order.id,
          provider,
          external_id: externalOrderId,
          status: "error",
          request_payload: requestPayload,
          last_payload:
            error && typeof error === "object" && "payload" in error
              ? (error as { payload: unknown }).payload
              : null,
          last_error: serializeError(error),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id,provider" }
      );

      throw error;
    }
  } catch (error: any) {
    logApiError(apiContext, "send_delivery_failed", error, {
      orderId: scopedOrderId || null,
    });
    return attachApiResponseHeaders(
      panelErrorResponse(error, "Error enviando pedido a delivery."),
      apiContext,
      "send-delivery"
    );
  }
}
