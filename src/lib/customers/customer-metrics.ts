function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isCustomerOrderCancelled(value: unknown) {
  return ["cancelled", "canceled", "cancelado"].includes(String(value || "").toLowerCase());
}

export function customerProductValueUsd(order: any) {
  if (order?.subtotal_usd !== null && order?.subtotal_usd !== undefined) {
    return Math.max(0, toNumber(order.subtotal_usd));
  }
  return Math.max(0, toNumber(order?.total_usd) - toNumber(order?.delivery_usd));
}
