import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertAgencyAccess, requireTransportAgencyAuth, transportErrorResponse } from "@/lib/transport/access";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTransportAgencyAuth(request);
    const body = await request.json().catch(() => null);
    const agencyId = String(body?.agencyId || "").trim();
    const token = String(body?.token || "").trim();
    assertAgencyAccess(auth, agencyId);
    if (!auth.userId || auth.isFounderMode) return NextResponse.json({ error: "Selecciona una empresa delivery." }, { status: 400 });
    if (!/^[A-Za-z0-9:._~-]{40,512}$/.test(token)) return NextResponse.json({ error: "Token de aviso invalido." }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("transport_push_devices").upsert({
      fcm_token: token,
      user_id: auth.userId,
      agency_id: agencyId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "fcm_token" });
    if (error) throw error;
    return NextResponse.json({ registered: true });
  } catch (error) {
    return transportErrorResponse(error, "No se pudieron activar los avisos de la empresa delivery.");
  }
}
