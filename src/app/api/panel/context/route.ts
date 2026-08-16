import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";

const fullStatsAchievement = {
  feature: "full_stats",
  title: "Completa 50 pedidos",
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("stores")
      .select("id, name, slug, logo_url, cover_image_url, subscription_status, subscription_ends_at, next_payment_due_at, trial_ends_at")
      .order("name", { ascending: true });

    if (!auth.isFounderMode) {
      query = auth.storeIds?.length
        ? query.in("id", auth.storeIds)
        : query.eq("id", "__no_authorized_store__");
    }

    const requestedStoreId = String(request.headers.get("x-panel-store-id") || "").trim();
    const authorizedStoreId = auth.isFounderMode
      ? requestedStoreId
      : auth.storeIds?.includes(requestedStoreId)
        ? requestedStoreId
        : auth.storeIds?.[0] || "";
    const unlockPromise = authorizedStoreId
      ? supabase
          .from("store_achievement_unlocks")
          .select("achievement_key")
          .eq("store_id", authorizedStoreId)
          .eq("achievement_key", "orders_50_full_stats")
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const [{ data, error }, initialUnlock] = await Promise.all([query, unlockPromise]);
    if (error) throw error;

    const stores = data || [];
    const selectedStore = stores.find((store) => store.id === requestedStoreId) || stores[0] || null;
    let fullStatsUnlocked = Boolean(initialUnlock.data);
    if (initialUnlock.error) throw initialUnlock.error;

    if (selectedStore && selectedStore.id !== authorizedStoreId) {
      const { data: unlock, error: unlockError } = await supabase
        .from("store_achievement_unlocks")
        .select("achievement_key")
        .eq("store_id", selectedStore.id)
        .eq("achievement_key", "orders_50_full_stats")
        .maybeSingle();

      if (unlockError) throw unlockError;
      fullStatsUnlocked = Boolean(unlock);
    }

    return NextResponse.json({
      isFounderMode: auth.isFounderMode,
      stores,
      selectedStoreId: selectedStore?.id || "",
      achievementFeatures: { full_stats: fullStatsUnlocked },
      achievements: [{ ...fullStatsAchievement, unlocked: fullStatsUnlocked }],
    });
  } catch (error) {
    return panelErrorResponse(error, "Error cargando comercios disponibles.");
  }
}
