import { NextRequest, NextResponse } from "next/server";
import { assertStoreAccess, panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const storeId = request.nextUrl.searchParams.get("storeId") || "";
    if (!storeId) return NextResponse.json({ error: "Selecciona un comercio." }, { status: 400 });
    if (storeId !== "all") assertStoreAccess(auth, storeId, "No tienes permiso para consultar este comercio.");

    const supabase = createSupabaseAdminClient();
    let query = supabase.from("orders")
      .select("id,store_id,public_code,customer_name,status,created_at")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(50);
    if (auth.storeIds !== null) query = query.in("store_id", auth.storeIds);
    if (storeId !== "all") query = query.eq("store_id", storeId);
    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ orders: data || [], serverTime: new Date().toISOString() }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return panelErrorResponse(error, "No pudimos consultar las notificaciones.");
  }
}
