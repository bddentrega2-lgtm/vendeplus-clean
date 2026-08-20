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
  mapTransportStatusToOrderDeliveryStatus,
  normalizeTransportOrderStatus,
} from "@/lib/transport/orders";
import { mutateTransportOrderAtomic } from "@/lib/server/mutate-transport-order-atomic";

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
      .select("id, order_id, agency_id, status, agency_status_note, sent_to_agency_at, agency_received_at, accepted_at, rejected_at, assigned_at, picked_up_at, on_the_way_at, delivered_at, cancelled_at")
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
    if (timestampField && !(transportOrder as Record<string, unknown>)[timestampField]) {
      payload[timestampField] = now;
    }
    if (nextStatus === "agency_rejected") payload.rejection_reason = note || "Rechazado por empresa delivery.";

    const updated = await mutateTransportOrderAtomic(supabase, {
      transportOrderId: transportOrder.id,
      transportPayload: payload,
      eventPayload: {
        event_type: "status_changed",
        status_from: currentStatus,
        status_to: nextStatus,
        note,
        actor_type: auth.isFounderMode ? "admin" : "agency",
        actor_user_id: auth.userId,
        actor_name: auth.email || "Empresa delivery",
      },
      orderDeliveryStatus: mapTransportStatusToOrderDeliveryStatus(nextStatus),
      integrationStatus: nextStatus,
    });

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
