import { NextRequest, NextResponse } from "next/server";
import { getPanelAuthContext, normalizeAuthEmail } from "@/lib/panel/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAffiliateDashboard } from "@/lib/server/affiliate-dashboard";
import { affiliatePreviewDemo } from "@/lib/server/affiliate-preview-demo";

export async function GET(request: NextRequest) {
  const auth = await getPanelAuthContext(request);
  if (!auth.isAuthorized || !auth.userId || !auth.email) {
    return NextResponse.json({ error: "Inicia sesion." }, { status: 401 });
  }
  try {
    const db = createSupabaseAdminClient();
    const { data: identity, error: identityError } = await db.auth.admin.getUserById(auth.userId);
    if (identityError) throw identityError;
    if (!identity.user?.email_confirmed_at || normalizeAuthEmail(identity.user.email) !== auth.email) {
      return NextResponse.json({ error: "Verifica tu correo para ver tus referidos." }, { status: 403 });
    }
    const { data: codes, error: codeError } = await db.from("affiliate_codes")
      .select("id, code, status, partner_type, discount_percent, setup_commission_percent, commission_percent, duration_months")
      .eq("beneficiary_email", auth.email).neq("partner_type", "delivery")
      .order("created_at", { ascending: false });
    if (codeError) throw codeError;
    return NextResponse.json(affiliatePreviewDemo(auth.email, codes || []) || await loadAffiliateDashboard(db, codes || []));
  } catch {
    return NextResponse.json({ error: "No se pudieron cargar tus referidos." }, { status: 500 });
  }
}
