import { NextRequest, NextResponse } from "next/server";
import {
  canAdvanceEntrega2OrderStatus,
  getEntrega2Provider,
  isValidEntrega2Webhook,
  normalizeEntrega2OrderStatus,
} from "@/lib/integrations/entrega2";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canTransitionTransportOrder } from "@/lib/transport/orders";

const MAX_WEBHOOK_BODY_BYTES = 80_000;

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function getPayloadStatus(payload: any) {
  return (
    cleanText(payload.status) ||
    cleanText(payload.estado) ||
    cleanText(payload.deliveryStatus) ||
    cleanText(payload.orderStatus)
  );
}

function getPayloadExternalId(payload: any) {
  return (
    cleanText(payload.externalOrderId) ||
    cleanText(payload.external_id) ||
    cleanText(payload.orderId) ||
    cleanText(payload.order_id) ||
    cleanText(payload.id)
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

  const orderId = externalId.replace(/^vendeplus_/, "");
  const { data: byOrderId, error: orderError } = await supabase
    .from("order_integrations")
    .select("id, order_id, transport_order_id, particular_request_id, status")
    .eq("provider", provider)
    .eq("order_id", orderId)
    .maybeSingle();

  if (orderError) throw orderError;

  return byOrderId;
}

function mapEntrega2StatusToTransportStatus(status: string | null) {
  const map: Record<string, string> = {
    accepted: "agency_accepted",
    sent: "sent_to_agency",
    delivering: "on_the_way",
    completed: "delivered",
    cancelled: "cancelled",
    issue: "issue_reported",
  };

  return status ? map[status] || null : null;
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
    const payload = await request.json();
    const externalId = getPayloadExternalId(payload);
    const integrationStatus = getPayloadStatus(payload);

    if (!externalId) {
      return NextResponse.json(
        { error: "Falta el identificador del pedido." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const integration = await findIntegration(supabase, externalId);

    if (!integration) {
      return NextResponse.json(
        { error: "No se encontró la integración del pedido." },
        { status: 404 }
      );
    }

    const vendeplusStatus = normalizeEntrega2OrderStatus(integrationStatus);

    if (
      vendeplusStatus &&
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
        status: vendeplusStatus || integration.status,
        last_payload: payload,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);
    if (vendeplusStatus) {
      integrationUpdate = integrationUpdate.eq("status", integration.status);
    }
    const { data: updatedIntegration, error: updateError } = await integrationUpdate
      .select("id")
      .maybeSingle();

    if (updateError) throw updateError;
    if (vendeplusStatus && !updatedIntegration) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "concurrent_update",
        orderId: integration.order_id,
        transportOrderId: integration.transport_order_id,
        mappedStatus: vendeplusStatus,
      });
    }

    if (vendeplusStatus && integration.order_id) {
      const { data: currentOrder, error: currentOrderError } = await supabase
        .from("orders")
        .select("delivery_status")
        .eq("id", integration.order_id)
        .maybeSingle();
      if (currentOrderError) throw currentOrderError;
      if (
        currentOrder &&
        canAdvanceEntrega2OrderStatus(currentOrder.delivery_status, vendeplusStatus)
      ) {
        const { error: orderError } = await supabase
          .from("orders")
          .update({ delivery_status: vendeplusStatus })
          .eq("id", integration.order_id)
          .eq("delivery_status", currentOrder.delivery_status);
        if (orderError) throw orderError;
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
        canTransitionTransportOrder(currentTransportOrder.status, transportStatus)
      ) {
        const { error: transportError } = await supabase
          .from("transport_orders")
          .update({ status: transportStatus, updated_at: new Date().toISOString() })
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
    });
  } catch {
    return NextResponse.json(
      { error: "Error procesando webhook de Entrega2 App." },
      { status: 500 }
    );
  }
}
