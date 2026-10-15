import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 100;

type PendingCommission = {
  id: string;
  referral_id: string;
  kind: string;
  fee_usd: number | null;
  setup_paid_usd: number | null;
  commission_percent: number;
  amount_usd: number;
  eligible_at: string;
  status: string;
  affiliate_referrals: {
    affiliate_code_id: string;
    beneficiary_email: string | null;
    transport_agency_id: string | null;
    affiliate_codes: { id: string; code: string; name: string } | null;
    commerce_registration_requests: { store_name: string } | null;
  };
};

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const params = request.nextUrl.searchParams;
    const allyKey = params.get("allyKey") || "";
    const page = Number(params.get("page") || 1);
    const status = params.get("status") || "available";
    const agencyId = allyKey.startsWith("agency:") ? allyKey.slice(7) : "";
    const email = allyKey.startsWith("email:") ? allyKey.slice(6) : "";
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !["available", "history"].includes(status) ||
        (!/^[0-9a-f-]{36}$/i.test(agencyId) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
      return NextResponse.json({ error: "Elige un aliado y una pagina valida." }, { status: 400 });
    }
    const db = createSupabaseAdminClient();
    let query = db.from("affiliate_commissions")
      .select("id, referral_id, kind, fee_usd, setup_paid_usd, commission_percent, amount_usd, eligible_at, status, affiliate_referrals!inner(affiliate_code_id, beneficiary_email, transport_agency_id, affiliate_codes(id, code, name), commerce_registration_requests(store_name))", { count: "exact" })
      .order("created_at", { ascending: status === "available" }).order("id", { ascending: status === "available" })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    query = status === "history" ? query.in("status", ["paid", "reversed"]) : query.eq("status", "available");
    query = agencyId ? query.eq("affiliate_referrals.transport_agency_id", agencyId)
      : query.eq("affiliate_referrals.beneficiary_email", email.toLowerCase());
    const { data, count, error } = await query.returns<PendingCommission[]>();
    if (error) throw error;
    const rows = data || [];
    const ids = rows.map((row) => row.id);
    const totals = new Map<string, number>();
    const adjustmentsByCommission = new Map<string, Array<{ id: string; amount_usd: number; reason: string; created_at: string }>>();
    for (let offset = 0; ids.length; offset += 500) {
      const adjustments = await db.from("affiliate_commission_adjustments")
        .select("id, commission_id, amount_usd, reason, created_at").in("commission_id", ids).order("id").range(offset, offset + 499);
      if (adjustments.error) throw adjustments.error;
      for (const adjustment of adjustments.data || []) {
        totals.set(adjustment.commission_id, (totals.get(adjustment.commission_id) || 0) + Number(adjustment.amount_usd));
        const current = adjustmentsByCommission.get(adjustment.commission_id) || [];
        current.push(adjustment);
        adjustmentsByCommission.set(adjustment.commission_id, current);
      }
      if ((adjustments.data || []).length < 500) break;
    }
    const payout = status === "history" ? { data: null, error: null } : agencyId
      ? await db.from("affiliate_payout_accounts")
        .select("beneficiary_email, transport_agency_id, holder_name, bank_name, document_number, phone")
        .eq("transport_agency_id", agencyId).maybeSingle()
      : await db.from("affiliate_payout_accounts")
        .select("beneficiary_email, transport_agency_id, holder_name, bank_name, document_number, phone")
        .eq("beneficiary_email", email.toLowerCase()).maybeSingle();
    if (payout.error) throw payout.error;
    return NextResponse.json({
      allyKey,
      commissions: rows.map(({ affiliate_referrals: referral, ...row }) => ({
        ...row,
        codeId: referral.affiliate_code_id,
        codeName: referral.affiliate_codes?.code || "",
        allyName: referral.affiliate_codes?.name || "",
        storeName: referral.commerce_registration_requests?.store_name || "Comercio",
        netAmountUsd: Math.max(0, Math.round((Number(row.amount_usd) + (totals.get(row.id) || 0)) * 100) / 100),
        adjustments: adjustmentsByCommission.get(row.id) || [],
      })),
      payoutAccount: payout.data,
      pagination: { page, pageSize: PAGE_SIZE, total: count || 0, totalPages: Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)) },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return adminErrorResponse(error, "No se pudieron cargar las comisiones pendientes."); }
}
