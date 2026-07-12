type SupabaseLike = {
  from: (table: string) => any;
};

export function isMissingAdminMetricsRpc(error: unknown) {
  const err = error as { code?: string; message?: string; details?: string };
  const text = `${err?.message || ""} ${err?.details || ""}`.toLowerCase();

  return (
    err?.code === "PGRST202" ||
    (text.includes("could not find the function") && text.includes("admin_")) ||
    (text.includes("schema cache") && text.includes("admin_"))
  );
}

function incrementCount(map: Map<string, number>, key?: string | null) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

export async function loadAdminSummaryMetricsFallback(supabase: SupabaseLike) {
  const [ordersResult, productsResult, storeUsersResult, customersResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, store_id, total_usd, created_at")
      .order("created_at", { ascending: false })
      .limit(20000),
    supabase.from("products").select("id, store_id, is_available"),
    supabase.from("store_users").select("id"),
    supabase.from("customers").select("id").limit(20000),
  ]);

  if (ordersResult.error) throw ordersResult.error;
  if (productsResult.error) throw productsResult.error;
  if (storeUsersResult.error) throw storeUsersResult.error;
  if (customersResult.error) throw customersResult.error;

  const orders = ordersResult.data || [];
  const todayCaracas = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return {
    total_orders: orders.length,
    orders_today: orders.filter((order: any) => {
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Caracas",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(order.created_at));

      return day === todayCaracas;
    }).length,
    orders_last_7_days: orders.filter(
      (order: any) => new Date(order.created_at).getTime() >= sevenDaysAgo
    ).length,
    revenue_usd: orders.reduce(
      (sum: number, order: any) => sum + Number(order.total_usd || 0),
      0
    ),
    total_products: productsResult.data?.length || 0,
    total_assignments: storeUsersResult.data?.length || 0,
    total_customers: customersResult.data?.length || 0,
  };
}

export async function loadAdminStoreMetricsFallback(supabase: SupabaseLike) {
  const [productsResult, ordersResult, usersResult] = await Promise.all([
    supabase.from("products").select("id, store_id, is_available").limit(5000),
    supabase.from("orders").select("id, store_id, created_at").limit(10000),
    supabase.from("store_users").select("id, store_id").limit(5000),
  ]);

  if (productsResult.error) throw productsResult.error;
  if (ordersResult.error) throw ordersResult.error;
  if (usersResult.error) throw usersResult.error;

  const productCounts = new Map<string, number>();
  const activeProductCounts = new Map<string, number>();
  const orderCounts = new Map<string, number>();
  const order30Counts = new Map<string, number>();
  const userCounts = new Map<string, number>();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const storeIds = new Set<string>();

  for (const product of productsResult.data || []) {
    storeIds.add(product.store_id);
    incrementCount(productCounts, product.store_id);
    if (product.is_available !== false) incrementCount(activeProductCounts, product.store_id);
  }

  for (const order of ordersResult.data || []) {
    storeIds.add(order.store_id);
    incrementCount(orderCounts, order.store_id);
    if (new Date(order.created_at).getTime() >= thirtyDaysAgo) {
      incrementCount(order30Counts, order.store_id);
    }
  }

  for (const user of usersResult.data || []) {
    storeIds.add(user.store_id);
    incrementCount(userCounts, user.store_id);
  }

  return Array.from(storeIds).map((storeId) => ({
    store_id: storeId,
    product_count: productCounts.get(storeId) || 0,
    active_product_count: activeProductCounts.get(storeId) || 0,
    order_count: orderCounts.get(storeId) || 0,
    order_count_30d: order30Counts.get(storeId) || 0,
    user_count: userCounts.get(storeId) || 0,
  }));
}

export async function loadAdminStoreDetailMetricsFallback(
  supabase: SupabaseLike,
  storeId: string
) {
  const [productsResult, ordersResult, customersResult] = await Promise.all([
    supabase.from("products").select("id, is_available").eq("store_id", storeId).limit(5000),
    supabase
      .from("orders")
      .select("id, total_usd, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("customers").select("id").eq("store_id", storeId).limit(5000),
  ]);

  if (productsResult.error) throw productsResult.error;
  if (ordersResult.error) throw ordersResult.error;
  if (customersResult.error) throw customersResult.error;

  const products = productsResult.data || [];
  const orders = ordersResult.data || [];
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  return {
    active_products: products.filter((product: any) => product.is_available !== false).length,
    total_products: products.length,
    total_orders: orders.length,
    orders_last_7_days: orders.filter(
      (order: any) => new Date(order.created_at).getTime() >= sevenDaysAgo
    ).length,
    orders_last_30_days: orders.filter(
      (order: any) => new Date(order.created_at).getTime() >= thirtyDaysAgo
    ).length,
    total_revenue_usd: orders.reduce(
      (sum: number, order: any) => sum + Number(order.total_usd || 0),
      0
    ),
    customers: customersResult.data?.length || 0,
  };
}
