import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  attachApiResponseHeaders,
  createApiRequestContext,
  logApiError,
  logApiEvent,
} from "@/lib/server/observability";
import { cleanTransportText } from "@/lib/transport";
import {
  assertAgencyRole,
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";
import {
  canTransitionTransportOrder,
  getTransportOrderTimestampField,
  insertTransportOrderEvent,
  mapTransportStatusToOrderDeliveryStatus,
  normalizeTransportOrderStatus,
} from "@/lib/transport/orders";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ transportOrderId: string }> }
) {
  const apiContext = createApiRequestContext(request, "transport-order-status");
  let scopedTransportOrderId = "";

  try {
    const { transportOrderId } = await context.params;
    scopedTransportOrderId = transportOrderId;
    const auth = await requireTransportAgencyAuth(request);
    const body = await request.json().catch(() => ({}));
    const nextStatus = normalizeTransportOrderStatus(body.status);
    const note = cleanTransportText(body.note, 500);
    const supabase = createSupabaseAdminClient();

    const { data: transportOrder, error: orderError } = await supabase
      .from("transport_orders")
      .select("*")
      .eq("id", transportOrderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!transportOrder) {
      return attachApiResponseHeaders(
        badRequest("Pedido de empresa delivery no encontrado."),
        apiContext,
        "transport-order-status"
      );
    }
    assertAgencyRole(
      auth,
      transportOrder.agency_id,
      ["owner", "admin", "operator"],
      "Tu rol no permite actualizar pedidos."
    );

    const currentStatus = normalizeTransportOrderStatus(transportOrder.status);
    if (!canTransitionTransportOrder(currentStatus, nextStatus)) {
      return attachApiResponseHeaders(
        badRequest("Ese cambio de estado no esta permitido."),
        apiContext,
        "transport-order-status"
      );
    }

    const now = new Date().toISOString();
    const timestampField = getTransportOrderTimestampField(nextStatus);
    const payload: Record<string, any> = {
      status: nextStatus,
      agency_status_note: note || transportOrder.agency_status_note || null,
      updated_at: now,
    };
    if (timestampField && !transportOrder[timestampField]) payload[timestampField] = now;
    if (nextStatus === "agency_rejected") payload.rejection_reason = note || "Rechazado por empresa delivery.";

    const { data: updated, error: updateError } = await supabase
      .from("transport_orders")
      .update(payload)
      .eq("id", transportOrder.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    await insertTransportOrderEvent(supabase, {
      transportOrderId: transportOrder.id,
      eventType: "status_changed",
      statusFrom: currentStatus,
      statusTo: nextStatus,
      note,
      actorType: auth.isFounderMode ? "admin" : "agency",
      actorUserId: auth.userId,
      actorName: auth.email || "Empresa delivery",
    });

    await supabase
      .from("orders")
      .update({
        delivery_status: mapTransportStatusToOrderDeliveryStatus(nextStatus),
        transport_agency_status: nextStatus,
      })
      .eq("id", transportOrder.order_id);

    await supabase
      .from("order_integrations")
      .update({
        status: nextStatus,
        updated_at: now,
      })
      .eq("order_id", transportOrder.order_id)
      .eq("provider", "transport_agency");

    logApiEvent(apiContext, "transport_order_status_changed", {
      transportOrderId: transportOrder.id,
      agencyId: transportOrder.agency_id,
      orderId: transportOrder.order_id,
      statusFrom: currentStatus,
      statusTo: nextStatus,
    });

    return attachApiResponseHeaders(
      NextResponse.json({ ok: true, order: updated }),
      apiContext,
      "transport-order-status"
    );
  } catch (error) {
    logApiError(apiContext, "transport_order_status_failed", error, {
      transportOrderId: scopedTransportOrderId || null,
    });
    return attachApiResponseHeaders(
      transportErrorResponse(error, "Error actualizando estado de empresa delivery."),
      apiContext,
      "transport-order-status"
    );
  }
}
