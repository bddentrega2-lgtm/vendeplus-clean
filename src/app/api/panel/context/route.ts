import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("stores")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (!auth.isFounderMode) {
      query = auth.storeIds?.length
        ? query.in("id", auth.storeIds)
        : query.eq("id", "__no_authorized_store__");
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      isFounderMode: auth.isFounderMode,
      stores: data || [],
    });
  } catch (error) {
    return panelErrorResponse(error, "Error cargando comercios disponibles.");
  }
}
