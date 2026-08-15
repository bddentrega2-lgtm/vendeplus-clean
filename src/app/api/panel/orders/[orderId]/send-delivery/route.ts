import { NextRequest, NextResponse } from "next/server";
import {
  getEntrega2CreatedByUserId,
  getEntrega2DefaultVehicleType,
  getEntrega2ExternalOrderId,
  getEntrega2Provider,
  normalizeEntrega2OrderStatus,
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
import { buildPublicUrl } from "@/lib/public-url";

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

  return "Error desconocido enviando a Entrega2 App.";
}

function buildWhatsappUrl(phone: string, message: string) {
  const cleanPhone = cleanText(phone).replace(/[^0-9]/g, "");
  if (!cleanPhone) return null;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

function buildGoogleMapsUrl(lat: unknown, lng: unknown) {
  const latitude = optionalNumber(lat);
  const longitude = optionalNumber(lng);
  if (latitude === null || longitude === null) return "";
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

function normalizeInternationalPhone(value: unknown) {
  let digits = cleanText(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `58${digits.slice(1)}`;
  if (!digits.startsWith("58") && digits.length === 10 && digits.startsWith("4")) {
    digits = `58${digits}`;
  }
  return `+${digits}`;
}

function buildEntrega2CommerceId(order: any) {
  const source = cleanText(order.stores?.slug) || cleanText(order.store_id);
  const normalized = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `vp_${normalized}`;
}

function buildEntrega2Payload(order: any) {
  const externalOrderId = getEntrega2ExternalOrderId(order.id);
  const deliveryMapsUrl = buildGoogleMapsUrl(order.delivery_lat, order.delivery_lng);
  const items = (order.order_items || []).map((item: any) => {
    const quantity = optionalNumber(item.quantity) || 1;
    const totalUsd = optionalNumber(item.total_usd) || 0;
    const variant = cleanText(item.variant_name) ? ` (${item.variant_name})` : "";
    const notes = cleanText(item.notes) ? ` - ${item.notes}` : "";
    return `${quantity}x ${item.product_name}${variant} - $${totalUsd.toFixed(2)}${notes}`;
  });
  const detalles = [
    order.public_code ? `Pedido: ${order.public_code}` : null,
    items.length ? `Productos: ${items.join(" | ")}` : null,
    order.payment_method ? `Pago: ${order.payment_method}` : null,
    order.total_usd ? `Total: $${Number(optionalNumber(order.total_usd) || 0).toFixed(2)}` : null,
    order.order_details || order.notes ? `Observaciones: ${order.order_details || order.notes}` : null,
    order.delivery_reference ? `Referencia: ${order.delivery_reference}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    pedido: cleanText(order.customer_name),
    direccion_entrega:
      cleanText(order.delivery_address) ||
      cleanText(order.delivery_reference) ||
      deliveryMapsUrl,
    latitud_entrega: optionalNumber(order.delivery_lat),
    longitud_entrega: optionalNumber(order.delivery_lng),
    detalles,
    link_maps: deliveryMapsUrl,
    latitud_retiro: optionalNumber(order.stores?.latitude),
    longitud_retiro: optionalNumber(order.stores?.longitude),
    id_comercio: buildEntrega2CommerceId(order),
    nombre_comercio: order.stores?.name || "Comercio Somos",
    telefono_contacto: normalizeInternationalPhone(order.customer_phone),
    telefono_comercio: normalizeInternationalPhone(order.stores?.whatsapp),
    tipo_vehiculo: getEntrega2DefaultVehicleType(),
    id_externo: externalOrderId,
    creado_por_usuario_id: getEntrega2CreatedByUserId(),
  };
}

function buildTransportAgencyMessage(order: any, agency: any, transportOrder?: any) {
  const mapsUrl =
    optionalNumber(order.delivery_lat) !== null && optionalNumber(order.delivery_lng) !== null
      ? `https://www.google.com/maps/search/?api=1&query=${order.delivery_lat},${order.delivery_lng}`
      : "";
  const paymentMethodForDelivery = cleanText(order.payment_method) || "No indicado";
  const shouldReceiveCash = /efectivo|cash/i.test(paymentMethodForDelivery);
  const simpleMessage = [
    "*Nuevo servicio delivery*",
    order.public_code ? `Pedido: ${order.public_code}` : null,
    "",
    `Empresa: ${agency.name || "Delivery"}`,
    `Comercio: ${order.stores?.name || "Comercio"}`,
    `Telefono comercio: ${order.stores?.whatsapp || "No indicado"}`,
    "",
    `Cliente recibe: ${order.customer_name || "Cliente"}`,
    `Telefono cliente: ${order.customer_phone || "No indicado"}`,
    mapsUrl ? `Ubicacion GPS: ${mapsUrl}` : "Ubicacion GPS: no indicada",
    order.delivery_reference || order.delivery_address
      ? `Referencia: ${order.delivery_reference || order.delivery_address}`
      : null,
    "",
    shouldReceiveCash
      ? `Pago: efectivo. El cliente puede entregar efectivo. Total pedido: $${Number(optionalNumber(order.total_usd) || 0).toFixed(2)}`
      : `Pago: ${paymentMethodForDelivery}. No recibir efectivo salvo confirmacion del comercio.`,
    "",
    transportOrder?.id ? `Panel: ${buildPublicUrl("/transporte/panel/pedidos")}` : null,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");

  return simpleMessage;

  const paymentStatus = cleanText(order.payment_status) || "pending";
  const deliveryFee = Number(
    optionalNumber(order.transport_agency_fee_usd) ?? optionalNumber(order.delivery_usd) ?? 0
  );
  const items = (order.order_items || []).map((item: any) => {
    const quantity = optionalNumber(item.quantity) || 1;
    const totalUsd = optionalNumber(item.total_usd) || 0;
    const variant = cleanText(item.variant_name) ? ` (${item.variant_name})` : "";
    const notes = cleanText(item.notes) ? ` - ${item.notes}` : "";
    return `• ${quantity}x ${item.product_name}${variant} — $${totalUsd.toFixed(2)}${notes}`;
  });

  return [
    `*Nuevo pedido para delivery*`,
    `${agency.name || "Empresa delivery"}`,
    "",
    `*Pedido*`,
    `Código: ${order.public_code}`,
    `Comercio: ${order.stores?.name || "Comercio"}`,
    order.stores?.whatsapp ? `WhatsApp comercio: ${order.stores.whatsapp}` : null,
    "",
    `*Cliente*`,
    `Nombre: ${order.customer_name}`,
    `Teléfono: ${order.customer_phone}`,
    "",
    `*Entrega*`,
    `Dirección / referencia: ${order.delivery_reference || order.delivery_address || "Por confirmar"}`,
    order.delivery_zone_name ? `Zona: ${order.delivery_zone_name}` : null,
    order.distance_km ? `Distancia: ${Number(order.distance_km).toFixed(2)} km` : null,
    mapsUrl ? `Mapa: ${mapsUrl}` : null,
    "",
    "*Productos*",
    ...items,
    "",
    "*Cobro*",
    `Subtotal productos: $${Number(optionalNumber(order.subtotal_usd) || 0).toFixed(2)}`,
    `Tarifa delivery empresa: $${deliveryFee.toFixed(2)}`,
    `Total cobrado al cliente: $${Number(optionalNumber(order.total_usd) || 0).toFixed(2)}`,
    `Pago: ${order.payment_method || "No indicado"} · ${paymentStatus}`,
    order.order_details || order.notes ? `Notas del comercio: ${order.order_details || order.notes}` : null,
    "",
    transportOrder?.id
      ? `Panel: ${buildPublicUrl("/transporte/panel/pedidos")}`
      : null,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");
}

async function upsertTransportOrderFromOrder(params: {
  supabase: any;
  order: any;
  agency: any;
  connectionId: string;
  actorUserId?: string | null;
}) {
  const { supabase, order, agency, connectionId, actorUserId } = params;
  const now = new Date().toISOString();

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
    connection_id: connectionId,
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
          slug,
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

    if (["cancelled", "canceled", "cancelado"].includes(cleanText(order.status).toLowerCase())) {
      return badRequest(
        "Este pedido esta cancelado. Cambia el estado del pedido antes de solicitar delivery."
      );
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

      const { data: connection, error: connectionError } = await supabase
        .from("store_transport_agency_connections")
        .select("id")
        .eq("store_id", order.store_id)
        .eq("agency_id", agency.id)
        .eq("status", "active")
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (connectionError) throw connectionError;
      if (!connection) {
        return badRequest("La empresa delivery ya no tiene una conexion activa con este comercio.");
      }

      const agencyPhone = agency.whatsapp_phone || agency.contact_phone;
      const transportOrder = await upsertTransportOrderFromOrder({
        supabase,
        order,
        agency,
        connectionId: connection.id,
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
      return badRequest("Este pedido no esta configurado para Entrega2 App.");
    }
    if (!cleanText(order.customer_name) || !cleanText(order.customer_phone)) {
      return badRequest("El pedido necesita nombre y telefono del cliente.");
    }
    if (!cleanText((order.stores as any)?.whatsapp)) {
      return badRequest("El comercio necesita un telefono configurado para Entrega2 App.");
    }

    if (
      optionalNumber(order.delivery_lat) === null ||
      optionalNumber(order.delivery_lng) === null
    ) {
      return badRequest(
        "El pedido necesita ubicacion GPS de entrega antes de enviarlo a Entrega2 App."
      );
    }
    if (
      optionalNumber((order.stores as any)?.latitude) === null ||
      optionalNumber((order.stores as any)?.longitude) === null
    ) {
      return badRequest(
        "El comercio necesita ubicacion GPS configurada antes de enviar pedidos a Entrega2 App."
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
          { error: "Este pedido ya fue enviado a Entrega2 App." },
          { status: 409 }
        ),
        apiContext,
        "send-delivery"
      );
    }

    const requestPayload = buildEntrega2Payload(order);

    const pendingPayload = {
      order_id: order.id,
      provider,
      external_id: externalOrderId,
      status: "sending",
      request_payload: requestPayload,
      last_error: null,
      updated_at: new Date().toISOString(),
    };
    const pendingResult = existingIntegration
      ? await supabase
          .from("order_integrations")
          .update(pendingPayload)
          .eq("id", existingIntegration.id)
          .in("status", ["error", "failed"])
          .select("id")
          .maybeSingle()
      : await supabase
          .from("order_integrations")
          .insert(pendingPayload)
          .select("id")
          .single();

    if (pendingResult.error && pendingResult.error.code !== "23505") {
      throw pendingResult.error;
    }
    if (pendingResult.error?.code === "23505" || !pendingResult.data) {
      return attachApiResponseHeaders(
        NextResponse.json(
          { error: "Este pedido ya se está enviando a Entrega2 App." },
          { status: 409 }
        ),
        apiContext,
        "send-delivery"
      );
    }

    try {
      const entrega2Response = await sendEntrega2Order(requestPayload);
      const entrega2Status = normalizeEntrega2OrderStatus(
        (entrega2Response.payload as any)?.estado
      ) || "sent";
      const entrega2ExternalId = (entrega2Response.payload as any)?.id
        ? String((entrega2Response.payload as any).id)
        : externalOrderId;

      const { data: integration, error: integrationError } = await supabase
        .from("order_integrations")
        .upsert(
          {
            order_id: order.id,
            provider,
            external_id: entrega2ExternalId,
            status: entrega2Status,
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
        entrega2Id: entrega2ExternalId,
      });

      await supabase
        .from("orders")
        .update({ delivery_status: entrega2Status })
        .eq("id", order.id);

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
