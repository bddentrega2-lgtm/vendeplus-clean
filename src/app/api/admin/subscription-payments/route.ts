import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PER_SERVICE_FEE_USD } from "@/lib/plans";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const status = cleanText(searchParams.get("status")) || "pending";

    let query = supabase
      .from("store_subscription_payments")
      .select("*, stores(id, name, slug, subscription_ends_at, next_payment_due_at)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ payments: data || [] });
  } catch (error) {
    return adminErrorResponse(error, "Error cargando pagos.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    const body = await request.json();
    const paymentId = cleanText(body.paymentId);
    const action = cleanText(body.action);

    if (!paymentId) {
      return NextResponse.json({ error: "Falta el pago." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: payment, error: paymentError } = await supabase
      .from("store_subscription_payments")
      .select("*, stores(id, subscription_ends_at, next_payment_due_at)")
      .eq("id", paymentId)
      .single();

    if (paymentError) throw paymentError;
    if (!payment || (payment as any).status !== "pending") {
      return NextResponse.json({ error: "El pago ya fue revisado." }, { status: 400 });
    }

    const status = action === "reject" ? "rejected" : "approved";

    if (status === "approved") {
      const planType = cleanText((payment as any).plan_type) || "monthly";
      const baseDate = new Date();
      const days = (payment as any).billing_period === "annual" ? 365 : 30;
      const nextDue = addDays(baseDate, days).toISOString();

      const subscriptionUpdate: Record<string, unknown> = {
        plan_type: planType,
        subscription_status: "active",
        subscription_started_at: new Date().toISOString(),
        subscription_ends_at: nextDue,
        next_payment_due_at: nextDue,
        last_payment_at: new Date().toISOString(),
        service_fee_billing_cycle: "monthly",
      };
      if (planType === "monthly") subscriptionUpdate.monthly_price_usd = 20;
      if (planType === "per_service") subscriptionUpdate.monthly_price_usd = PER_SERVICE_FEE_USD;

      const { error: storeError } = await supabase
        .from("stores")
        .update(subscriptionUpdate)
        .eq("id", (payment as any).store_id);

      if (storeError) throw storeError;
    }

    const { data, error } = await supabase
      .from("store_subscription_payments")
      .update({
        status,
        reviewed_by: auth.userId || null,
        reviewed_at: new Date().toISOString(),
        notes: cleanText(body.reviewNotes) || (payment as any).notes || null,
      })
      .eq("id", paymentId)
      .select("*, stores(id, name, slug, subscription_ends_at, next_payment_due_at)")
      .single();

    if (error) throw error;

    return NextResponse.json({
      payment: data,
      message: status === "approved" ? "Pago aprobado. El nuevo periodo queda activo por 30 días desde hoy." : "Pago rechazado.",
    });
  } catch (error) {
    return adminErrorResponse(error, "Error revisando pago.");
  }
}
