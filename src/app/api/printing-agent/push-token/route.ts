import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePrintAgent } from "@/lib/printing/agent-auth-server";

export async function POST(request: NextRequest) {
  const device = await requirePrintAgent(request);
  if (!device) return NextResponse.json({ error: "Equipo no autorizado." }, { status: 401 });
  try {
    const token = String((await request.json()).token || "").trim();
    if (!/^[A-Za-z0-9_:\-]{40,4096}$/.test(token)) {
      return NextResponse.json({ error: "Token de notificacion invalido." }, { status: 400 });
    }
    const { error } = await createSupabaseAdminClient()
      .from("print_agent_devices")
      .update({ fcm_token: token, fcm_token_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", device.id)
      .eq("store_id", device.store_id)
      .is("revoked_at", null);
    if (error) throw error;
    return NextResponse.json({ registered: true });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar el telefono." }, { status: 500 });
  }
}
