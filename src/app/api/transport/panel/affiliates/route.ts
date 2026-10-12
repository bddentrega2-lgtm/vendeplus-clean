import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAffiliateDashboard } from "@/lib/server/affiliate-dashboard";
import { affiliatePreviewDemo } from "@/lib/server/affiliate-preview-demo";
import { assertAgencyManager, requireTransportAgencyAuth, transportErrorResponse } from "@/lib/transport/access";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTransportAgencyAuth(request);
    const agencyId = new URL(request.url).searchParams.get("agencyId") || "";
    if (!/^[0-9a-f-]{36}$/i.test(agencyId)) {
      return NextResponse.json({ error: "Elige una empresa delivery." }, { status: 400 });
    }
    assertAgencyManager(auth, agencyId, "Solo el propietario o administrador puede ver referidos.");
    const db = createSupabaseAdminClient();
    const { data: identity, error: identityError } = await db.auth.admin.getUserById(auth.userId);
    if (identityError) throw identityError;
    if (!identity.user?.email_confirmed_at ||
        String(identity.user.email || "").trim().toLowerCase() !== String(auth.email || "").trim().toLowerCase()) {
      return NextResponse.json({ error: "Verifica tu correo para ver los referidos." }, { status: 403 });
    }
    const { data: codes, error } = await db.from("affiliate_codes")
      .select("id, code, status, partner_type, discount_percent, setup_commission_percent, commission_percent, duration_months")
      .eq("partner_type", "delivery").eq("transport_agency_id", agencyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (new URL(request.url).searchParams.get("summary") === "1") {
      return NextResponse.json({ enabled: Boolean(codes?.length) });
    }
    return NextResponse.json(affiliatePreviewDemo(String(auth.email || "").trim().toLowerCase(), codes || []) || await loadAffiliateDashboard(db, codes || []));
  } catch (error) {
    return transportErrorResponse(error, "No se pudieron cargar los referidos de esta empresa.");
  }
}
