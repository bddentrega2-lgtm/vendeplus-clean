import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PER_SERVICE_FEE_USD } from "@/lib/plans";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
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
      const store = (payment as any).stores || {};
      const planType = cleanText((payment as any).plan_type) || "monthly";
      const currentEnd = store.subscription_ends_at || store.next_payment_due_at;
      const baseDate =
        currentEnd && new Date(currentEnd).getTime() > Date.now()
          ? new Date(currentEnd)
          : new Date();
      const months = (payment as any).billing_period === "annual" ? 12 : 1;
      const nextDue = addMonths(baseDate, months).toISOString();

      const { error: storeError } = await supabase
        .from("stores")
        .update({
          plan_type: planType,
          subscription_status: "active",
          subscription_started_at: new Date().toISOString(),
          subscription_ends_at: nextDue,
          next_payment_due_at: nextDue,
          last_payment_at: new Date().toISOString(),
          monthly_price_usd:
            planType === "per_service" ? PER_SERVICE_FEE_USD : Number((payment as any).amount_usd || 20),
        })
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
      message: status === "approved" ? "Pago aprobado y suscripción extendida." : "Pago rechazado.",
    });
  } catch (error) {
    return adminErrorResponse(error, "Error revisando pago.");
  }
}
