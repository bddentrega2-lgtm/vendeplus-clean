import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    await requireAdminAuth(request);
    const { storeId } = await context.params;
    const body = await request.json();

    if (!storeId) {
      return NextResponse.json({ error: "Falta el comercio." }, { status: 400 });
    }
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "Indica si el inventario debe estar habilitado." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name")
      .eq("id", storeId)
      .single();
    if (storeError) throw storeError;

    const { data: current, error: currentError } = await supabase
      .from("store_inventory_settings")
      .select("enabled_at")
      .eq("store_id", storeId)
      .maybeSingle();
    if (currentError) throw currentError;

    const now = new Date().toISOString();
    const { data: settings, error } = await supabase
      .from("store_inventory_settings")
      .upsert({
        store_id: storeId,
        enabled: body.enabled,
        enabled_at: body.enabled ? current?.enabled_at || now : current?.enabled_at || null,
        updated_at: now,
      }, { onConflict: "store_id" })
      .select("store_id, enabled")
      .single();
    if (error) throw error;

    return NextResponse.json({
      store: { id: store.id, name: store.name, inventory_enabled: settings.enabled },
      message: body.enabled
        ? `Inventario habilitado para ${store.name}.`
        : `Inventario deshabilitado para ${store.name}.`,
    });
  } catch (error) {
    return adminErrorResponse(error, "No se pudo actualizar el acceso a Inventario.");
  }
}
