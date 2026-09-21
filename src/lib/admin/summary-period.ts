export type PeriodMode = "day" | "week" | "month";

type PeriodOrder = {
  store_id: string;
  created_at: string;
  status: string | null;
  platform_service_fee_usd: number | string | null;
  customer_phone_normalized: string | null;
  customer_id: string | null;
};

type PeriodPayment = {
  store_id: string;
  amount_usd: number | string | null;
};

const CARACAS_OFFSET_HOURS = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

function dateParts(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function caracasToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isSummaryStoreExpired(store: {
  plan_type?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  next_payment_due_at?: string | null;
  subscription_ends_at?: string | null;
}, now = new Date()) {
  if (store.subscription_status === "expired" || store.subscription_status === "past_due") return true;
  if (store.subscription_status === "paused" || store.subscription_status === "cancelled") return false;
  const dueDate = store.plan_type === "trial"
    ? store.trial_ends_at
    : store.next_payment_due_at || store.subscription_ends_at;
  return Boolean(dueDate && dueDate.slice(0, 10) < caracasToday(now));
}

export function getSummaryPeriod(modeValue: string | null, anchorValue: string | null) {
  const mode: PeriodMode = modeValue === "day" || modeValue === "week" ? modeValue : "month";
  const anchor = dateParts(anchorValue || "") || dateParts(caracasToday())!;
  const start = new Date(anchor);
  if (mode === "week") start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  if (mode === "month") start.setUTCDate(1);

  const end = new Date(start);
  if (mode === "day") end.setUTCDate(end.getUTCDate() + 1);
  if (mode === "week") end.setUTCDate(end.getUTCDate() + 7);
  if (mode === "month") end.setUTCMonth(end.getUTCMonth() + 1);

  const startIso = new Date(start.getTime() + CARACAS_OFFSET_HOURS * 60 * 60 * 1000).toISOString();
  const endIso = new Date(end.getTime() + CARACAS_OFFSET_HOURS * 60 * 60 * 1000).toISOString();
  return { mode, anchor: isoDay(anchor), startDate: isoDay(start), endDate: isoDay(end), startIso, endIso };
}

export function moveSummaryAnchor(mode: PeriodMode, anchorValue: string, direction: number) {
  const anchor = dateParts(anchorValue);
  if (!anchor) return anchorValue;
  if (mode === "month") {
    const day = anchor.getUTCDate();
    const target = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + direction, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return isoDay(target);
  }
  return isoDay(shiftDays(anchor, direction * (mode === "week" ? 7 : 1)));
}

function cents(value: number | string | null) {
  return Math.round(Number(value || 0) * 100);
}

function usd(value: number) {
  return Number((value / 100).toFixed(2));
}

export function buildPeriodSummary(
  period: ReturnType<typeof getSummaryPeriod>,
  orders: PeriodOrder[],
  payments: PeriodPayment[],
  storeNames: Map<string, string>
) {
  const orderCounts = new Map<string, number>();
  const collectedCents = new Map<string, number>();
  const customerCounts = new Map<string, number>();
  const buckets = new Map<string, { label: string; orders: number; feeGeneratedCents: number }>();
  const start = dateParts(period.startDate)!;
  const days = Math.round((dateParts(period.endDate)!.getTime() - start.getTime()) / DAY_MS);

  for (let index = 0; index < (period.mode === "day" ? 24 : days); index++) {
    const label = period.mode === "day"
      ? String(index).padStart(2, "0")
      : isoDay(shiftDays(start, index));
    buckets.set(label, { label, orders: 0, feeGeneratedCents: 0 });
  }

  let cancelledOrders = 0;
  let feeGeneratedCents = 0;
  for (const order of orders) {
    orderCounts.set(order.store_id, (orderCounts.get(order.store_id) || 0) + 1);
    if (["cancelled", "canceled", "cancelado"].includes(String(order.status || "").toLowerCase())) {
      cancelledOrders++;
    }
    const customerKey = order.customer_phone_normalized?.trim()
      ? `phone:${order.customer_phone_normalized.trim()}`
      : order.customer_id ? `id:${order.customer_id}` : null;
    if (customerKey) customerCounts.set(customerKey, (customerCounts.get(customerKey) || 0) + 1);

    const fee = cents(order.platform_service_fee_usd);
    feeGeneratedCents += fee;
    const local = new Date(new Date(order.created_at).getTime() - CARACAS_OFFSET_HOURS * 60 * 60 * 1000);
    const bucketKey = period.mode === "day" ? String(local.getUTCHours()).padStart(2, "0") : isoDay(local);
    const bucket = buckets.get(bucketKey);
    if (bucket) {
      bucket.orders++;
      bucket.feeGeneratedCents += fee;
    }
  }

  let feeCollectedCents = 0;
  for (const payment of payments) {
    const amount = cents(payment.amount_usd);
    feeCollectedCents += amount;
    collectedCents.set(payment.store_id, (collectedCents.get(payment.store_id) || 0) + amount);
  }

  const ranking = (values: Map<string, number>, convert: (value: number) => number) =>
    [...values.entries()]
      .map(([storeId, value]) => ({ storeId, storeName: storeNames.get(storeId) || "Comercio", value: convert(value) }))
      .sort((a, b) => b.value - a.value || a.storeName.localeCompare(b.storeName))
      .slice(0, 10);

  return {
    period,
    orders: orders.length,
    cancelledOrders,
    feeGeneratedUsd: usd(feeGeneratedCents),
    feeCollectedUsd: usd(feeCollectedCents),
    uniqueCustomers: customerCounts.size,
    frequentCustomers: [...customerCounts.values()].filter((count) => count >= 3).length,
    series: [...buckets.values()].map((bucket) => ({
      label: bucket.label,
      orders: bucket.orders,
      feeGeneratedUsd: usd(bucket.feeGeneratedCents),
    })),
    ordersRanking: ranking(orderCounts, (value) => value),
    feeRanking: ranking(collectedCents, usd),
  };
}
