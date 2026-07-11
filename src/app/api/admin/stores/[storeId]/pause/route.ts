import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { adminStoreSelect } from "@/lib/admin/stores";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    await requireAdminAuth(request);
    const { storeId } = await context.params;

    if (!storeId) {
      return NextResponse.json({ error: "Falta el ID del comercio." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("stores")
      .update({
        is_active: false,
        subscription_status: "paused",
      })
      .eq("id", storeId)
      .select(adminStoreSelect)
      .single();

    if (error) throw error;

    return NextResponse.json({
      store: data,
      message: "Comercio pausado. El catalogo queda sin recibir pedidos.",
    });
  } catch (error) {
    return adminErrorResponse(error, "Error pausando comercio.");
  }
}
