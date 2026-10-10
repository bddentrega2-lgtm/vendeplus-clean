import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { loadStoreAchievements } from "@/lib/achievements";
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

    return NextResponse.json({ error: "Los beneficios permanentes ya están incluidos para todos los comercios." }, { status: 409 });
  } catch (error) {
    return adminErrorResponse(error, "No se pudo habilitar la recompensa.");
  }
}
