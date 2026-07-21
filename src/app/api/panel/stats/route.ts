import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { getInitialPaymentStatus } from "@/lib/payments";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";
import {
  getVenezuelaDateKey,
  getVenezuelaDayRange,
  getVenezuelaRelativeRange,
} from "@/lib/time/venezuela";

const ordersSelect = `
  id,
  public_code,
  store_id,
  customer_name,
  customer_phone,
  delivery_type,
  payment_method,
  payment_status,
  payment_verified_at,
  subtotal_usd,
  delivery_usd,
  total_usd,
  total_bs,
  distance_km,
  status,
  created_at,
  stores (
    name
  ),
  order_items (
    id,
    product_name,
    variant_name,
    quantity,
    unit_price_usd,
    total_usd
  )
`;

const baseOrdersSelect = `
  id,
  public_code,
  store_id,
  customer_name,
  customer_phone,
  delivery_type,
  payment_method,
  subtotal_usd,
  delivery_usd,
  total_usd,
  total_bs,
  distance_km,
  status,
  created_at,
  stores (
    name
  ),
  order_items (
    id,
    product_name,
    variant_name,
    quantity,
    unit_price_usd,
    total_usd
  )
`;

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateKey(value: string) {
  return getVenezuelaDateKey(value);
}

function toMonthKey(value: string) {
  return getVenezuelaDateKey(value).slice(0, 7);
}

function toHourKey(value: string) {
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    hour: "2-digit",
    hour12: false,
  }).format(new Date(value)) + ":00";
}

function getDateRange(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "last_7_days";
  const now = new Date();

  if (range === "today") {
    return { ...getVenezuelaRelativeRange("today", now), range };
  }

  if (range === "last_7_days") {
    return { ...getVenezuelaRelativeRange("last_7_days", now), range };
  }

  if (range === "this_month") {
    const [year, month] = getVenezuelaDateKey(now).split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return {
      start: getVenezuelaDayRange(`${year}-${String(month).padStart(2, "0")}-01`).start,
      end: getVenezuelaDayRange(
        `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
      ).end,
      range,
    };
  }

  if (range === "previous_month") {
    const [currentYear, currentMonth] = getVenezuelaDateKey(now).split("-").map(Number);
    const previousMonthDate = new Date(Date.UTC(currentYear, currentMonth - 2, 1));
    const year = previousMonthDate.getUTCFullYear();
    const month = previousMonthDate.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return {
      start: getVenezuelaDayRange(`${year}-${String(month).padStart(2, "0")}-01`).start,
      end: getVenezuelaDayRange(
        `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
      ).end,
      range,
    };
  }

  if (range === "custom") {
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const fallback = getVenezuelaRelativeRange("last_30_days", now);
    const start = startParam ? getVenezuelaDayRange(startParam).start : fallback.start;
    const end = endParam ? getVenezuelaDayRange(endParam).end : fallback.end;

    return { start, end, range };
  }

  return { ...getVenezuelaRelativeRange("last_7_days", now), range: "last_7_days" };
}

function countDays(start: Date, end: Date) {
  return Math.max(1, Math.ceil((Number(end) - Number(start) + 1) / 86400000));
}

