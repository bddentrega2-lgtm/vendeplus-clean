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
        is_active: true,
        subscription_status: "active",
      })
      .eq("id", storeId)
      .select(adminStoreSelect)
      .single();

    if (error) throw error;

    return NextResponse.json({
      store: data,
      message: "Comercio reactivado.",
    });
  } catch (error) {
    return adminErrorResponse(error, "Error reactivando comercio.");
  }
}
