import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";
import { includedAchievementFeatures } from "@/lib/achievements";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("stores")
      .select("id, name, slug, logo_url, cover_image_url, subscription_status, subscription_ends_at, next_payment_due_at, trial_ends_at, table_orders_access_enabled, table_orders_enabled")
      .order("name", { ascending: true });

    if (!auth.isFounderMode) {
      query = auth.storeIds?.length
        ? query.in("id", auth.storeIds)
        : query.eq("id", "__no_authorized_store__");
    }

    const requestedStoreId = String(request.headers.get("x-panel-store-id") || "").trim();
    const { data, error } = await query;
    if (error) throw error;

    const stores = data || [];
    const selectedStore = stores.find((store) => store.id === requestedStoreId) || stores[0] || null;

    return NextResponse.json({
      userId: auth.userId,
      isFounderMode: auth.isFounderMode,
      stores,
      selectedStoreId: selectedStore?.id || "",
      achievementFeatures: selectedStore ? includedAchievementFeatures : {},
      achievements: [],
    });
  } catch (error) {
    return panelErrorResponse(error, "Error cargando comercios disponibles.");
  }
}
