import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export type StoreRatingSummary = { average: number; count: number };
export async function getStoreRatingSummaries(ids: string[]): Promise<Record<string, StoreRatingSummary> | null> {
  if (!ids.length) return {};
  try {
    const { data, error } = await createSupabaseAdminClient().rpc("buyer_store_rating_summaries", { p_store_ids: ids.slice(0, 500) });
    if (error) return null;
    return Object.fromEntries((data || []).map((row: { store_id: string; average: number; count: number }) => [row.store_id, { average: Number(row.average), count: Number(row.count) }]));
  } catch { return null; }
}
