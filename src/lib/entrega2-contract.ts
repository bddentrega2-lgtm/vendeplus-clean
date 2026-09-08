export type Entrega2OrderStatus =
  | "sent"
  | "accepted"
  | "delivering"
  | "issue"
  | "completed"
  | "cancelled";

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
    delivering: 2,
    completed: 3,
  };

  return (rank[next] ?? -1) >= (rank[current] ?? -1);
}
