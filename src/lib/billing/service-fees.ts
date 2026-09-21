import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ServiceFeeStore = {
  id: string;
  plan_type?: string | null;
  is_test?: boolean | null;
  last_payment_at?: string | null;
  subscription_started_at?: string | null;
  trial_ends_at?: string | null;
  created_at?: string | null;
};

export type ServiceFeeBalance = {
  periodStart: string | null;
  serviceCount: number;
  amountUsd: number;
};

const PAGE_SIZE = 500;

export function serviceFeePeriodStart(store: ServiceFeeStore) {
  return store.last_payment_at ||
    store.subscription_started_at ||
    store.trial_ends_at ||
    store.created_at ||
    null;
}

export async function loadServiceFeeBalances(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  stores: ServiceFeeStore[]
) {
  const balances = new Map<string, ServiceFeeBalance>();
  const eligible = stores.filter((store) => store.plan_type === "per_service" && store.is_test !== true);
  if (!eligible.length) return balances;

  const storeIds = eligible.map((store) => store.id);
  const starts = new Map(eligible.map((store) => [store.id, serviceFeePeriodStart(store)]));
  const settled = new Set<string>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("store_subscription_payments")
      .select("id, store_id, created_at")
      .in("store_id", storeIds)
      .eq("status", "approved")
      .eq("plan_type", "per_service")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    for (const payment of data || []) {
      if (settled.has(payment.store_id)) continue;
      starts.set(payment.store_id, payment.created_at);
      settled.add(payment.store_id);
    }
    if ((data || []).length < PAGE_SIZE) break;
  }
  const earliestStart = [...starts.values()]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];

  for (const store of eligible) {
    balances.set(store.id, { periodStart: starts.get(store.id) || null, serviceCount: 0, amountUsd: 0 });
  }

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from("orders")
      .select("id, store_id, created_at, platform_service_fee_usd")
      .in("store_id", storeIds)
      .gt("platform_service_fee_usd", 0)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (earliestStart) query = query.gte("created_at", earliestStart);

    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;

    for (const order of data || []) {
      const balance = balances.get(order.store_id);
      if (!balance) continue;
      if (balance.periodStart && Date.parse(order.created_at) < Date.parse(balance.periodStart)) continue;
      balance.serviceCount += 1;
      balance.amountUsd += Math.round(Number(order.platform_service_fee_usd) * 100);
    }

    if ((data || []).length < PAGE_SIZE) break;
  }

  for (const balance of balances.values()) {
    balance.amountUsd = Number((balance.amountUsd / 100).toFixed(2));
  }
  return balances;
}
