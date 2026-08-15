import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import {
  isMissingAdminMetricsRpc,
  loadAdminStoreMetricsFallback,
  loadAdminSummaryMetricsFallback,
} from "@/lib/admin/metrics-fallback";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPlan } from "@/lib/plans";
import { isDateBeforeToday } from "@/lib/subscription-status";

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPendingServiceFees(stores: any[], orders: any[]) {
  const storesById = new Map(
    stores
      .filter((store) => store.is_test !== true)
      .map((store) => [store.id, store])
  );

  return Number(
    orders
      .reduce((sum, order) => {
        const store = storesById.get(order.store_id);
        if (!store || store.plan_type !== "per_service") {
          return sum;
        }
        const periodStart =
          store.last_payment_at ||
          store.subscription_started_at ||
          store.trial_ends_at ||
          store.created_at;
        if (periodStart && new Date(order.created_at) < new Date(periodStart)) return sum;
        return sum + toNumber(order.platform_service_fee_usd);
      }, 0)
      .toFixed(2)
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    const supabase = createSupabaseAdminClient();

    const [
      storesResult,
      recentStoresResult,
      summaryMetricsResult,
      storeMetricsResult,
      financialMetricsResult,
    ] = await Promise.all([
      supabase.from("stores").select(`
        id,
        slug,
        name,
        business_type,
        whatsapp,
        is_active,
        plan_type,
        trial_ends_at,
        subscription_status,
        next_payment_due_at,
        monthly_price_usd,
        payment_methods,
        accepts_delivery
        ,is_test
        ,subscription_started_at
        ,last_payment_at
        ,created_at
      `),
      supabase
        .from("stores")
        .select("id, slug, name, business_type, whatsapp, is_active, created_at, plan_type, trial_ends_at, subscription_status")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.rpc("admin_summary_metrics").maybeSingle(),
      supabase.rpc("admin_store_metrics"),
      supabase.rpc("admin_financial_metrics").maybeSingle(),
    ]);

    if (storesResult.error) throw storesResult.error;
    if (recentStoresResult.error) throw recentStoresResult.error;
    if (summaryMetricsResult.error && !isMissingAdminMetricsRpc(summaryMetricsResult.error)) {
      throw summaryMetricsResult.error;
    }
    if (storeMetricsResult.error && !isMissingAdminMetricsRpc(storeMetricsResult.error)) {
      throw storeMetricsResult.error;
    }
    const stores = storesResult.data || [];
    let financialMetrics = financialMetricsResult.error
      ? null
      : (financialMetricsResult.data as Record<string, unknown> | null);

    if (!financialMetrics) {
      const [approvedPaymentsResult, serviceFeesResult] = await Promise.all([
        supabase
          .from("store_subscription_payments")
          .select("amount_usd")
          .eq("status", "approved")
          .limit(10000),
        supabase
          .from("orders")
          .select("store_id, status, created_at, platform_service_fee_usd")
          .gt("platform_service_fee_usd", 0)
          .limit(10000),
      ]);
      if (approvedPaymentsResult.error) throw approvedPaymentsResult.error;
      if (serviceFeesResult.error) throw serviceFeesResult.error;

      financialMetrics = {
        approved_payments_usd: Number(
          (approvedPaymentsResult.data || [])
            .reduce((sum: number, payment: any) => sum + toNumber(payment.amount_usd), 0)
            .toFixed(2)
        ),
        pending_service_fees_usd: getPendingServiceFees(
          stores,
          serviceFeesResult.data || []
        ),
      };
    }
    const summaryMetrics = (summaryMetricsResult.error
      ? await loadAdminSummaryMetricsFallback(supabase)
      : summaryMetricsResult.data || {}) as Record<string, unknown>;
    const storeMetricsRows = storeMetricsResult.error
      ? await loadAdminStoreMetricsFallback(supabase)
      : storeMetricsResult.data || [];
    const storeMetrics = new Map(
      storeMetricsRows.map((entry: any) => [entry.store_id, entry])
    );
    const now = Date.now();
    const threeDaysFromNow = now + 3 * 24 * 60 * 60 * 1000;

    const alerts = stores.flatMap((store: any) => {
      const storeAlerts: Array<{ type: string; storeId: string; storeName: string; message: string }> = [];
      const trialEndsAt = store.trial_ends_at ? new Date(store.trial_ends_at).getTime() : null;
      const paymentDueAt = store.next_payment_due_at || null;

      if (trialEndsAt && trialEndsAt >= now && trialEndsAt <= threeDaysFromNow) {
        storeAlerts.push({
          type: "trial_ending",
          storeId: store.id,
          storeName: store.name,
          message: "Trial vence en 3 dias o menos.",
        });
      }
      if (
        store.subscription_status === "expired" ||
        store.subscription_status === "past_due" ||
        isDateBeforeToday(paymentDueAt, new Date(now))
      ) {
        storeAlerts.push({
          type: "expired",
          storeId: store.id,
          storeName: store.name,
          message: "Cuenta vencida o pago pendiente.",
        });
      }
      if (!toNumber((storeMetrics.get(store.id) as any)?.active_product_count)) {
        storeAlerts.push({
          type: "no_products",
          storeId: store.id,
          storeName: store.name,
          message: "No tiene productos activos.",
        });
      }
      if (!Array.isArray(store.payment_methods) || store.payment_methods.length === 0) {
        storeAlerts.push({
          type: "no_payments",
          storeId: store.id,
          storeName: store.name,
          message: "No tiene metodos de pago configurados.",
        });
      }
      if (!store.whatsapp) {
        storeAlerts.push({
          type: "no_whatsapp",
          storeId: store.id,
          storeName: store.name,
          message: "No tiene WhatsApp receptor.",
        });
      }

      return storeAlerts;
    });

    return NextResponse.json({
      summary: {
        totalStores: stores.length,
        activeStores: stores.filter((store: any) => store.is_active !== false).length,
        inactiveStores: stores.filter((store: any) => store.is_active === false).length,
        trialStores: stores.filter((store: any) => store.plan_type === "trial" || store.subscription_status === "trial").length,
        expiredStores: stores.filter(
          (store: any) =>
            store.subscription_status === "expired" ||
            store.subscription_status === "past_due" ||
            isDateBeforeToday(store.next_payment_due_at || store.trial_ends_at)
        ).length,
        totalOrders: toNumber(summaryMetrics.total_orders),
        ordersToday: toNumber(summaryMetrics.orders_today),
        ordersLast7Days: toNumber(summaryMetrics.orders_last_7_days),
        totalProducts: toNumber(summaryMetrics.total_products),
        totalAssignments: toNumber(summaryMetrics.total_assignments),
        totalCustomers: toNumber(summaryMetrics.total_customers),
        estimatedMrrUsd: stores.reduce((sum: number, store: any) => {
          if (
            store.is_active === false ||
            ["cancelled", "paused", "expired", "past_due"].includes(store.subscription_status) ||
            isDateBeforeToday(store.next_payment_due_at || store.trial_ends_at)
          ) return sum;
          const configuredPrice = Number(store.monthly_price_usd || 0);
          return sum + (configuredPrice || getPlan(store.plan_type).priceUsd);
        }, 0),
        revenueUsd: toNumber(summaryMetrics.revenue_usd),
        approvedPaymentsUsd: toNumber(financialMetrics.approved_payments_usd),
        pendingServiceFeesUsd: toNumber(financialMetrics.pending_service_fees_usd),
        attentionStores: new Set(alerts.map((alert) => alert.storeId)).size,
      },
      recentStores: recentStoresResult.data || [],
      alerts: alerts.slice(0, 12),
      auth: {
        mode: auth.mode,
        email: auth.email || null,
      },
    });
  } catch (error) {
    return adminErrorResponse(error, "Error cargando resumen admin.");
  }
}
