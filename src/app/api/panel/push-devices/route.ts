import { NextRequest, NextResponse } from "next/server";
import { assertStoreAccess, badRequest, panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const storeId = String(request.headers.get("x-panel-store-id") || "").trim();
    if (!storeId || !auth.userId || auth.isFounderMode) return badRequest("Selecciona un comercio.");
    assertStoreAccess(auth, storeId);
    const body = await request.json().catch(() => null);
    const token = String(body?.token || "").trim();
    if (!/^[A-Za-z0-9:._~-]{40,512}$/.test(token)) return badRequest("Token de aviso invalido.");

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("panel_push_devices").upsert({
      fcm_token: token,
      user_id: auth.userId,
      store_id: storeId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "fcm_token" });
    if (error) throw error;
    return NextResponse.json({ registered: true });
  } catch (error) {
    return panelErrorResponse(error, "No se pudieron activar los avisos del comercio.");
  }
}
