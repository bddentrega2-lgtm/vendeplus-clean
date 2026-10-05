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
    const { data: store, error: storeError } = await supabase.from("stores")
      .select("table_orders_access_enabled,table_orders_enabled")
      .eq("id", storeId).single();
    if (storeError) throw storeError;
    if (!store.table_orders_access_enabled || !store.table_orders_enabled) return badRequest("Los avisos de mesa no estan activos.");

    const { error } = await supabase.from("panel_push_devices").upsert({
      fcm_token: token,
      user_id: auth.userId,
      store_id: storeId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "fcm_token" });
    if (error) throw error;
    return NextResponse.json({ registered: true });
  } catch (error) {
    return panelErrorResponse(error, "No se pudo activar los avisos de mesa.");
  }
}
