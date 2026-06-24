export type CustomerSegment =
  | "new"
  | "frequent"
  | "vip"
  | "contact"
  | "pending_payment"
  | "delivery"
  | "pickup";

export function daysSince(value?: string | null) {
  if (!value) return null;

  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return null;

  return Math.max(0, Math.floor(diff / 86400000));
}

export function getCustomerBadges(customer: {
  orders_count?: number | string | null;
  total_spent_usd?: number | string | null;
  last_order_at?: string | null;
  pending_payments_count?: number | string | null;
}) {
  const ordersCount = Number(customer.orders_count || 0);
  const totalSpent = Number(customer.total_spent_usd || 0);
  const inactiveDays = daysSince(customer.last_order_at);
  const badges: Array<{ key: CustomerSegment; label: string }> = [];

  if (ordersCount <= 1) badges.push({ key: "new", label: "Nuevo" });
  if (ordersCount >= 3) badges.push({ key: "frequent", label: "Frecuente" });
  if (ordersCount >= 5 || totalSpent >= 100) badges.push({ key: "vip", label: "VIP" });
  if (ordersCount >= 2 && inactiveDays !== null && inactiveDays >= 21) {
    badges.push({ key: "contact", label: "Por contactar" });
  }
  if (Number(customer.pending_payments_count || 0) > 0) {
    badges.push({ key: "pending_payment", label: "Pago pendiente" });
  }

  return badges.length ? badges : [{ key: "new" as const, label: "Cliente" }];
}

export function getPrimaryCustomerSegment(customer: {
  orders_count?: number | string | null;
  total_spent_usd?: number | string | null;
  last_order_at?: string | null;
  pending_payments_count?: number | string | null;
}) {
  return getCustomerBadges(customer)[0];
}

export function shouldContactCustomer(customer: {
  orders_count?: number | string | null;
  last_order_at?: string | null;
}) {
  const inactiveDays = daysSince(customer.last_order_at);
  return Number(customer.orders_count || 0) >= 2 && inactiveDays !== null && inactiveDays >= 21;
}
