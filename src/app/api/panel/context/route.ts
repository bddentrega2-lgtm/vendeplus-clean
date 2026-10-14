import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";
import { includedAchievementFeatures } from "@/lib/achievements";

export async function GET(request: NextRequest) {
  try {
    const startedAt = performance.now();
    const auth = await requirePanelAuth(request);
    const authMs = performance.now() - startedAt;
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("stores")
      .select("id, name, slug, logo_url, cover_image_url, subscription_status, subscription_ends_at, next_payment_due_at, trial_ends_at, table_orders_access_enabled, table_orders_enabled")
      .order("name", { ascending: true });

    if (!auth.isFounderMode) {
      query = auth.storeIds?.length
        ? query.in("id", auth.storeIds)
        : query.eq("id", "00000000-0000-0000-0000-000000000000");
    }

    const requestedStoreId = String(request.headers.get("x-panel-store-id") || "").trim();
    const readsStartedAt = performance.now();
    const reminderPromise = !auth.isFounderMode && auth.userId
      ? supabase.auth.admin.getUserById(auth.userId)
          .then(({ data, error }) => !error && data.user?.user_metadata?.somos_admin_password_reminder === true)
          .catch(() => false)
      : Promise.resolve(false);
    const [{ data, error }, passwordChangeSuggested] = await Promise.all([query, reminderPromise]);
    if (error) throw error;

    const stores = data || [];
    const selectedStore = stores.find((store) => store.id === requestedStoreId) || stores[0] || null;
    const response = NextResponse.json({
      userId: auth.userId,
      isFounderMode: auth.isFounderMode,
      passwordChangeSuggested,
      stores,
      selectedStoreId: selectedStore?.id || "",
      achievementFeatures: selectedStore ? includedAchievementFeatures : {},
      achievements: [],
    });
    response.headers.set("Server-Timing", `auth;dur=${authMs.toFixed(1)}, reads;dur=${(performance.now() - readsStartedAt).toFixed(1)}, total;dur=${(performance.now() - startedAt).toFixed(1)}`);
    return response;
  } catch (error) {
    return panelErrorResponse(error, "Error cargando comercios disponibles.");
  }
}
