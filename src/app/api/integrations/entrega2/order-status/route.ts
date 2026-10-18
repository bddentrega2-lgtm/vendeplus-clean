import { NextRequest, NextResponse } from "next/server";
import { isCurrentEntrega2Delivery, mapEntrega2StatusToTransportStatus } from "@/lib/entrega2-contract";
import {
  canAdvanceEntrega2OrderStatus,
  getEntrega2Provider,
  isValidEntrega2Webhook,
  normalizeEntrega2OrderStatus,
} from "@/lib/integrations/entrega2";
import { advanceEntrega2OrderDeliveryStatus } from "@/lib/server/entrega2-dispatch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTransportOrderTimestampField, type TransportOrderStatus } from "@/lib/transport/orders";
import { recalculateCustomerFromOrder } from "@/lib/customers/upsert-customer-from-order";

const MAX_WEBHOOK_BODY_BYTES = 80_000;

function cleanText(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function getPayloadStatus(payload: any) {
  return (
    cleanText(payload.estado) ||
    cleanText(payload.status) ||
    cleanText(payload.deliveryStatus) ||
    cleanText(payload.orderStatus)
  );
}

function getPayloadExternalId(payload: any) {
  return (
    cleanText(payload.id_externo) ||
    cleanText(payload.id) ||
    cleanText(payload.externalOrderId) ||
    cleanText(payload.external_id) ||
    cleanText(payload.orderId) ||
    cleanText(payload.order_id)
  );
}

async function findIntegration(supabase: any, externalId: string) {
  const provider = getEntrega2Provider();
  const { data: byExternalId, error: externalError } = await supabase
    .from("order_integrations")
    .select("id, order_id, transport_order_id, particular_request_id, status")
    .eq("provider", provider)
    .eq("external_id", externalId)
    .maybeSingle();

  if (externalError) throw externalError;
  if (byExternalId) return byExternalId;

  const commerceId = /^vendeplus_([0-9a-f-]{36})$/i.exec(externalId)?.[1];
  const particularId = /^vendeplus_particular_([0-9a-f-]{36})$/i.exec(externalId)?.[1];
  if (commerceId) {
    const result = await supabase.from("order_integrations")
      .select("id, order_id, transport_order_id, particular_request_id, status")
      .eq("provider", provider).eq("order_id", commerceId).maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }
  if (particularId) {
    const result = await supabase.from("order_integrations")
      .select("id, order_id, transport_order_id, particular_request_id, status")
      .eq("provider", provider).eq("transport_order_id", particularId).maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }
  return null;
}

function canAdvanceTransportStatus(current: string, next: string) {
  if (current === next || ["delivered", "cancelled", "agency_rejected", "delivery_failed"].includes(current)) return false;
  if (["cancelled", "issue_reported"].includes(next)) return true;
  if (current === "issue_reported") return true;
  const rank: Record<string, number> = {
    pending_agency: 0, sent_to_agency: 1, agency_received: 2,
    agency_accepted: 3, driver_assigned: 4, pickup_pending: 5,
    picked_up: 6, on_the_way: 7, delivered: 8,
  };
  return next in rank && (rank[next] ?? -1) > (rank[current] ?? -1);
}

async function syncOrderStatus(supabase: any, orderId: string, deliveryStatus: string) {
  if (deliveryStatus !== "cancelled" && deliveryStatus !== "completed") return;
  const { data: order, error } = await supabase.from("orders")
    .select("id,store_id,status,customer_id,customer_name,customer_phone,customer_phone_normalized")
    .eq("id", orderId).maybeSingle();
  if (error) throw error;
  if (!order) return;
  const result = await supabase.rpc("close_entrega2_order_v2", {
    p_order_id: orderId, p_terminal_status: deliveryStatus,
  });
  if (result.error) throw result.error;
  if (deliveryStatus === "cancelled" && order.customer_id && order.status !== "cancelled" && result.data?.status === "cancelled") {
    await recalculateCustomerFromOrder(supabase, result.data);
  }
}

export async function POST(request: NextRequest) {
  if (!isValidEntrega2Webhook(request.headers)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json(
      { error: "Payload demasiado grande." },
      { status: 413 }
    );
  }

  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
      return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }
    const externalId = getPayloadExternalId(payload);
    const integrationStatus = getPayloadStatus(payload);

    if (!externalId || externalId.length > 160) {
      return NextResponse.json(
        { error: "Falta el identificador del pedido." },
        { status: 400 }
      );
    }

    const vendeplusStatus = normalizeEntrega2OrderStatus(integrationStatus);
    if (!vendeplusStatus) {
      return NextResponse.json({ error: "Estado de Entrega2 no reconocido." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const integration = await findIntegration(supabase, externalId);

    if (!integration) {
      return NextResponse.json(
        { error: "No se encontró la integración del pedido." },
        { status: 404 }
      );
    }

    let currentStatus = integration.status;
    let applied = false;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (!canAdvanceEntrega2OrderStatus(currentStatus, vendeplusStatus)) {
        return NextResponse.json({
          ok: true, ignored: true, reason: "out_of_order",
          orderId: integration.order_id, transportOrderId: integration.transport_order_id,
          mappedStatus: vendeplusStatus,
        });
      }
      const { data: updated, error: updateError } = await supabase.from("order_integrations")
        .update({ status: vendeplusStatus, last_payload: payload, last_error: null, updated_at: new Date().toISOString() })
        .eq("id", integration.id).eq("status", currentStatus)
        .select("id").maybeSingle();
      if (updateError) throw updateError;
      if (updated) { applied = true; break; }
      const refreshed = await supabase.from("order_integrations")
        .select("status").eq("id", integration.id).single();
      if (refreshed.error) throw refreshed.error;
      currentStatus = refreshed.data.status;
    }
    if (!applied) throw new Error("No se pudo conciliar el aviso de Entrega2. Debe reintentarse.");

    let appliesToCurrentOrder = false;
    if (integration.order_id) {
      const { data: assignedOrder, error: assignedOrderError } = await supabase
        .from("orders")
        .select("delivery_type, delivery_provider, selected_transport_agency:transport_agencies!orders_transport_agency_id_fkey(slug)")
        .eq("id", integration.order_id)
        .maybeSingle();
      if (assignedOrderError) throw assignedOrderError;
      appliesToCurrentOrder = Boolean(assignedOrder && isCurrentEntrega2Delivery(assignedOrder));
      if (appliesToCurrentOrder) {
        await advanceEntrega2OrderDeliveryStatus(supabase, integration.order_id, vendeplusStatus);
        await syncOrderStatus(supabase, integration.order_id, vendeplusStatus);
      }
    }

    const transportStatus = mapEntrega2StatusToTransportStatus(vendeplusStatus);
    if (transportStatus && integration.transport_order_id) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const { data: current, error: readError } = await supabase.from("transport_orders")
          .select("status").eq("id", integration.transport_order_id).maybeSingle();
        if (readError) throw readError;
        if (!current || current.status === transportStatus || !canAdvanceTransportStatus(current.status, transportStatus)) break;
        const timestampField = getTransportOrderTimestampField(transportStatus as TransportOrderStatus);
        const { data: updated, error: transportError } = await supabase.from("transport_orders")
          .update({ status: transportStatus, updated_at: new Date().toISOString(),
            ...(timestampField ? { [timestampField]: new Date().toISOString() } : {}) })
          .eq("id", integration.transport_order_id).eq("status", current.status)
          .select("id").maybeSingle();
        if (transportError) throw transportError;
        if (updated) break;
        if (attempt === 3) throw new Error("No se pudo conciliar el servicio delivery. Debe reintentarse.");
      }
    }

    return NextResponse.json({
      ok: true,
      orderId: integration.order_id,
      transportOrderId: integration.transport_order_id,
      mappedStatus: vendeplusStatus,
      orderStatusIgnored: Boolean(integration.order_id && !appliesToCurrentOrder),
    });
  } catch {
    return NextResponse.json(
      { error: "Error procesando webhook de Entrega2 App." },
      { status: 500 }
    );
  }
}
