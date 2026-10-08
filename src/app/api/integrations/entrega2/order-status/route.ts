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
import { cancelOrderWithInventory } from "@/lib/server/cancel-order-with-inventory";
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
  if (!order || ["cancelled", "completed"].includes(order.status)) return;

  if (deliveryStatus === "cancelled") {
    const cancelled = await cancelOrderWithInventory({
      supabase, orderId, storeId: order.store_id,
      cancellationReason: "Entrega2 canceló el delivery.",
    });
    if (order.customer_id) await recalculateCustomerFromOrder(supabase, cancelled);
    return;
  }

  const result = await supabase.from("orders").update({ status: "completed" })
    .eq("id", orderId).eq("store_id", order.store_id).eq("status", order.status);
  if (result.error) throw result.error;
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

    if (
      !canAdvanceEntrega2OrderStatus(integration.status, vendeplusStatus)
    ) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "out_of_order",
        orderId: integration.order_id,
        transportOrderId: integration.transport_order_id,
        mappedStatus: vendeplusStatus,
      });
    }

    let integrationUpdate = supabase
      .from("order_integrations")
      .update({
        status: vendeplusStatus,
        last_payload: payload,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);
    integrationUpdate = integrationUpdate.eq("status", integration.status);
    const { data: updatedIntegration, error: updateError } = await integrationUpdate
      .select("id")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedIntegration) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "concurrent_update",
        orderId: integration.order_id,
        transportOrderId: integration.transport_order_id,
        mappedStatus: vendeplusStatus,
      });
    }

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
      const { data: currentTransportOrder, error: currentTransportError } =
        await supabase
          .from("transport_orders")
          .select("status")
          .eq("id", integration.transport_order_id)
          .maybeSingle();
      if (currentTransportError) throw currentTransportError;
      if (
        currentTransportOrder &&
        canAdvanceTransportStatus(currentTransportOrder.status, transportStatus)
      ) {
        const timestampField = getTransportOrderTimestampField(transportStatus as TransportOrderStatus);
        const { error: transportError } = await supabase
          .from("transport_orders")
          .update({
            status: transportStatus,
            updated_at: new Date().toISOString(),
            ...(timestampField ? { [timestampField]: new Date().toISOString() } : {}),
          })
          .eq("id", integration.transport_order_id)
          .eq("status", currentTransportOrder.status);
        if (transportError) throw transportError;
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
