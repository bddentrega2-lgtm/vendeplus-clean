import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertStoreAccess, assertStoreManager, badRequest, panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";

const select = "store_id, is_enabled, trigger_mode, paper_width_mm, copies, include_prices, connector, connection_type, baud_rate";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const storeId = String(request.headers.get("x-panel-store-id") || "").trim();
    if (!storeId) return badRequest("Selecciona un comercio.");
    assertStoreAccess(auth, storeId);
    const { data, error } = await createSupabaseAdminClient().from("store_print_settings").select(select).eq("store_id", storeId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ settings: data || { store_id: storeId, is_enabled: false, trigger_mode: "received", paper_width_mm: 58, copies: 1, include_prices: false, connector: "agent", connection_type: "bluetooth", baud_rate: 9600 } });
  } catch (error) {
    return panelErrorResponse(error, "No se pudo cargar la configuracion de impresion.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const storeId = String(request.headers.get("x-panel-store-id") || "").trim();
    if (!storeId) return badRequest("Selecciona un comercio.");
    assertStoreManager(auth, storeId);
    const body = await request.json();
    const triggerMode = ["received", "paid", "both"].includes(body.triggerMode) ? body.triggerMode : "received";
    const payload = {
      store_id: storeId,
      is_enabled: body.isEnabled === true,
      trigger_mode: triggerMode,
      paper_width_mm: Number(body.paperWidthMm) === 80 ? 80 : 58,
      copies: Math.min(3, Math.max(1, Number(body.copies) || 1)),
      include_prices: body.includePrices === true,
      connector: "agent",
      updated_at: new Date().toISOString(),
    };
    const supabase = createSupabaseAdminClient();
    if (payload.is_enabled) {
      const { data: device } = await supabase.from("print_agent_devices").select("id").eq("store_id", storeId).is("revoked_at", null).limit(1).maybeSingle();
      if (!device) return badRequest("Vincula primero la app Somos.");
    }
    const { data, error } = await supabase.from("store_print_settings").upsert(payload, { onConflict: "store_id" }).select(select).single();
    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (error) {
    return panelErrorResponse(error, "No se pudo guardar la configuracion de impresion.");
  }
}
