import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertStoreAccess, badRequest, panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";

export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const auth = await requirePanelAuth(request);
    const storeId = String(request.headers.get("x-panel-store-id") || "").trim();
    if (!storeId) return badRequest("Selecciona un comercio.");
    assertStoreAccess(auth, storeId);
    const { orderId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { data: order, error: orderError } = await supabase.from("orders").select("id").eq("id", orderId).eq("store_id", storeId).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    const { data: device } = await supabase.from("print_agent_devices").select("id").eq("store_id", storeId).is("revoked_at", null).limit(1).maybeSingle();
    if (!device) return badRequest("Vincula primero la app Somos.");
    const { error } = await supabase.from("order_print_jobs").insert({ store_id: storeId, order_id: orderId, event_type: "manual", status: "pending" });
    if (error) throw error;
    return NextResponse.json({ queued: true });
  } catch (error) {
    return panelErrorResponse(error, "No se pudo enviar la comanda a impresion.");
  }
}
