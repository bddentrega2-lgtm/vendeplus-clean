import { NextRequest, NextResponse } from "next/server";
import { requirePanelAuth, panelErrorResponse } from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";

const storeFields = `
  id,
  name,
  slug,
  logo_url,
  cover_image_url,
  subscription_status,
  subscription_ends_at,
  next_payment_due_at,
  trial_ends_at,
  brand_id,
  branch_name,
  brands(id, name, slug, logo_url)
`;

const legacyStoreFields = `
  id,
  name,
  slug,
  logo_url,
  cover_image_url,
  subscription_status,
  subscription_ends_at,
  next_payment_due_at,
  trial_ends_at
`;

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();

    const loadStores = (fields: string) => {
      let query = supabase.from("stores").select(fields).order("name", { ascending: true });
      if (auth.storeIds !== null) query = query.in("id", auth.storeIds);
      return query;
    };

    let { data, error } = await loadStores(storeFields);

    if (error && isMissingColumnError(error, ["brand_id", "branch_name", "brands"])) {
      const fallback = await loadStores(legacyStoreFields);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    return NextResponse.json({ stores: data || [] });
  } catch (error) {
    console.error("Panel context error:", error);
    return panelErrorResponse(error, "No pudimos cargar tus sedes.");
  }
}
