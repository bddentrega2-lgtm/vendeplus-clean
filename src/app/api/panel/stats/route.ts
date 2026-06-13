import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { getInitialPaymentStatus } from "@/lib/payments";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";

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
  return new Date(value).toISOString().slice(0, 10);
}

function toMonthKey(value: string) {
  return new Date(value).toISOString().slice(0, 7);
}

function toHourKey(value: string) {
  return String(new Date(value).getHours()).padStart(2, "0") + ":00";
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDateRange(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "last_30_days";
  const now = new Date();

  if (range === "today") {
    return { start: startOfDay(now), end: endOfDay(now), range };
  }

  if (range === "last_7_days") {
    return { start: startOfDay(addDays(now, -6)), end: endOfDay(now), range };
  }

  if (range === "this_month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: endOfDay(now),
      range,
    };
  }

  if (range === "previous_month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      range,
    };
  }

  if (range === "custom") {
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const start = startParam ? startOfDay(new Date(startParam)) : startOfDay(addDays(now, -29));
    const end = endParam ? endOfDay(new Date(endParam)) : endOfDay(now);

    return { start, end, range };
  }

  return { start: startOfDay(addDays(now, -29)), end: endOfDay(now), range: "last_30_days" };
}

function countDays(start: Date, end: Date) {
  return Math.max(
    1,
    Math.ceil((Number(endOfDay(end)) - Number(startOfDay(start))) / 86400000)
  );
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

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const requestedStoreId = searchParams.get("storeId");
    const selectedStoreId =
      requestedStoreId && requestedStoreId !== "all" ? requestedStoreId : null;
    const dateRange = getDateRange(request);

    if (selectedStoreId) {
      assertStoreAccess(
        auth,
        selectedStoreId,
        "No tienes permiso para consultar este comercio."
      );
    }

    let storesQuery = supabase
      .from("stores")
      .select("id, slug, name")
      .order("name", { ascending: true });

    let ordersQuery = supabase
      .from("orders")
      .select(ordersSelect)
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString())
      .order("created_at", { ascending: false });

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
        .order("created_at", { ascending: false });

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
    const safeProducts = products || [];

    const completedOrders = safeOrders.filter((order: any) => order.status === "completed");
    const cancelledOrders = safeOrders.filter((order: any) => order.status === "cancelled");
    const inProgressOrders = safeOrders.filter(
      (order: any) => !["completed", "cancelled"].includes(order.status)
    );
    const deliveryOrders = safeOrders.filter((order: any) => order.delivery_type === "delivery");
    const pickupOrders = safeOrders.filter((order: any) => order.delivery_type === "pickup");
    const pendingPaymentOrders = safeOrders.filter((order: any) =>
      ["pending", "incomplete"].includes(order.payment_status || "pending")
    );
    const reviewPaymentOrders = safeOrders.filter(
      (order: any) => order.payment_status === "review"
    );
    const verifiedPaymentsToday = safeOrders.filter((order: any) => {
      if (order.payment_status !== "verified" || !order.payment_verified_at) return false;
      return new Date(order.payment_verified_at) >= startOfDay(new Date());
    });

    const totalRevenueUsd = safeOrders.reduce(
      (sum: number, order: any) => sum + toNumber(order.total_usd),
      0
    );

    const averageTicketUsd = safeOrders.length
      ? totalRevenueUsd / safeOrders.length
      : 0;
    const operationalConversionRate = safeOrders.length
      ? (completedOrders.length / safeOrders.length) * 100
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
    const pendingPaymentUsd = safeOrders
      .filter((order: any) =>
        ["pending", "review", "incomplete"].includes(order.payment_status || "pending")
      )
      .reduce((sum: number, order: any) => sum + toNumber(order.total_usd), 0);

    const allItems = safeOrders.flatMap((order: any) =>
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

    safeOrders.forEach((order: any) => {
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
      safeOrders,
      (order: any) => toDateKey(order.created_at),
      (order: any) => toNumber(order.total_usd)
    );

    const ordersByDay = groupCount(safeOrders, (order: any) =>
      toDateKey(order.created_at)
    )
      .sort((a, b) => a.label.localeCompare(b.label));

    const salesByWeek = groupSum(
      safeOrders,
      (order: any) => getWeekKey(order.created_at),
      (order: any) => toNumber(order.total_usd)
    ).slice(-8);

    const salesByMonth = groupSum(
      safeOrders,
      (order: any) => toMonthKey(order.created_at),
      (order: any) => toNumber(order.total_usd)
    ).slice(-6);

    const ordersByHour = groupCount(safeOrders, (order: any) =>
      toHourKey(order.created_at)
    ).sort((a, b) => a.label.localeCompare(b.label));

    const ordersByWeekday = groupCount(safeOrders, (order: any) =>
      new Intl.DateTimeFormat("es-VE", { weekday: "long" }).format(
        new Date(order.created_at)
      )
    );

    const ordersByStatus = groupCount(safeOrders, (order: any) => order.status);

    const ordersByPaymentMethod = groupCount(
      safeOrders,
      (order: any) => order.payment_method
    );

    const ordersByDeliveryType = groupCount(
      safeOrders,
      (order: any) => order.delivery_type
    );

    const revenueByStore = groupSum(
      safeOrders,
      (order: any) => order.stores?.name || "Comercio",
      (order: any) => toNumber(order.total_usd)
    ).sort((a, b) => b.value - a.value);

    const activeProducts = safeProducts.filter((product: any) => product.is_available);
    const inactiveProducts = safeProducts.filter((product: any) => !product.is_available);
    const strongestHour = [...ordersByHour].sort((a, b) => b.value - a.value)[0] || null;
    const strongestWeekday = ordersByWeekday[0] || null;

    return NextResponse.json({
      stores: safeStores,
      selectedStoreId,
      range: {
        key: dateRange.range,
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        days: countDays(dateRange.start, dateRange.end),
      },
      summary: {
        totalOrders: safeOrders.length,
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
      recentOrders: safeOrders.slice(0, 8),
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
