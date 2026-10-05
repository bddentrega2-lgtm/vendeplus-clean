import { NextRequest, NextResponse } from "next/server";
import { getPanelAuthContext } from "@/lib/panel/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const auth = await getPanelAuthContext(request);
  if (!auth.isAuthorized || !auth.userId) return NextResponse.json({ error: "Inicia sesion." }, { status: 401 });
  const db = createSupabaseAdminClient();
  const { data: codes, error: codeError } = await db.from("affiliate_codes")
    .select("id, code, status, discount_percent, commission_percent, duration_months")
    .eq("beneficiary_user_id", auth.userId).order("created_at", { ascending: false });
  if (codeError) return NextResponse.json({ error: "No se pudieron cargar tus codigos." }, { status: 500 });
  const codeIds = (codes || []).map((code) => code.id);
  if (!codeIds.length) return NextResponse.json({ codes: [], referrals: [], commissions: [], settlements: [], adjustments: [], pendingUsd: 0 });
  const [referrals, settlements, pending] = await Promise.all([
    db.from("affiliate_referrals")
      .select("id, affiliate_code_id, discount_percent, commission_percent, duration_months, activated_at, ends_at, timezone, commerce_registration_requests(request_code, store_name, status, setup_payment_status), stores(name)")
      .eq("beneficiary_user_id", auth.userId).order("created_at", { ascending: false }).limit(200),
    db.from("affiliate_settlements").select("id, amount_usd, paid_at, method, reference")
      .eq("beneficiary_user_id", auth.userId).order("paid_at", { ascending: false }).limit(100),
    db.rpc("affiliate_pending_fee_commission", { p_beneficiary: auth.userId }),
  ]);
  if (referrals.error || settlements.error || pending.error) return NextResponse.json({ error: "No se pudo cargar el historial." }, { status: 500 });
  const referralIds = (referrals.data || []).map((row) => row.id);
  const commissions = referralIds.length
    ? await db.from("affiliate_commissions").select("id, referral_id, fee_usd, commission_percent, amount_usd, eligible_at, status")
      .in("referral_id", referralIds).order("created_at", { ascending: false }).limit(500)
    : { data: [], error: null };
  if (commissions.error) return NextResponse.json({ error: "No se pudieron cargar las comisiones." }, { status: 500 });
  const commissionIds = (commissions.data || []).map((item) => item.id);
  const adjustments = commissionIds.length
    ? await db.from("affiliate_commission_adjustments").select("commission_id, amount_usd, created_at")
      .in("commission_id", commissionIds).limit(500)
    : { data: [], error: null };
  if (adjustments.error) return NextResponse.json({ error: "No se pudieron cargar los ajustes." }, { status: 500 });
  return NextResponse.json({ codes, referrals: referrals.data, commissions: commissions.data, settlements: settlements.data, adjustments: adjustments.data, pendingUsd: Number(pending.data || 0) });
}
