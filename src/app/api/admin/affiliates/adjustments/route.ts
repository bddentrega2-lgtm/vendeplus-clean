import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    const body = await request.json();
    const commissionId = String(body.commissionId || "");
    const feeRefundUsd = Number(body.feeRefundUsd);
    const reference = String(body.reference || "").trim().slice(0, 120);
    if (!/^[0-9a-f-]{36}$/i.test(commissionId) || !Number.isFinite(feeRefundUsd) || feeRefundUsd <= 0 || !reference) {
      return NextResponse.json({ error: "Indica comision, fee reintegrado y referencia." }, { status: 400 });
    }
    const { data, error } = await createSupabaseAdminClient().rpc("adjust_affiliate_commission_for_fee_refund", {
      p_commission_id: commissionId, p_fee_refund_usd: feeRefundUsd,
      p_reference: reference, p_actor: auth.userId,
    });
    if (error) return NextResponse.json({ error: "No se pudo registrar el ajuste; revisa el fee restante." }, { status: 409 });
    return NextResponse.json({ adjustmentId: data });
  } catch (error) { return adminErrorResponse(error, "No se pudo ajustar la comision."); }
}
