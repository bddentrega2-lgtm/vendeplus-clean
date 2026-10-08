export type Entrega2OrderStatus =
  | "sent"
  | "accepted"
  | "picking_up"
  | "delivering"
  | "issue"
  | "completed"
  | "cancelled";

export const entrega2StatusLabels: Record<string, string> = {
  sending: "Enviando",
  sent: "Buscando repartidor",
  accepted: "Repartidor asignado",
  assigned: "Repartidor asignado",
  picking_up: "Retirando",
  delivering: "Llevando",
  delivered: "Entregado",
  completed: "Entregado",
  cancelled: "Cancelado",
  issue: "Con novedad",
  error: "Error",
  failed: "Error",
  reconcile_required: "Revisar antes de reenviar",
};

// Earlier dispatches recorded the send but had no reliable status callbacks.
const ENTREGA2_TRACKING_STARTED_AT = Date.parse("2026-10-06T00:00:00Z");

export function getEntrega2DisplayStatus(
  status: string | null | undefined,
  createdAt?: string | null,
  orderStatus?: string | null
): string {
  if (status === "sent") {
    if (orderStatus === "cancelled") return "Pedido cancelado";
    if (orderStatus === "completed") return "Pedido completado";
    const createdTime = createdAt ? Date.parse(createdAt) : NaN;
    if (Number.isFinite(createdTime) && createdTime < ENTREGA2_TRACKING_STARTED_AT) {
      return "Enviado a Entrega2 (sin seguimiento histórico)";
    }
  }
  return entrega2StatusLabels[status || ""] || status || "Registrado";
}

export function getEntrega2DispatchBlockMessage(status?: string | null): string | null {
  if (!status || ["error", "failed"].includes(status)) return null;
  if (status === "cancelled") {
    return "El delivery fue cancelado en Entrega2. No se puede reenviar este mismo servicio; coordina uno nuevo con Entrega2.";
  }
  if (status === "reconcile_required") {
    return "El resultado del envio necesita conciliacion antes de reintentar.";
  }
  return "Este pedido ya fue enviado a Entrega2 App.";
}

export function mapEntrega2StatusToTransportStatus(status: Entrega2OrderStatus) {
  const map = {
    sent: "sent_to_agency",
    accepted: "driver_assigned",
    picking_up: "pickup_pending",
    delivering: "on_the_way",
    completed: "delivered",
    cancelled: "cancelled",
    issue: "issue_reported",
  } as const;
  return map[status];
}

export function normalizeEntrega2OrderStatus(value: unknown): Entrega2OrderStatus | null {
  const status = String(value || "").trim().toLowerCase();
  const map: Record<string, Entrega2OrderStatus> = {
    accepted: "accepted", aceptado: "accepted", asignado: "accepted",
    assigned: "accepted", confirmado: "accepted", pendiente: "sent",
    sent: "sent", picking_up: "picking_up", retirando: "picking_up",
    llevando: "delivering", pickup: "delivering", picked_up: "delivering",
    collected: "delivering", en_camino: "delivering", on_route: "delivering",
    delivering: "delivering", con_novedad: "issue", issue: "issue",
    delivered: "completed", entregado: "completed", completed: "completed",
    cancelled: "cancelled", canceled: "cancelled", cancelado: "cancelled",
  };
  return map[status] || null;
}

export function getEntrega2TerminalOrderStatus(value: unknown): "cancelled" | "completed" | null {
  const status = normalizeEntrega2OrderStatus(value);
  return status === "cancelled" || status === "completed" ? status : null;
}

export function isCurrentEntrega2Delivery(order: {
  delivery_type?: string | null;
  delivery_provider?: string | null;
  selected_transport_agency?: { slug?: string | null } | Array<{ slug?: string | null }> | null;
}): boolean {
  if (order.delivery_type !== "delivery") return false;
  if (order.delivery_provider === "entrega2") return true;
  const agency = Array.isArray(order.selected_transport_agency)
    ? order.selected_transport_agency[0]
    : order.selected_transport_agency;
  return order.delivery_provider === "transport_agency" &&
    agency?.slug?.toLowerCase() === "entrega2";
}

export function parseEntrega2QuoteCost(value: unknown) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function canAdvanceEntrega2OrderStatus(
  current: Entrega2OrderStatus | null,
  next: Entrega2OrderStatus | null
) {
  if (!next || current === next) return Boolean(next);
  if (!current) return true;
  if (current === "completed" || current === "cancelled") return false;
  if (next === "cancelled" || next === "issue") return true;
  if (current === "issue") return true;

  const rank: Partial<Record<Entrega2OrderStatus, number>> = {
    sent: 0,
    accepted: 1,
    picking_up: 2,
    delivering: 3,
    completed: 4,
  };

  return (rank[next] ?? -1) >= (rank[current] ?? -1);
}
