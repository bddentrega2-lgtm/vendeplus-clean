import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    const body = await request.json();
    const commissionId = String(body.commissionId || "");
    const refundUsd = Number(body.refundUsd);
    const reference = String(body.reference || "").trim().slice(0, 120);
    if (!/^[0-9a-f-]{36}$/i.test(commissionId) || !Number.isFinite(refundUsd) || refundUsd <= 0 || !reference) {
      return NextResponse.json({ error: "Indica comision, importe reintegrado y referencia." }, { status: 400 });
    }
    const db = createSupabaseAdminClient();
    const { data: commission, error: lookupError } = await db.from("affiliate_commissions")
      .select("kind").eq("id", commissionId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!commission) return NextResponse.json({ error: "Comision no encontrada." }, { status: 404 });
    const { data, error } = commission.kind === "setup"
      ? await db.rpc("adjust_affiliate_setup_refund", {
        p_commission_id: commissionId, p_setup_refund_usd: refundUsd,
        p_reference: reference, p_actor: auth.userId,
      })
      : await db.rpc("adjust_affiliate_commission_for_fee_refund", {
        p_commission_id: commissionId, p_fee_refund_usd: refundUsd,
        p_reference: reference, p_actor: auth.userId,
      });
    if (error) return NextResponse.json({ error: "No se pudo registrar el ajuste; revisa el importe restante." }, { status: 409 });
    return NextResponse.json({ adjustmentId: data });
  } catch (error) { return adminErrorResponse(error, "No se pudo ajustar la comision."); }
}
