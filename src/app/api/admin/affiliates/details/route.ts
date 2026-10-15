import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const { searchParams } = request.nextUrl;
    const allyKey = searchParams.get("allyKey") || "";
    const section = searchParams.get("section") || "";
    const page = Number(searchParams.get("page") || 1);
    const agencyId = allyKey.startsWith("agency:") ? allyKey.slice(7) : "";
    const email = allyKey.startsWith("email:") ? allyKey.slice(6).toLowerCase() : "";
    if ((!UUID.test(agencyId) && !EMAIL.test(email)) || !["codes", "stores", "settlements"].includes(section)
      || !Number.isSafeInteger(page) || page < 1 || page > 100000) {
      return NextResponse.json({ error: "Elige un aliado, una seccion y una pagina validos." }, { status: 400 });
    }

    const db = createSupabaseAdminClient();
    const from = (page - 1) * PAGE_SIZE;
    let rows: Record<string, unknown>[] = [];
    let payoutAccount = null;

    if (section === "codes") {
      let query = db.from("affiliate_codes")
        .select("id, code, name, contact, status, partner_type, beneficiary_email, transport_agency_id, discount_percent, setup_commission_percent, commission_percent, duration_months, used_count, max_uses")
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(from, from + PAGE_SIZE);
      query = agencyId ? query.eq("transport_agency_id", agencyId) : query.eq("beneficiary_email", email);
      const [codes, payout] = await Promise.all([
        query,
        agencyId
          ? db.from("affiliate_payout_accounts").select("beneficiary_email, transport_agency_id, holder_name, bank_name, document_number, phone").eq("transport_agency_id", agencyId).maybeSingle()
          : db.from("affiliate_payout_accounts").select("beneficiary_email, transport_agency_id, holder_name, bank_name, document_number, phone").eq("beneficiary_email", email).maybeSingle(),
      ]);
      if (codes.error) throw codes.error;
      if (payout.error) throw payout.error;
      rows = codes.data || [];
      payoutAccount = payout.data;
    } else if (section === "stores") {
      let query = db.from("affiliate_referrals")
        .select("id, affiliate_code_id, store_id, fee_started_at, fee_ends_at, commerce_registration_requests(store_name)")
        .not("store_id", "is", null)
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(from, from + PAGE_SIZE);
      query = agencyId ? query.eq("transport_agency_id", agencyId) : query.eq("beneficiary_email", email);
      const result = await query;
      if (result.error) throw result.error;
      rows = result.data || [];
    } else {
      let query = db.from("affiliate_settlements")
        .select("id, affiliate_code_id, amount_usd, paid_at, method, reference, affiliate_codes!inner(id)")
        .order("paid_at", { ascending: false }).order("id", { ascending: false })
        .range(from, from + PAGE_SIZE);
      query = agencyId ? query.eq("affiliate_codes.transport_agency_id", agencyId) : query.eq("affiliate_codes.beneficiary_email", email);
      const result = await query;
      if (result.error) throw result.error;
      rows = (result.data || []).map(({ affiliate_codes: _code, ...settlement }) => settlement);
    }

    const hasMore = rows.length > PAGE_SIZE;
    return NextResponse.json({ allyKey, section, rows: rows.slice(0, PAGE_SIZE), payoutAccount, pagination: { page, pageSize: PAGE_SIZE, hasMore } },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminErrorResponse(error, "No se pudo cargar el detalle del aliado.");
  }
}
