import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { achievementDefinitions, loadStoreAchievements } from "@/lib/achievements";
import { loadMonthlyChallenges } from "@/lib/monthly-challenges";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest, context: { params: Promise<{ storeId: string }> }) {
  try {
    await requireAdminAuth(request);
    const { storeId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const [state, monthlyChallenges] = await Promise.all([
      loadStoreAchievements(supabase, storeId),
      loadMonthlyChallenges(supabase, storeId),
    ]);
    return NextResponse.json({ ...state, monthlyChallenges });
  } catch (error) {
    return adminErrorResponse(error, "No se pudieron cargar las recompensas.");
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ storeId: string }> }) {
  try {
    await requireAdminAuth(request);
    const { storeId } = await context.params;
    const body = await request.json();
    const monthlyChallengeKey = String(body.monthlyChallengeKey || "");
    const action = String(body.action || "grant");
    const supabase = createSupabaseAdminClient();

    if (monthlyChallengeKey) {
      if (!["activate_monthly", "revoke_monthly"].includes(action)) return NextResponse.json({ error: "Acción mensual no válida." }, { status: 400 });
      const { data: challenge, error: challengeError } = await supabase.from("monthly_challenges").select("id, reward_label").eq("challenge_key", monthlyChallengeKey).single();
      if (challengeError) throw challengeError;
      const status = action === "revoke_monthly" ? "revoked" : "active";
      const { data: reward, error: rewardError } = await supabase.from("store_monthly_challenge_rewards").update({ status, updated_at: new Date().toISOString() }).eq("challenge_id", challenge.id).eq("store_id", storeId).select("id").maybeSingle();
      if (rewardError) throw rewardError;
      if (!reward) return NextResponse.json({ error: "El comercio todavía no ha ganado esta recompensa mensual." }, { status: 409 });
      return NextResponse.json({ monthlyChallenges: await loadMonthlyChallenges(supabase, storeId), message: status === "active" ? `Recompensa “${challenge.reward_label}” reactivada.` : `Recompensa “${challenge.reward_label}” retirada.` });
    }

    const achievementKey = String(body.achievementKey || "");
    const definition = achievementDefinitions.find((item) => item.key === achievementKey);
    if (!definition) return NextResponse.json({ error: "Logro no válido." }, { status: 400 });

    if (action === "revoke") {
      const { error: resetError } = await supabase.from("store_achievement_resets").upsert({
        store_id: storeId,
        achievement_key: definition.key,
        reset_at: new Date().toISOString(),
        reset_by: "admin",
        progress_snapshot: { revokedByAdmin: true },
      }, { onConflict: "store_id,achievement_key" });
      if (resetError) throw resetError;
      const { error: deleteError } = await supabase.from("store_achievement_unlocks").delete().eq("store_id", storeId).eq("achievement_key", definition.key);
      if (deleteError) throw deleteError;
      if (definition.feature === "product_limit_50") {
        const { error: limitError } = await supabase.from("stores").update({ product_limit: 30 }).eq("id", storeId);
        if (limitError) throw limitError;
      }
      return NextResponse.json({ ...(await loadStoreAchievements(supabase, storeId)), message: `Recompensa “${definition.reward}” retirada. El progreso comenzará nuevamente desde cero.` });
    }
    if (action !== "grant") return NextResponse.json({ error: "Acción no válida." }, { status: 400 });

    const { error: clearResetError } = await supabase.from("store_achievement_resets").delete().eq("store_id", storeId).eq("achievement_key", definition.key);
    if (clearResetError) throw clearResetError;
    const { error } = await supabase.from("store_achievement_unlocks").upsert({
      store_id: storeId,
      achievement_key: definition.key,
      source: "admin",
      progress_snapshot: { grantedByAdmin: true },
      unlocked_at: new Date().toISOString(),
    }, { onConflict: "store_id,achievement_key" });
    if (error) throw error;

    if (definition.feature === "product_limit_50") {
      const { data: store, error: storeError } = await supabase.from("stores").select("product_limit").eq("id", storeId).single();
      if (storeError) throw storeError;
      if (Number(store.product_limit || 30) < 50) {
        const { error: limitError } = await supabase.from("stores").update({ product_limit: 50 }).eq("id", storeId);
        if (limitError) throw limitError;
      }
    }

    return NextResponse.json({ ...(await loadStoreAchievements(supabase, storeId)), message: `Recompensa “${definition.reward}” habilitada manualmente.` });
  } catch (error) {
    return adminErrorResponse(error, "No se pudo habilitar la recompensa.");
  }
}
