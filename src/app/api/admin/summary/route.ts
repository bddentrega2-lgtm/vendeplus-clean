import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { isMissingAdminMetricsRpc, loadAdminStoreMetricsFallback } from "@/lib/admin/metrics-fallback";
import { buildPeriodSummary, getSummaryPeriod, isSummaryStoreExpired } from "@/lib/admin/summary-period";
import { loadServiceFeeBalances } from "@/lib/billing/service-fees";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 500;

async function fetchPages(buildQuery: () => any) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < PAGE_SIZE) return rows;
  }
}

async function countRows(query: any) {
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function loadStoreMetrics(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  try {
    return await fetchPages(() => supabase.rpc("admin_store_metrics").order("store_id", { ascending: true }));
  } catch (error) {
    if (!isMissingAdminMetricsRpc(error)) throw error;
    return loadAdminStoreMetricsFallback(supabase);
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    const supabase = createSupabaseAdminClient();
    const period = getSummaryPeriod(
      request.nextUrl.searchParams.get("period"),
      request.nextUrl.searchParams.get("anchor")
    );

    const stores = await fetchPages(() => supabase.from("stores").select(
      "id, slug, name, business_type, whatsapp, is_active, is_test, plan_type, trial_ends_at, subscription_status, subscription_ends_at, next_payment_due_at, payment_methods, subscription_started_at, last_payment_at, created_at"
    ).order("id", { ascending: true }));
    const realStores = stores.filter((store) => store.is_test !== true);
    const storeIds = realStores.map((store) => store.id);
    const currentMonth = getSummaryPeriod("month", null);
    const [orders, payments, approvedPayments, feeBalances, storeMetricsRows, productCount, customerCount, assignmentCount, historicalOrders, ordersThisMonth] = await Promise.all([
      storeIds.length ? fetchPages(() => supabase.from("orders")
        .select("id, store_id, created_at, status, platform_service_fee_usd, customer_phone_normalized, customer_id")
        .in("store_id", storeIds)
        .gte("created_at", period.startIso)
        .lt("created_at", period.endIso)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })) : [],
      storeIds.length ? fetchPages(() => supabase.from("store_subscription_payments")
        .select("id, store_id, amount_usd")
        .in("store_id", storeIds)
        .eq("status", "approved")
        .eq("plan_type", "per_service")
        .gte("reviewed_at", period.startIso)
        .lt("reviewed_at", period.endIso)
        .order("reviewed_at", { ascending: true })
        .order("id", { ascending: true })) : [],
      storeIds.length ? fetchPages(() => supabase.from("store_subscription_payments")
        .select("id, amount_usd")
        .in("store_id", storeIds)
        .eq("status", "approved")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })) : [],
      loadServiceFeeBalances(supabase, stores),
      loadStoreMetrics(supabase),
      storeIds.length ? countRows(supabase.from("products").select("id", { count: "exact", head: true }).in("store_id", storeIds)) : 0,
      storeIds.length ? countRows(supabase.from("customers").select("id", { count: "exact", head: true }).in("store_id", storeIds)) : 0,
      storeIds.length ? countRows(supabase.from("store_users").select("id", { count: "exact", head: true }).in("store_id", storeIds)) : 0,
      storeIds.length ? countRows(supabase.from("orders").select("id", { count: "exact", head: true }).in("store_id", storeIds)) : 0,
      storeIds.length ? countRows(supabase.from("orders").select("id", { count: "exact", head: true })
        .in("store_id", storeIds).gte("created_at", currentMonth.startIso).lt("created_at", currentMonth.endIso)) : 0,
    ]);

    const periodSummary = buildPeriodSummary(
      period,
      orders,
      payments,
      new Map(realStores.map((store) => [store.id, store.name]))
    );
    const metricsByStore = new Map(storeMetricsRows.map((row: any) => [row.store_id, row]));
    const now = new Date();
    const threeDaysFromNow = now.getTime() + 3 * 24 * 60 * 60 * 1000;
    const alerts = realStores.flatMap((store) => {
      const entries: Array<{ type: string; storeId: string; storeName: string; message: string }> = [];
      const trialEnd = store.trial_ends_at ? new Date(store.trial_ends_at).getTime() : null;
      if (store.plan_type === "trial" && trialEnd && trialEnd >= now.getTime() && trialEnd <= threeDaysFromNow) {
        entries.push({ type: "trial_ending", storeId: store.id, storeName: store.name, message: "Trial vence en 3 dias o menos." });
      }
      if (isSummaryStoreExpired(store, now)) {
        entries.push({ type: "expired", storeId: store.id, storeName: store.name, message: "Cuenta vencida o pago pendiente." });
      }
      if (!Number((metricsByStore.get(store.id) as any)?.active_product_count || 0)) {
        entries.push({ type: "no_products", storeId: store.id, storeName: store.name, message: "No tiene productos activos." });
      }
      if (!Array.isArray(store.payment_methods) || store.payment_methods.length === 0) {
        entries.push({ type: "no_payments", storeId: store.id, storeName: store.name, message: "No tiene metodos de pago configurados." });
      }
      if (!store.whatsapp) {
        entries.push({ type: "no_whatsapp", storeId: store.id, storeName: store.name, message: "No tiene WhatsApp receptor." });
      }
      return entries;
    });

    return NextResponse.json({
      summary: {
        ...periodSummary,
        overview: {
          totalStores: realStores.length,
          activeStores: realStores.filter((store) => store.is_active !== false).length,
          inactiveStores: realStores.filter((store) => store.is_active === false).length,
          trialStores: realStores.filter((store) => store.plan_type === "trial" || store.subscription_status === "trial").length,
          expiredStores: realStores.filter((store) => isSummaryStoreExpired(store, now)).length,
          historicalOrders,
          ordersThisMonth,
          totalProducts: productCount,
          totalCustomers: customerCount,
          totalAssignments: assignmentCount,
          approvedPaymentsUsd: Number((approvedPayments.reduce((sum, payment) =>
            sum + Math.round(Number(payment.amount_usd || 0) * 100), 0) / 100).toFixed(2)),
          pendingFeeUsd: Number([...feeBalances.values()].reduce((sum, balance) => sum + balance.amountUsd, 0).toFixed(2)),
          attentionStores: new Set(alerts.map((alert) => alert.storeId)).size,
        },
      },
      recentStores: [...realStores].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6),
      alerts: alerts.slice(0, 12),
      auth: { mode: auth.mode, email: auth.email || null },
    });
  } catch (error) {
    return adminErrorResponse(error, "Error cargando resumen admin.");
  }
}
