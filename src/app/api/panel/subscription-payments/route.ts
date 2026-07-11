import { NextRequest, NextResponse } from "next/server";
import { getPlan, PER_SERVICE_FEE_USD } from "@/lib/plans";
import {
  assertStoreManager,
  badRequest,
  canUseStoreRole,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function money(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function isCommercialPlan(value: unknown) {
  const plan = cleanText(value);
  return plan === "monthly" || plan === "per_service";
}

async function getServiceUsage(supabase: any, store: any) {
  const periodStart =
    store.last_payment_at ||
    store.subscription_started_at ||
    store.trial_ends_at ||
    store.created_at ||
    new Date().toISOString();

  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)
    .gte("created_at", periodStart);

  if (error) throw error;

  const serviceCount = count || 0;
  const amountUsd = Number((serviceCount * PER_SERVICE_FEE_USD).toFixed(2));

  return {
    serviceCount,
    amountUsd,
    periodStart,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();
    const managerStoreIds =
      auth.storeIds === null
        ? null
        : auth.storeIds.filter((id) => canUseStoreRole(auth, id, ["owner", "admin"]));

    let storesQuery = supabase
      .from("stores")
      .select("id, name, slug, plan_type, subscription_status, trial_ends_at, subscription_started_at, subscription_ends_at, next_payment_due_at, monthly_price_usd, usd_to_bs, last_payment_at, created_at")
      .order("name", { ascending: true });

    let paymentsQuery = supabase
      .from("store_subscription_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (managerStoreIds !== null) {
      storesQuery = managerStoreIds.length
        ? storesQuery.in("id", managerStoreIds)
        : storesQuery.eq("id", "__no_authorized_store__");
      paymentsQuery = managerStoreIds.length
        ? paymentsQuery.in("store_id", managerStoreIds)
        : paymentsQuery.eq("store_id", "__no_authorized_store__");
    }

    const [storesResult, paymentsResult] = await Promise.all([storesQuery, paymentsQuery]);
    if (storesResult.error) throw storesResult.error;

    const stores = storesResult.data || [];
    const serviceUsageByStore = Object.fromEntries(
      await Promise.all(
        stores.map(async (store: any) => [
          store.id,
          store.plan_type === "per_service"
            ? await getServiceUsage(supabase, store)
            : { serviceCount: 0, amountUsd: 0, periodStart: null },
        ])
      )
    );

    return NextResponse.json({
      stores: storesResult.data || [],
      payments: paymentsResult.error ? [] : paymentsResult.data || [],
      paymentsAvailable: !paymentsResult.error,
      serviceUsageByStore,
    });
  } catch (error) {
    return panelErrorResponse(error, "Error cargando suscripción.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const storeId = cleanText(body.storeId);
    const billingPeriod = "monthly";
    const action = cleanText(body.action);
    const selectedPlanId = cleanText(body.planId);

    if (!storeId) return badRequest("Selecciona un comercio.");
    assertStoreManager(auth, storeId, "No tienes permiso para pagar este comercio.");

    const supabase = createSupabaseAdminClient();
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, plan_type, subscription_status, trial_ends_at, subscription_started_at, subscription_ends_at, next_payment_due_at, monthly_price_usd, usd_to_bs, last_payment_at, created_at")
      .eq("id", storeId)
      .single();

    if (storeError) throw storeError;

    if (action === "choose_plan" && selectedPlanId === "per_service") {
      const nextDue = addMonths(new Date(), 1).toISOString();
      const { data, error } = await supabase
        .from("stores")
        .update({
          plan_type: "per_service",
          subscription_status: "active",
          subscription_started_at: new Date().toISOString(),
          subscription_ends_at: nextDue,
          next_payment_due_at: nextDue,
          monthly_price_usd: PER_SERVICE_FEE_USD,
        })
        .eq("id", storeId)
        .select("id, plan_type, subscription_status, next_payment_due_at")
        .single();

      if (error) throw error;

      return NextResponse.json({
        store: data,
        message: "Plan por servicio activado. Se hará corte mensual con lo acumulado.",
      });
    }

    const effectivePlanId =
      action === "choose_plan" && isCommercialPlan(selectedPlanId)
        ? selectedPlanId
        : cleanText((store as any).plan_type);
    const plan = getPlan(effectivePlanId);
    let amountUsd = plan.priceUsd;

    if (effectivePlanId === "monthly") {
      amountUsd = 20;
    } else if (effectivePlanId === "per_service") {
      const usage = await getServiceUsage(supabase, store);
      amountUsd = usage.amountUsd;
      if (amountUsd <= 0) {
        return badRequest("No hay servicios acumulados para cobrar en este corte.");
      }
    } else {
      return badRequest("Elige un plan comercial para continuar.");
    }

    const exchangeRate = money((store as any).usd_to_bs) || 600;
    const paymentReference = cleanText(body.paymentReference);
    const paymentBank = cleanText(body.paymentBank);
    const paidAt = cleanText(body.paidAt);

    if (!paymentReference) return badRequest("Indica la referencia del pago.");
    if (!paymentBank) return badRequest("Indica el banco emisor.");
    if (!paidAt) return badRequest("Indica la fecha de pago.");

    const { data, error } = await supabase
      .from("store_subscription_payments")
      .insert({
        store_id: storeId,
        plan_type: effectivePlanId,
        billing_period: billingPeriod,
        amount_usd: amountUsd,
        amount_bs: Number((amountUsd * exchangeRate).toFixed(2)),
        exchange_rate: exchangeRate,
        payment_reference: paymentReference,
        payment_bank: paymentBank,
        paid_at: paidAt,
        notes: cleanText(body.notes) || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      payment: data,
      message: "Pago enviado a revisión.",
    });
  } catch (error) {
    return panelErrorResponse(error, "Error enviando pago.");
  }
}
