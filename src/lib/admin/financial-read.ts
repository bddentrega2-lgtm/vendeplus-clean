import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadServiceFeeBalances, type ServiceFeeBalance, type ServiceFeeStore } from "@/lib/billing/service-fees";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

function missingRpc(error: { code?: string } | null) {
  return error?.code === "PGRST202";
}

export async function loadAdminOpenFeeBalances(supabase: AdminClient, stores: ServiceFeeStore[]) {
  const { data, error } = await supabase.rpc("admin_open_fee_balances");
  if (error) {
    if (missingRpc(error)) return loadServiceFeeBalances(supabase, stores);
    throw error;
  }
  const balances = new Map<string, ServiceFeeBalance>();
  for (const row of data || []) {
    balances.set(row.store_id, {
      periodStart: row.period_start,
      serviceCount: Number(row.service_count),
      amountUsd: Number(row.amount_usd),
    });
  }
  return balances;
}

export async function loadAdminApprovedPaymentsTotal(supabase: AdminClient, storeIds: string[]) {
  if (!storeIds.length) return 0;
  const { data, error } = await supabase.rpc("admin_approved_payments_total");
  if (!error) return Number(data || 0);
  if (!missingRpc(error)) throw error;

  let cents = 0;
  for (let offset = 0; ; offset += 500) {
    const result = await supabase.from("store_subscription_payments")
      .select("id, amount_usd")
      .in("store_id", storeIds)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + 499);
    if (result.error) throw result.error;
    for (const payment of result.data || []) cents += Math.round(Number(payment.amount_usd || 0) * 100);
    if ((result.data || []).length < 500) return Number((cents / 100).toFixed(2));
  }
}
