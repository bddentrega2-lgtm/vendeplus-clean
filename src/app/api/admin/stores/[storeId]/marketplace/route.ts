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
    if (typeof body.visible !== "boolean") {
      return NextResponse.json(
        { error: "Indica si el comercio debe aparecer en Marketplace." },
        { status: 400 }
      );
    }

    const { data, error } = await createSupabaseAdminClient()
      .from("stores")
      .update({ marketplace_visible: body.visible })
      .eq("id", storeId)
      .select("id, name, marketplace_visible")
      .single();
    if (error) throw error;

    return NextResponse.json({
      store: data,
      message: body.visible
        ? `${data.name} ahora aparece en Marketplace.`
        : `${data.name} quedó fuera del Marketplace.`,
    });
  } catch (error) {
    return adminErrorResponse(error, "No se pudo actualizar la visibilidad en Marketplace.");
  }
}
