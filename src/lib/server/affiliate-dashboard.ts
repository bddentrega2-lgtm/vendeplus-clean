import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createSupabaseAdminClient>;

export async function loadAffiliateDashboard(db: Db, codes: Array<{ id: string }>) {
  const codeIds = codes.map((code) => code.id);
  if (!codeIds.length) return { codes, stores: [], settlements: [], asOf: new Date().toISOString() };
  const [earnings, settlements] = await Promise.all([
    db.rpc("affiliate_earnings_by_codes", { p_code_ids: codeIds }),
    db.from("affiliate_settlements").select("id, affiliate_code_id, amount_usd, paid_at, method, reference")
      .in("affiliate_code_id", codeIds).order("paid_at", { ascending: false }).limit(20),
  ]);
  if (earnings.error || settlements.error) throw earnings.error || settlements.error;
  return {
    codes, stores: earnings.data || [], settlements: settlements.data || [],
    asOf: new Date().toISOString(),
  };
}
