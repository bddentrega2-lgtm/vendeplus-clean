import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertStoreAccess, assertStoreManager, badRequest, panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";
import { createPairingCode, hashPrintAgentSecret } from "@/lib/printing/agent-auth-server";

async function context(request: NextRequest) {
  const auth = await requirePanelAuth(request);
  const storeId = String(request.headers.get("x-panel-store-id") || "").trim();
  if (!storeId) throw new Error("STORE_REQUIRED");
  assertStoreAccess(auth, storeId);
  return { auth, storeId };
}

export async function GET(request: NextRequest) {
  try {
    const { storeId } = await context(request);
    const { data, error } = await createSupabaseAdminClient()
      .from("print_agent_devices")
      .select("id, name, platform, app_version, last_seen_at, revoked_at, created_at")
      .eq("store_id", storeId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ devices: data || [] });
  } catch (error) {
    if (error instanceof Error && error.message === "STORE_REQUIRED") return badRequest("Selecciona un comercio.");
    return panelErrorResponse(error, "No se pudieron cargar los equipos vinculados.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { auth, storeId } = await context(request);
    assertStoreManager(auth, storeId);
    const code = createPairingCode();
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const supabase = createSupabaseAdminClient();
    await supabase.from("print_agent_pairing_codes").delete().eq("store_id", storeId).is("used_at", null);
    const { error } = await supabase.from("print_agent_pairing_codes").insert({ store_id: storeId, code_hash: hashPrintAgentSecret(code), expires_at: expiresAt });
    if (error) throw error;
    return NextResponse.json({ code, expiresAt });
  } catch (error) {
    if (error instanceof Error && error.message === "STORE_REQUIRED") return badRequest("Selecciona un comercio.");
    return panelErrorResponse(error, "No se pudo generar el codigo de vinculacion.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { auth, storeId } = await context(request);
    assertStoreManager(auth, storeId);
    const deviceId = String((await request.json()).deviceId || "").trim();
    if (!deviceId) return badRequest("Falta identificar el equipo.");
    const { error } = await createSupabaseAdminClient()
      .from("print_agent_devices")
      .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", deviceId)
      .eq("store_id", storeId)
      .is("revoked_at", null);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "STORE_REQUIRED") return badRequest("Selecciona un comercio.");
    return panelErrorResponse(error, "No se pudo desvincular el equipo.");
  }
}
