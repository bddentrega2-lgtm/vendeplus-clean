import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: NextRequest) {
  const expectedPin = process.env.PANEL_ACCESS_PIN;
  const receivedPin = request.headers.get("x-panel-pin");

  return Boolean(expectedPin && receivedPin && receivedPin === expectedPin);
}

function unauthorized() {
  return NextResponse.json(
    { error: "PIN invalido o no autorizado." },
    { status: 401 }
  );
}

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

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  try {
    const supabase = createSupabaseAdminClient();

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(
        `
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
      `
      )
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, store_id, is_available, is_featured, price_usd, stores(name)");

    if (productsError) throw productsError;

    const safeOrders = orders || [];
    const safeProducts = products || [];

    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const monthKey = now.toISOString().slice(0, 7);

    const todayOrders = safeOrders.filter((order: any) =>
      String(order.created_at || "").startsWith(todayKey)
    );

    const monthOrders = safeOrders.filter((order: any) =>
      String(order.created_at || "").startsWith(monthKey)
    );

    const completedOrders = safeOrders.filter(
      (order: any) => order.status === "completed"
    );

    const cancelledOrders = safeOrders.filter(
      (order: any) => order.status === "cancelled"
    );

    const deliveryOrders = safeOrders.filter(
      (order: any) => order.delivery_type === "delivery"
    );

    const pickupOrders = safeOrders.filter(
      (order: any) => order.delivery_type === "pickup"
    );

    const totalRevenueUsd = safeOrders.reduce(
      (sum: number, order: any) => sum + toNumber(order.total_usd),
      0
    );

    const todayRevenueUsd = todayOrders.reduce(
      (sum: number, order: any) => sum + toNumber(order.total_usd),
      0
    );

    const monthRevenueUsd = monthOrders.reduce(
      (sum: number, order: any) => sum + toNumber(order.total_usd),
      0
    );

    const averageTicketUsd = safeOrders.length
      ? totalRevenueUsd / safeOrders.length
      : 0;

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
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const customerMap = new Map<
      string,
      { customer: string; phone: string; orders: number; revenue: number }
    >();

    safeOrders.forEach((order: any) => {
      const phone = order.customer_phone || "Sin telefono";
      const current = customerMap.get(phone) || {
        customer: order.customer_name || "Cliente",
        phone,
        orders: 0,
        revenue: 0,
      };

      current.orders += 1;
      current.revenue += toNumber(order.total_usd);

      customerMap.set(phone, current);
    });

    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const salesByDay = groupSum(
      safeOrders,
      (order: any) => toDateKey(order.created_at),
      (order: any) => toNumber(order.total_usd)
    ).slice(-14);

    const ordersByDay = groupCount(safeOrders, (order: any) =>
      toDateKey(order.created_at)
    )
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-14);

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

    const activeProducts = safeProducts.filter(
      (product: any) => product.is_available
    );

    const inactiveProducts = safeProducts.filter(
      (product: any) => !product.is_available
    );

    return NextResponse.json({
      summary: {
        totalOrders: safeOrders.length,
        todayOrders: todayOrders.length,
        monthOrders: monthOrders.length,
        completedOrders: completedOrders.length,
        cancelledOrders: cancelledOrders.length,
        totalRevenueUsd,
        todayRevenueUsd,
        monthRevenueUsd,
        averageTicketUsd,
        averageDeliveryUsd,
        averageDistanceKm,
        deliveryOrders: deliveryOrders.length,
        pickupOrders: pickupOrders.length,
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
      ordersByStatus,
      ordersByPaymentMethod,
      ordersByDeliveryType,
      revenueByStore,
      recentOrders: safeOrders.slice(0, 8),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error cargando estadisticas." },
      { status: 500 }
    );
  }
}
