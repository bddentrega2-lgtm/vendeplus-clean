import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    const body = await request.json();
    const ids = Array.isArray(body.commissionIds) ? body.commissionIds.map(String) : [];
    if (!ids.length || ids.length > 100 || ids.some((id: string) => !/^[0-9a-f-]{36}$/i.test(id))) {
      return NextResponse.json({ error: "Selecciona comisiones validas." }, { status: 400 });
    }
    const method = String(body.method || "").trim().slice(0, 80);
    const reference = String(body.reference || "").trim().slice(0, 120);
    const paidAtText = String(body.paidAt || "");
    const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(paidAtText) ? new Date(`${paidAtText}T12:00:00-04:00`) : new Date(NaN);
    if (!method || !reference || !Number.isFinite(paidAt.valueOf()) || paidAt.getTime() > Date.now() + 86_400_000) {
      return NextResponse.json({ error: "Indica fecha, metodo y referencia del pago realizado." }, { status: 400 });
    }
    const { data, error } = await createSupabaseAdminClient().rpc("settle_affiliate_commissions", {
      p_commission_ids: ids, p_paid_at: paidAt.toISOString(), p_method: method,
      p_reference: reference, p_actor: auth.userId,
    });
    if (error) return NextResponse.json({ error: "Las comisiones ya no estan disponibles o pertenecen a distintos aliados." }, { status: 409 });
    return NextResponse.json({ settlementId: data });
  } catch (error) { return adminErrorResponse(error, "No se pudo registrar la liquidacion."); }
}
