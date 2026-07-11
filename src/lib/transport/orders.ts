export const transportOrderStatuses = [
  "pending_agency",
  "sent_to_agency",
  "agency_received",
  "agency_accepted",
  "agency_rejected",
  "driver_assigned",
  "pickup_pending",
  "picked_up",
  "on_the_way",
  "delivered",
  "delivery_failed",
  "issue_reported",
  "cancelled",
] as const;

export type TransportOrderStatus = (typeof transportOrderStatuses)[number];

export const transportOrderStatusLabels: Record<TransportOrderStatus, string> = {
  pending_agency: "Pendiente por empresa delivery",
  sent_to_agency: "Enviado a empresa delivery",
  agency_received: "Recibido por empresa delivery",
  agency_accepted: "Aceptado",
  agency_rejected: "Rechazado",
  driver_assigned: "Repartidor asignado",
  pickup_pending: "Pendiente por retirar",
  picked_up: "Retirado",
  on_the_way: "En camino",
  delivered: "Entregado",
  delivery_failed: "Fallido",
  issue_reported: "Novedad",
  cancelled: "Cancelado",
};

const allowedTransitions: Record<TransportOrderStatus, TransportOrderStatus[]> = {
  pending_agency: ["sent_to_agency", "cancelled"],
  sent_to_agency: ["agency_received", "agency_accepted", "agency_rejected", "issue_reported", "cancelled"],
  agency_received: ["agency_accepted", "agency_rejected", "issue_reported", "cancelled"],
  agency_accepted: ["picked_up", "pickup_pending", "on_the_way", "delivered", "issue_reported", "cancelled"],
  agency_rejected: [],
  driver_assigned: ["pickup_pending", "picked_up", "issue_reported", "cancelled"],
  pickup_pending: ["picked_up", "on_the_way", "delivered", "issue_reported", "cancelled"],
  picked_up: ["on_the_way", "delivered", "issue_reported", "cancelled"],
  on_the_way: ["delivered", "delivery_failed", "issue_reported", "cancelled"],
  delivered: [],
  delivery_failed: ["issue_reported", "cancelled"],
  issue_reported: ["agency_received", "agency_accepted", "picked_up", "on_the_way", "delivered", "cancelled"],
  cancelled: [],
};

export function normalizeTransportOrderStatus(value: unknown): TransportOrderStatus {
  return transportOrderStatuses.includes(value as TransportOrderStatus)
    ? (value as TransportOrderStatus)
    : "pending_agency";
}

export function canTransitionTransportOrder(
  currentStatus: unknown,
  nextStatus: unknown
) {
  const current = normalizeTransportOrderStatus(currentStatus);
  const next = normalizeTransportOrderStatus(nextStatus);
  if (current === next) return true;
  return allowedTransitions[current]?.includes(next) || false;
}

export function getTransportOrderTimestampField(status: TransportOrderStatus) {
  const map: Partial<Record<TransportOrderStatus, string>> = {
    sent_to_agency: "sent_to_agency_at",
    agency_received: "agency_received_at",
    agency_accepted: "accepted_at",
    agency_rejected: "rejected_at",
    driver_assigned: "assigned_at",
    picked_up: "picked_up_at",
    on_the_way: "on_the_way_at",
    delivered: "delivered_at",
    cancelled: "cancelled_at",
  };

  return map[status] || null;
}

export function mapTransportStatusToOrderDeliveryStatus(status: TransportOrderStatus) {
  const map: Record<TransportOrderStatus, string> = {
    pending_agency: "pending_agency",
    sent_to_agency: "sent_to_agency",
    agency_received: "agency_received",
    agency_accepted: "accepted",
    agency_rejected: "rejected",
    driver_assigned: "assigned",
    pickup_pending: "pickup_pending",
    picked_up: "picked_up",
    on_the_way: "delivering",
    delivered: "delivered",
    delivery_failed: "delivery_failed",
    issue_reported: "issue_reported",
    cancelled: "cancelled",
  };

  return map[status];
}

export function cleanTransportOrderNote(value: unknown, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

export async function insertTransportOrderEvent(
  supabase: any,
  params: {
    transportOrderId: string;
    eventType: string;
    statusFrom?: string | null;
    statusTo?: string | null;
    note?: string | null;
    actorType: "commerce" | "agency" | "admin" | "system";
    actorUserId?: string | null;
    actorName?: string | null;
  }
) {
  const { error } = await supabase.from("transport_order_events").insert({
    transport_order_id: params.transportOrderId,
    event_type: params.eventType,
    status_from: params.statusFrom || null,
    status_to: params.statusTo || null,
    note: cleanTransportOrderNote(params.note, 800) || null,
    actor_type: params.actorType,
    actor_user_id: params.actorUserId || null,
    actor_name: cleanTransportOrderNote(params.actorName, 160) || null,
  });

  if (error) throw error;
}
