import { NextRequest, NextResponse } from "next/server";
import { loadStoreAchievements } from "@/lib/achievements";
import { loadMonthlyChallenges } from "@/lib/monthly-challenges";
import { assertStoreAccess, badRequest, panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const requestedStoreId = String(
      request.nextUrl.searchParams.get("storeId") ||
      request.headers.get("x-panel-store-id") ||
      ""
    ).trim();
    const storeId = requestedStoreId || (auth.storeIds === null ? "" : auth.storeIds[0] || "");
    if (!storeId) return badRequest("Selecciona un comercio para ver sus logros.");
    assertStoreAccess(auth, storeId, "No tienes permiso para ver los logros de este comercio.");
    const supabase = createSupabaseAdminClient();
    const [state, monthlyChallenges] = await Promise.all([
      loadStoreAchievements(supabase, storeId),
      loadMonthlyChallenges(supabase, storeId),
    ]);
    return NextResponse.json({ ...state, monthlyChallenges });
  } catch (error) {
    return panelErrorResponse(error, "No se pudieron cargar los logros.");
  }
}
