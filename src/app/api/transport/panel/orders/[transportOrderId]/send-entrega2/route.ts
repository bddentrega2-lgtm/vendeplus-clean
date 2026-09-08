import { NextRequest, NextResponse } from "next/server";
import {
  getEntrega2CreatedByUserId,
  getEntrega2DefaultVehicleType,
  getEntrega2ExternalOrderId,
  getEntrega2Provider,
  normalizeEntrega2OrderStatus,
  sendEntrega2Order,
} from "@/lib/integrations/entrega2";
import { attachApiResponseHeaders, createApiRequestContext, logApiError, logApiEvent } from "@/lib/server/observability";
import {
  completeEntrega2Dispatch,
  markEntrega2DispatchForReconciliation,
} from "@/lib/server/entrega2-dispatch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertAgencyRole, requireTransportAgencyAuth, transportErrorResponse } from "@/lib/transport/access";
import { insertTransportOrderEvent } from "@/lib/transport/orders";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function optionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function buildGoogleMapsUrl(lat: unknown, lng: unknown) {
  const latitude = optionalNumber(lat);
  const longitude = optionalNumber(lng);
  if (latitude === null || longitude === null) return "";
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

function serializeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Error desconocido enviando el servicio a Entrega2 App.";
}

function getParticularExternalId(transportOrderId: string) {
  return `vendeplus_particular_${transportOrderId}`;
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

function getParticularServiceLabel(request: any) {
  const description = cleanText(request?.package_description);
  if (/Traslado de persona:/i.test(description)) return "Traslado";
  if (/Delivery:/i.test(description)) return "Delivery";
  return "Particular";
}

function buildEntrega2ParticularPayload(order: any) {
  const request = order.transport_particular_requests;
  const serviceLabel = getParticularServiceLabel(request);
  const pickupMapsUrl = buildGoogleMapsUrl(request.pickup_lat, request.pickup_lng);
  const deliveryMapsUrl = buildGoogleMapsUrl(request.delivery_lat, request.delivery_lng);
  const code = cleanText(request.public_code) || cleanText(order.id).slice(0, 8);
  const paymentMethod = cleanText(request.payment_method) || "No indicado";
  const detalles = [
    `Solicitud particular: ${code}`,
    `Servicio: ${serviceLabel}`,
    request.package_description
      ? `${serviceLabel === "Traslado" ? "Detalle" : "Paquete"}: ${request.package_description}`
      : null,
    request.pickup_name ? `${serviceLabel === "Traslado" ? "Pasajero" : "Retiro"}: ${request.pickup_name}` : null,
    request.delivery_name && serviceLabel !== "Traslado" ? `Entrega: ${request.delivery_name}` : null,
    `Pago: ${paymentMethod}`,
    request.payment_reference ? `Referencia de pago: ${request.payment_reference}` : null,
    order.delivery_fee_usd ? `Tarifa: $${Number(optionalNumber(order.delivery_fee_usd) || 0).toFixed(2)}` : null,
    request.pickup_reference ? `Referencia ${serviceLabel === "Traslado" ? "origen" : "retiro"}: ${request.pickup_reference}` : null,
    request.delivery_reference ? `Referencia ${serviceLabel === "Traslado" ? "destino" : "entrega"}: ${request.delivery_reference}` : null,
    pickupMapsUrl ? `Mapa ${serviceLabel === "Traslado" ? "origen" : "retiro"}: ${pickupMapsUrl}` : null,
    deliveryMapsUrl ? `Mapa ${serviceLabel === "Traslado" ? "destino" : "entrega"}: ${deliveryMapsUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    pedido: request.requester_name || order.customer_name_snapshot || "Particular",
    direccion_retiro: cleanText(request.pickup_address) || cleanText(request.pickup_reference) || pickupMapsUrl,
    latitud_retiro: optionalNumber(request.pickup_lat),
    longitud_retiro: optionalNumber(request.pickup_lng),
    direccion_entrega: cleanText(request.delivery_address) || cleanText(request.delivery_reference) || deliveryMapsUrl,
    latitud_entrega: optionalNumber(request.delivery_lat),
    longitud_entrega: optionalNumber(request.delivery_lng),
    detalles,
    link_maps: deliveryMapsUrl,
    id_comercio: "vp_somos_particulares",
    nombre_comercio: "Somos Particulares",
    telefono_contacto: normalizeInternationalPhone(request.delivery_phone || request.requester_phone),
    telefono_comercio: normalizeInternationalPhone(request.pickup_phone || request.requester_phone),
    tipo_vehiculo: getEntrega2DefaultVehicleType(),
    id_externo: getParticularExternalId(order.id),
    creado_por_usuario_id: getEntrega2CreatedByUserId(),
  };
}

function buildEntrega2CommercePayload(transportOrder: any) {
  const order = transportOrder.orders;
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
    `Validado por Entrega2 Somos: ${transportOrder.id.slice(0, 8)}`,
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
    nombre_comercio: order.stores?.name || transportOrder.store_name_snapshot || "Comercio Somos",
    telefono_contacto: normalizeInternationalPhone(order.customer_phone),
    telefono_comercio: normalizeInternationalPhone(order.stores?.whatsapp || transportOrder.store_whatsapp_snapshot),
    tipo_vehiculo: getEntrega2DefaultVehicleType(),
    id_externo: getEntrega2ExternalOrderId(order.id),
    creado_por_usuario_id: getEntrega2CreatedByUserId(),
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ transportOrderId: string }> }
) {
  const apiContext = createApiRequestContext(request, "transport-send-entrega2");
  let scopedTransportOrderId = "";

  try {
    const auth = await requireTransportAgencyAuth(request);
    const { transportOrderId } = await context.params;
    scopedTransportOrderId = transportOrderId;

    if (!transportOrderId) {
      return NextResponse.json({ error: "Falta el ID del servicio." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: order, error: orderError } = await supabase
      .from("transport_orders")
      .select(
        `
        id,
        agency_id,
        connection_id,
        particular_request_id,
        store_id,
        order_id,
        status,
        customer_name_snapshot,
        delivery_fee_usd,
        transport_particular_requests (
          id,
          public_code,
          requester_name,
          requester_phone,
          pickup_name,
          pickup_phone,
          pickup_address,
          pickup_reference,
          pickup_lat,
          pickup_lng,
          delivery_name,
          delivery_phone,
          delivery_address,
          delivery_reference,
          delivery_lat,
          delivery_lng,
          package_description,
          payment_method,
          payment_reference
        ),
        orders (
          id,
          public_code,
          store_id,
          customer_name,
          customer_phone,
          delivery_address,
          delivery_reference,
          delivery_lat,
          delivery_lng,
          payment_method,
          total_usd,
          order_details,
          notes,
          stores (
            id,
            slug,
            name,
            whatsapp,
            latitude,
            longitude
          ),
          order_items (
            product_name,
            variant_name,
            quantity,
            total_usd,
            notes
          )
        )
      `
      )
      .eq("id", transportOrderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) {
      return NextResponse.json({ error: "Servicio particular no encontrado." }, { status: 404 });
    }

    assertAgencyRole(
      auth,
      order.agency_id,
      ["owner", "admin", "operator"],
      "Tu rol no permite enviar este servicio a Entrega2 App."
    );

    const requestData = order.transport_particular_requests as any;
    const commerceOrder = order.orders as any;
    const isParticular = Boolean(order.particular_request_id && requestData && !order.order_id && !order.store_id);
    const isCommerceOrder = Boolean(order.order_id && order.store_id && commerceOrder && !order.particular_request_id);

    if (!isParticular && !isCommerceOrder) {
      return NextResponse.json(
        { error: "Solo particulares o pedidos de comercio validados se pueden enviar a Entrega2 App." },
        { status: 400 }
      );
    }

    const { data: agency, error: agencyError } = await supabase
      .from("transport_agencies")
      .select("id, name, slug")
      .eq("id", order.agency_id)
      .maybeSingle();

    if (agencyError) throw agencyError;
    if (!agency || cleanText(agency.slug).toLowerCase() !== "entrega2") {
      return NextResponse.json(
        { error: "Esta accion solo esta disponible para Entrega2." },
        { status: 403 }
      );
    }

    if (isParticular && (
      optionalNumber(requestData.pickup_lat) === null ||
      optionalNumber(requestData.pickup_lng) === null ||
      optionalNumber(requestData.delivery_lat) === null ||
      optionalNumber(requestData.delivery_lng) === null
    )) {
      return NextResponse.json(
        { error: "La solicitud necesita GPS de retiro y entrega antes de enviarse a Entrega2 App." },
        { status: 400 }
      );
    }
    if (isCommerceOrder && (
      optionalNumber(commerceOrder.delivery_lat) === null ||
      optionalNumber(commerceOrder.delivery_lng) === null ||
      optionalNumber(commerceOrder.stores?.latitude) === null ||
      optionalNumber(commerceOrder.stores?.longitude) === null
    )) {
      return NextResponse.json(
        { error: "El pedido necesita GPS de comercio y entrega antes de enviarse a Entrega2 App." },
        { status: 400 }
      );
    }

    const provider = getEntrega2Provider();
    const externalOrderId = isParticular ? getParticularExternalId(order.id) : getEntrega2ExternalOrderId(order.order_id);
    let existingIntegrationQuery = supabase
      .from("order_integrations")
      .select("id, status")
      .eq("provider", provider);
    existingIntegrationQuery = isCommerceOrder
      ? existingIntegrationQuery.or(`transport_order_id.eq.${order.id},order_id.eq.${order.order_id}`)
      : existingIntegrationQuery.eq("transport_order_id", order.id);
    const { data: existingIntegration, error: existingError } = await existingIntegrationQuery.maybeSingle();

    if (existingError) throw existingError;

    if (existingIntegration && !["error", "failed"].includes(existingIntegration.status)) {
      const needsReconciliation = existingIntegration.status === "reconcile_required";
      return attachApiResponseHeaders(
        NextResponse.json(
          {
            error: needsReconciliation
              ? "El resultado del envio necesita conciliacion antes de reintentar."
              : isParticular
                ? "Este particular ya fue enviado a Entrega2 App."
                : "Este pedido ya fue enviado a Entrega2 App.",
          },
          { status: 409 }
        ),
        apiContext,
        "transport-send-entrega2"
      );
    }

    const requestPayload = isParticular ? buildEntrega2ParticularPayload(order) : buildEntrega2CommercePayload(order);
    const pendingPayload = {
      order_id: isCommerceOrder ? order.order_id : null,
      transport_order_id: order.id,
      particular_request_id: isParticular ? order.particular_request_id : null,
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
          { error: isParticular ? "Este particular ya se esta enviando a Entrega2 App." : "Este pedido ya se esta enviando a Entrega2 App." },
          { status: 409 }
        ),
        apiContext,
        "transport-send-entrega2"
      );
    }

    try {
      const entrega2Response = await sendEntrega2Order(requestPayload);
      const entrega2Status = normalizeEntrega2OrderStatus((entrega2Response.payload as any)?.estado) || "sent";
      const entrega2ExternalId = (entrega2Response.payload as any)?.id
        ? String((entrega2Response.payload as any).id)
        : externalOrderId;

      const integration = await completeEntrega2Dispatch(
        supabase,
        pendingResult.data.id,
        {
          external_id: entrega2ExternalId,
          status: entrega2Status,
          last_payload: entrega2Response.payload,
          last_error: null,
          updated_at: new Date().toISOString(),
        }
      );

      if (isCommerceOrder) {
        await supabase
          .from("orders")
          .update({ delivery_status: entrega2Status })
          .eq("id", order.order_id);
      }

      await insertTransportOrderEvent(supabase, {
        transportOrderId: order.id,
        eventType: isParticular ? "entrega2_app_sent" : "entrega2_app_released",
        statusFrom: order.status,
        statusTo: order.status,
        note: isParticular ? "Particular enviado a Entrega2 App." : "Pedido contado liberado hacia Entrega2 App.",
        actorType: "agency",
        actorUserId: auth.userId || null,
        actorName: agency.name || "Entrega2",
      });

      logApiEvent(apiContext, "entrega2_particular_order_sent", {
        transportOrderId: order.id,
        particularRequestId: isParticular ? order.particular_request_id : null,
        orderId: isCommerceOrder ? order.order_id : null,
        agencyId: order.agency_id,
        integrationId: integration.id,
        entrega2Id: entrega2ExternalId,
      });

      return attachApiResponseHeaders(
        NextResponse.json({
          ok: true,
          integration,
          entrega2: entrega2Response.payload,
          message: isParticular
            ? "Particular enviado a Entrega2 App."
            : "Pedido de comercio enviado a Entrega2 App.",
        }),
        apiContext,
        "transport-send-entrega2"
      );
    } catch (error) {
      await markEntrega2DispatchForReconciliation(
        supabase,
        pendingResult.data.id,
        {
          externalId: externalOrderId,
          payload:
            error && typeof error === "object" && "payload" in error
              ? (error as { payload: unknown }).payload
              : null,
          errorMessage: serializeError(error),
        }
      );

      throw error;
    }
  } catch (error: any) {
    logApiError(apiContext, "transport_send_entrega2_failed", error, {
      transportOrderId: scopedTransportOrderId || null,
    });
    return attachApiResponseHeaders(
      transportErrorResponse(error, "Error enviando el servicio a Entrega2 App."),
      apiContext,
      "transport-send-entrega2"
    );
  }
}
