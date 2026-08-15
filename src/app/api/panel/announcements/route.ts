import { NextRequest, NextResponse } from "next/server";
import { getPanelAuthContext } from "@/lib/panel/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const auth = await getPanelAuthContext(request);
    if (!auth.isAuthorized) {
      return NextResponse.json({ error: auth.error || "No autorizado." }, { status: 401 });
    }

    const now = new Date().toISOString();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("panel_announcements")
      .select("id, title, message, kind, action_label, action_url, starts_at, ends_at")
      .eq("is_active", true)
      .lte("starts_at", now)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .order("starts_at", { ascending: false })
      .limit(3);

    if (error) throw error;
    return NextResponse.json({ announcements: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar las novedades." },
      { status: 500 }
    );
  }
}
