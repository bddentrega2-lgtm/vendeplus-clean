import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPlan } from "@/lib/plans";

function countRows(rows: any[] | null | undefined) {
  return Array.isArray(rows) ? rows.length : 0;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    const supabase = createSupabaseAdminClient();

    const [
      storesResult,
      ordersResult,
      productsResult,
      storeUsersResult,
      recentStoresResult,
      customersResult,
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
      `),
      supabase
        .from("orders")
        .select("id, store_id, total_usd, created_at")
        .order("created_at", { ascending: false })
        .limit(20000),
      supabase.from("products").select("id, store_id, is_available"),
      supabase.from("store_users").select("id"),
      supabase
        .from("stores")
        .select("id, slug, name, business_type, whatsapp, is_active, created_at, plan_type, trial_ends_at, subscription_status")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("customers").select("id").limit(20000),
    ]);

    if (storesResult.error) throw storesResult.error;
    if (ordersResult.error) throw ordersResult.error;
    if (productsResult.error) throw productsResult.error;
    if (storeUsersResult.error) throw storeUsersResult.error;
    if (recentStoresResult.error) throw recentStoresResult.error;
    if (customersResult.error) throw customersResult.error;

    const stores = storesResult.data || [];
    const orders = ordersResult.data || [];
    const products = productsResult.data || [];
    const now = Date.now();
    const todayCaracas = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Caracas",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const threeDaysFromNow = now + 3 * 24 * 60 * 60 * 1000;
    const revenueUsd = orders.reduce(
      (sum: number, order: any) => sum + Number(order.total_usd || 0),
      0
    );
    const ordersToday = orders.filter((order: any) => {
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Caracas",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(order.created_at));

      return day === todayCaracas;
    });
    const ordersLast7Days = orders.filter(
      (order: any) => new Date(order.created_at).getTime() >= sevenDaysAgo
    );
    const productCounts = new Map<string, number>();

    for (const product of products) {
      if (product.is_available === false) continue;
      productCounts.set(product.store_id, (productCounts.get(product.store_id) || 0) + 1);
    }

    const alerts = stores.flatMap((store: any) => {
      const storeAlerts: Array<{ type: string; storeId: string; storeName: string; message: string }> = [];
      const trialEndsAt = store.trial_ends_at ? new Date(store.trial_ends_at).getTime() : null;
      const paymentDueAt = store.next_payment_due_at ? new Date(store.next_payment_due_at).getTime() : null;

      if (trialEndsAt && trialEndsAt >= now && trialEndsAt <= threeDaysFromNow) {
        storeAlerts.push({
          type: "trial_ending",
          storeId: store.id,
          storeName: store.name,
          message: "Trial vence en 3 dias o menos.",
        });
      }
      if (store.subscription_status === "expired" || (paymentDueAt && paymentDueAt < now)) {
        storeAlerts.push({
          type: "expired",
          storeId: store.id,
          storeName: store.name,
          message: "Cuenta vencida o pago pendiente.",
        });
      }
      if (!productCounts.get(store.id)) {
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
        expiredStores: stores.filter((store: any) => store.subscription_status === "expired" || store.subscription_status === "past_due").length,
        totalOrders: orders.length,
        ordersToday: ordersToday.length,
        ordersLast7Days: ordersLast7Days.length,
        totalProducts: countRows(productsResult.data),
        totalAssignments: countRows(storeUsersResult.data),
        totalCustomers: countRows(customersResult.data),
        estimatedMrrUsd: stores.reduce((sum: number, store: any) => {
          if (store.is_active === false || ["cancelled", "paused", "expired"].includes(store.subscription_status)) return sum;
          const configuredPrice = Number(store.monthly_price_usd || 0);
          return sum + (configuredPrice || getPlan(store.plan_type).priceUsd);
        }, 0),
        revenueUsd,
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
