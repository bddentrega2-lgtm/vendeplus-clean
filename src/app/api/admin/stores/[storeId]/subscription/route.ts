import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import {
  adminStoreSelect,
  normalizeAdminSubscriptionPayload,
} from "@/lib/admin/stores";
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
      return NextResponse.json({ error: "Falta el ID del comercio." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("stores")
      .update(normalizeAdminSubscriptionPayload(body))
      .eq("id", storeId)
      .select(adminStoreSelect)
      .single();

    if (error) throw error;

    return NextResponse.json({
      store: data,
      message: "Suscripcion actualizada.",
    });
  } catch (error) {
    return adminErrorResponse(error, "Error actualizando suscripcion.");
  }
}
