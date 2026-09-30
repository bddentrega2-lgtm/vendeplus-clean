import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type MarketplacePartner = { id: string; name: string; logoUrl: string; storeIds: string[] };

export async function getMarketplacePartners(storeIds: string[]): Promise<{ partners: MarketplacePartner[]; available: boolean }> {
  if (!storeIds.length) return { partners: [], available: true };
  try {
    const db = createSupabaseAdminClient();
    const [agencies, connections, legacy] = await Promise.all([
      db.from("transport_agencies").select("id,name,slug,logo_url").eq("status", "active").eq("is_active", true).order("name").limit(250),
      db.from("store_transport_agency_connections").select("agency_id,store_id,disengagement_effective_at").eq("status", "active").in("store_id", storeIds).limit(2000),
      db.from("store_delivery_settings").select("store_id").eq("delivery_provider", "entrega2").in("store_id", storeIds),
    ]);
    if (agencies.error || connections.error || legacy.error) return { partners: [], available: false };
    const now = Date.now();
    const partners = (agencies.data || []).map(agency => ({
      id: String(agency.id), name: String(agency.name), logoUrl: String(agency.logo_url || ""),
      storeIds: [...new Set([
        ...(connections.data || []).filter(row => row.agency_id === agency.id && (!row.disengagement_effective_at || Date.parse(row.disengagement_effective_at) > now)).map(row => String(row.store_id)),
        ...(agency.slug === "entrega2" ? (legacy.data || []).map(row => String(row.store_id)) : []),
      ])],
    })).filter(agency => agency.storeIds.length);
    return { partners, available: true };
  } catch { return { partners: [], available: false }; }
}
