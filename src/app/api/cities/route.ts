import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("service_cities")
      .select("id, name, state_name, slug").eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ cities: data || [] });
  } catch {
    return NextResponse.json({ error: "No pudimos cargar las ciudades." }, { status: 500 });
  }
}