function getWeekKey(value: string) {
  const date = new Date(value);
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const pastDays = Math.floor((Number(date) - Number(firstDay)) / 86400000);
  const week = Math.ceil((pastDays + firstDay.getDay() + 1) / 7);

  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function groupSum<T>(
  rows: T[],
  keyGetter: (row: T) => string,
  valueGetter: (row: T) => number
) {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const key = keyGetter(row);
    map.set(key, (map.get(key) || 0) + valueGetter(row));
  });

  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function groupCount<T>(rows: T[], keyGetter: (row: T) => string) {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const key = keyGetter(row) || "Sin dato";
    map.set(key, (map.get(key) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function withPaymentFallback(order: any) {
  return {
    ...order,
    payment_status:
      order?.payment_status || getInitialPaymentStatus(order?.payment_method),
    payment_verified_at: order?.payment_verified_at || null,
  };
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isCancelledStatus(value: unknown) {
  return ["cancelled", "canceled", "cancelado"].includes(
    String(value || "").toLowerCase()
  );
}

function strongest(rows: any[]) {
  return [...asArray(rows)].sort((a, b) => toNumber(b?.value) - toNumber(a?.value))[0] || null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") === "summary" ? "summary" : "full";
    const requestedStoreId = searchParams.get("storeId");
    const selectedStoreId =
      requestedStoreId && requestedStoreId !== "all" ? requestedStoreId : null;
    const dateRange = getDateRange(request);
    const defaultOrdersLimit = mode === "summary" ? 150 : 500;
    const ordersLimit = Math.min(
      1000,
      Math.max(50, Number(searchParams.get("limit") || defaultOrdersLimit))
    );

    if (selectedStoreId) {
      assertStoreAccess(
        auth,
        selectedStoreId,
        "No tienes permiso para consultar este comercio."
      );
    }

    let rpcStoresQuery = supabase
      .from("stores")
      .select("id, slug, name, subscription_status, trial_ends_at, subscription_ends_at, next_payment_due_at")
      .order("name", { ascending: true });

    if (auth.storeIds !== null) {
      rpcStoresQuery = rpcStoresQuery.in("id", auth.storeIds);
    }

    const [rpcStoresResult, rpcStatsResult] = await Promise.all([
      rpcStoresQuery,
      supabase
        .rpc("panel_store_stats", {
          p_store_ids: auth.storeIds,
          p_store_id: selectedStoreId,
          p_start: dateRange.start.toISOString(),
          p_end: dateRange.end.toISOString(),
          p_recent_limit: 8,
        })
        .maybeSingle(),
    ]);

    if (!rpcStoresResult.error && !rpcStatsResult.error && rpcStatsResult.data) {
      const stats = rpcStatsResult.data as any;
      const ordersByHour = asArray(stats.orders_by_hour);
      const ordersByWeekday = asArray(stats.orders_by_weekday);

      if (mode === "summary") {
        return NextResponse.json({
          stores: rpcStoresResult.data || [],
          selectedStoreId,
          range: {
            key: dateRange.range,
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
            days: countDays(dateRange.start, dateRange.end),
            capped: false,
          },
          summary: stats.summary || {},
          topProducts: asArray(stats.top_products).slice(0, 5),
          customers: stats.customers || { total: 0, frequent: 0, contact: 0 },
          auth: {
            mode: auth.mode,
            email: auth.email || null,
            role: auth.role || null,
          },
        });
      }

      return NextResponse.json({
        stores: rpcStoresResult.data || [],
        selectedStoreId,
        range: {
          key: dateRange.range,
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
          days: countDays(dateRange.start, dateRange.end),
          capped: false,
        },
        summary: stats.summary || {},
        topProducts: asArray(stats.top_products),
        topCustomers: asArray(stats.top_customers),
        customers: stats.customers || { total: 0, frequent: 0, contact: 0 },
        salesByDay: asArray(stats.sales_by_day),
        ordersByDay: asArray(stats.orders_by_day),
        salesByWeek: asArray(stats.sales_by_week),
        salesByMonth: asArray(stats.sales_by_month),
        ordersByHour,
        ordersByWeekday,
        ordersByStatus: asArray(stats.orders_by_status),
        ordersByPaymentMethod: asArray(stats.orders_by_payment_method),
        ordersByDeliveryType: asArray(stats.orders_by_delivery_type),
        revenueByStore: asArray(stats.revenue_by_store),
        peak: {
          strongestHour: strongest(ordersByHour),
          strongestWeekday: strongest(ordersByWeekday),
        },
        recentOrders: asArray(stats.recent_orders),
        auth: {
          mode: auth.mode,
          email: auth.email || null,
          role: auth.role || null,
        },
      });
    }

    let storesQuery = supabase
      .from("stores")
      .select("id, slug, name, subscription_status, trial_ends_at, subscription_ends_at, next_payment_due_at")
      .order("name", { ascending: true });

    let ordersQuery = supabase
      .from("orders")
      .select(ordersSelect)
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString())
      .order("created_at", { ascending: false })
      .limit(ordersLimit);

    let productsQuery = supabase
      .from("products")
      .select("id, name, store_id, is_available, is_featured, price_usd, stores(name)");

    if (auth.storeIds !== null) {
      storesQuery = storesQuery.in("id", auth.storeIds);
      ordersQuery = ordersQuery.in("store_id", auth.storeIds);
      productsQuery = productsQuery.in("store_id", auth.storeIds);
    }

    if (selectedStoreId) {
      ordersQuery = ordersQuery.eq("store_id", selectedStoreId);
      productsQuery = productsQuery.eq("store_id", selectedStoreId);
    }

    const [
      { data: stores, error: storesError },
      ordersResult,
      { data: products, error: productsError },
    ] = await Promise.all([storesQuery, ordersQuery, productsQuery]);

    let orders = ordersResult.data;
    let ordersError = ordersResult.error;

    if (ordersError && isMissingColumnError(ordersError, ["payment_"])) {
      let fallbackOrdersQuery = supabase
        .from("orders")
        .select(baseOrdersSelect)
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false })
        .limit(ordersLimit);

      if (auth.storeIds !== null) {
        fallbackOrdersQuery = fallbackOrdersQuery.in("store_id", auth.storeIds);
      }

      if (selectedStoreId) {
        fallbackOrdersQuery = fallbackOrdersQuery.eq("store_id", selectedStoreId);
      }

      const fallbackResult = await fallbackOrdersQuery;
      orders = fallbackResult.data?.map(withPaymentFallback) || [];
      ordersError = fallbackResult.error;
    }

    if (storesError) throw storesError;
    if (ordersError) throw ordersError;
    if (productsError) throw productsError;

    const safeStores = stores || [];
    const safeOrders = (orders || []).map(withPaymentFallback);
    const billableOrders = safeOrders.filter((order: any) => !isCancelledStatus(order.status));
    const safeProducts = products || [];
    let customerSummary = {
      total: 0,
      frequent: 0,
      contact: 0,
    };

    try {
      let customersQuery = supabase
        .from("customers")
        .select("orders_count, last_order_at");

      if (auth.storeIds !== null) {
        customersQuery = customersQuery.in("store_id", auth.storeIds);
      }

      if (selectedStoreId) {
        customersQuery = customersQuery.eq("store_id", selectedStoreId);
      }

      const { data: customers } = await customersQuery;
      const now = Date.now();
      const safeCustomers = customers || [];

      customerSummary = {
        total: safeCustomers.length,
        frequent: safeCustomers.filter(
          (customer: any) => toNumber(customer.orders_count) >= 3
        ).length,
        contact: safeCustomers.filter((customer: any) => {
          if (toNumber(customer.orders_count) < 2 || !customer.last_order_at) {
            return false;
          }

          const days = Math.floor(
            (now - new Date(customer.last_order_at).getTime()) / 86400000
          );
          return days >= 21;
        }).length,
      };
    } catch {
      customerSummary = {
        total: 0,
        frequent: 0,
        contact: 0,
      };
    }

    const completedOrders = safeOrders.filter((order: any) => order.status === "completed");
    const cancelledOrders = safeOrders.filter((order: any) => isCancelledStatus(order.status));
    const inProgressOrders = safeOrders.filter(
      (order: any) => order.status !== "completed" && !isCancelledStatus(order.status)
    );
    const deliveryOrders = billableOrders.filter((order: any) => order.delivery_type === "delivery");
    const pickupOrders = billableOrders.filter((order: any) => order.delivery_type === "pickup");
    const pendingPaymentOrders = billableOrders.filter((order: any) =>
      ["pending", "incomplete"].includes(order.payment_status || "pending")
    );
    const reviewPaymentOrders = billableOrders.filter(
      (order: any) => order.payment_status === "review"
    );
    const todayRange = getVenezuelaRelativeRange("today");
    const verifiedPaymentsToday = billableOrders.filter((order: any) => {
      if (order.payment_status !== "verified" || !order.payment_verified_at) return false;
      const verifiedAt = new Date(order.payment_verified_at);
      return verifiedAt >= todayRange.start && verifiedAt <= todayRange.end;
    });

    const totalRevenueUsd = billableOrders.reduce(
      (sum: number, order: any) => sum + toNumber(order.total_usd),
      0
    );

    const averageTicketUsd = billableOrders.length
      ? totalRevenueUsd / billableOrders.length
      : 0;
    const operationalConversionRate = billableOrders.length
      ? (completedOrders.length / billableOrders.length) * 100
      : 0;
    const averageRevenuePerDayUsd =
      totalRevenueUsd / countDays(dateRange.start, dateRange.end);

    const averageDeliveryUsd = deliveryOrders.length
      ? deliveryOrders.reduce(
          (sum: number, order: any) => sum + toNumber(order.delivery_usd),
          0
        ) / deliveryOrders.length
      : 0;

    const averageDistanceKm = deliveryOrders.length
      ? deliveryOrders.reduce(
          (sum: number, order: any) => sum + toNumber(order.distance_km),
          0
        ) / deliveryOrders.length
      : 0;
    const deliveryRevenueUsd = deliveryOrders.reduce(
      (sum: number, order: any) => sum + toNumber(order.total_usd),
      0
    );
    const pickupRevenueUsd = pickupOrders.reduce(
      (sum: number, order: any) => sum + toNumber(order.total_usd),
      0
    );
    const pendingPaymentUsd = billableOrders
      .filter((order: any) =>
        ["pending", "review", "incomplete"].includes(order.payment_status || "pending")
      )
      .reduce((sum: number, order: any) => sum + toNumber(order.total_usd), 0);

    const allItems = billableOrders.flatMap((order: any) =>
      (order.order_items || []).map((item: any) => ({
        ...item,
        order_id: order.id,
        order_status: order.status,
        store_name: order.stores?.name || "Comercio",
        created_at: order.created_at,
      }))
    );

    const productMap = new Map<
      string,
      { product: string; quantity: number; revenue: number; orders: number }
    >();

    allItems.forEach((item: any) => {
      const key = item.variant_name
        ? `${item.product_name} (${item.variant_name})`
        : item.product_name;

      const current = productMap.get(key) || {
        product: key,
        quantity: 0,
        revenue: 0,
        orders: 0,
      };

      current.quantity += toNumber(item.quantity);
      current.revenue += toNumber(item.total_usd);
      current.orders += 1;

      productMap.set(key, current);
    });

    const topProducts = Array.from(productMap.values())
      .map((product) => ({
        ...product,
        share: totalRevenueUsd ? (product.revenue / totalRevenueUsd) * 100 : 0,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const customerMap = new Map<
      string,
      { customer: string; phone: string; orders: number; revenue: number; lastOrderAt: string }
    >();

    billableOrders.forEach((order: any) => {
      const phone = order.customer_phone || "Sin teléfono";
      const current = customerMap.get(phone) || {
        customer: order.customer_name || "Cliente",
        phone,
        orders: 0,
        revenue: 0,
        lastOrderAt: order.created_at,
      };

      current.orders += 1;
      current.revenue += toNumber(order.total_usd);
      if (new Date(order.created_at) > new Date(current.lastOrderAt)) {
        current.lastOrderAt = order.created_at;
      }

      customerMap.set(phone, current);
    });

    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const salesByDay = groupSum(
      billableOrders,
      (order: any) => toDateKey(order.created_at),
      (order: any) => toNumber(order.total_usd)
    );

    const ordersByDay = groupCount(billableOrders, (order: any) =>
      toDateKey(order.created_at)
    )
      .sort((a, b) => a.label.localeCompare(b.label));

    const salesByWeek = groupSum(
      billableOrders,
      (order: any) => getWeekKey(order.created_at),
      (order: any) => toNumber(order.total_usd)
    ).slice(-8);

    const salesByMonth = groupSum(
      billableOrders,
      (order: any) => toMonthKey(order.created_at),
      (order: any) => toNumber(order.total_usd)
    ).slice(-6);

    const ordersByHour = groupCount(billableOrders, (order: any) =>
      toHourKey(order.created_at)
    ).sort((a, b) => a.label.localeCompare(b.label));

    const ordersByWeekday = groupCount(billableOrders, (order: any) =>
      new Intl.DateTimeFormat("es-VE", { weekday: "long" }).format(
        new Date(order.created_at)
      )
    );

    const ordersByStatus = groupCount(billableOrders, (order: any) => order.status);

    const ordersByPaymentMethod = groupCount(
      billableOrders,
      (order: any) => order.payment_method
    );

    const ordersByDeliveryType = groupCount(
      billableOrders,
      (order: any) => order.delivery_type
    );

    const revenueByStore = groupSum(
      billableOrders,
      (order: any) => order.stores?.name || "Comercio",
      (order: any) => toNumber(order.total_usd)
    ).sort((a, b) => b.value - a.value);

    const activeProducts = safeProducts.filter((product: any) => product.is_available);
    const inactiveProducts = safeProducts.filter((product: any) => !product.is_available);
    const strongestHour = [...ordersByHour].sort((a, b) => b.value - a.value)[0] || null;
    const strongestWeekday = ordersByWeekday[0] || null;

    if (mode === "summary") {
      return NextResponse.json({
        stores: safeStores,
        selectedStoreId,
        range: {
          key: dateRange.range,
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
          days: countDays(dateRange.start, dateRange.end),
          capped: billableOrders.length === ordersLimit,
        },
        summary: {
          totalOrders: billableOrders.length,
          completedOrders: completedOrders.length,
          inProgressOrders: inProgressOrders.length,
          cancelledOrders: cancelledOrders.length,
          totalRevenueUsd,
          averageTicketUsd,
          averageRevenuePerDayUsd,
          operationalConversionRate,
          averageDeliveryUsd,
          averageDistanceKm,
          deliveryRevenueUsd,
          pickupRevenueUsd,
          deliveryOrders: deliveryOrders.length,
          pickupOrders: pickupOrders.length,
          pendingPayments: pendingPaymentOrders.length,
          reviewPayments: reviewPaymentOrders.length,
          verifiedPaymentsToday: verifiedPaymentsToday.length,
          pendingPaymentUsd,
          activeProducts: activeProducts.length,
          inactiveProducts: inactiveProducts.length,
        },
        topProducts: topProducts.slice(0, 5),
        customers: customerSummary,
        auth: {
          mode: auth.mode,
          email: auth.email || null,
          role: auth.role || null,
        },
      });
    }

    return NextResponse.json({
      stores: safeStores,
      selectedStoreId,
      range: {
        key: dateRange.range,
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        days: countDays(dateRange.start, dateRange.end),
        capped: billableOrders.length === ordersLimit,
      },
      summary: {
        totalOrders: billableOrders.length,
        completedOrders: completedOrders.length,
        inProgressOrders: inProgressOrders.length,
        cancelledOrders: cancelledOrders.length,
        totalRevenueUsd,
        averageTicketUsd,
        averageRevenuePerDayUsd,
        operationalConversionRate,
        averageDeliveryUsd,
        averageDistanceKm,
        deliveryRevenueUsd,
        pickupRevenueUsd,
        deliveryOrders: deliveryOrders.length,
        pickupOrders: pickupOrders.length,
        pendingPayments: pendingPaymentOrders.length,
        reviewPayments: reviewPaymentOrders.length,
        verifiedPaymentsToday: verifiedPaymentsToday.length,
        pendingPaymentUsd,
        activeProducts: activeProducts.length,
        inactiveProducts: inactiveProducts.length,
      },
      topProducts,
      topCustomers,
      customers: customerSummary,
      salesByDay,
      ordersByDay,
      salesByWeek,
      salesByMonth,
      ordersByHour,
      ordersByWeekday,
      ordersByStatus,
      ordersByPaymentMethod,
      ordersByDeliveryType,
      revenueByStore,
      peak: {
        strongestHour,
        strongestWeekday,
      },
      recentOrders: billableOrders.slice(0, 8),
      auth: {
        mode: auth.mode,
        email: auth.email || null,
        role: auth.role || null,
      },
    });
  } catch (error: any) {
    return panelErrorResponse(error, "Error cargando estadísticas.");
  }
}
