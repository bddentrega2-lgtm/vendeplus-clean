import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStoreIdByTableOrderToken } from "@/lib/server/table-order-tokens";
import { checkDistributedRateLimit, getClientIp } from "@/lib/server/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const limit = await checkDistributedRateLimit({ key: `waiter:${getClientIp(request)}`, limit: 30, windowMs: 60_000 });
    if (!limit.allowed) return NextResponse.json({ error: "Espera un minuto antes de volver a llamar." }, { status: 429 });
    const body = await request.json().catch(() => null);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!body || typeof body.token !== "string" || !uuid.test(body.token) ||
      typeof body.tableId !== "string" || !uuid.test(body.tableId)) {
      return NextResponse.json({ error: "Mesa no válida." }, { status: 400 });
    }
    const supabase = createSupabaseAdminClient();
    const storeId = await getStoreIdByTableOrderToken(supabase, body.token);
    if (!storeId) return NextResponse.json({ error: "QR no válido." }, { status: 404 });
    const { data, error } = await supabase.rpc("request_table_waiter", { p_store_id: storeId, p_table_id: body.tableId });
    if (error) {
      if (error.code === "P0001") return NextResponse.json({ error: error.message === "La llamada al mesero no esta disponible."
        ? "La asistencia no está disponible en este momento." : error.message }, { status: 400 });
      throw error;
    }
    const call = Array.isArray(data) ? data[0] : data;
    if (!call?.requested_at) throw new Error("No call returned");
    return NextResponse.json({ requestedAt: call.requested_at });
  } catch {
    return NextResponse.json({ error: "No se pudo pedir asistencia. Intenta nuevamente." }, { status: 500 });
  }
}
