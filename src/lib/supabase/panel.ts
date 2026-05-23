import { createSupabasePublicClient } from "@/lib/supabase/server";

export type PanelStore = {
  id: string;
  slug: string;
  name: string;
  whatsapp: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
};

export type PanelProduct = {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_usd: number;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
  store_name?: string;
  category_name?: string;
};

export async function getPanelStores(): Promise<PanelStore[]> {
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("stores")
    .select(
      "id, slug, name, whatsapp, address, latitude, longitude, is_active, accepts_delivery, accepts_pickup"
    )
    .order("name", { ascending: true });

  if (error || !data) {
    console.warn("Panel stores error:", error?.message);
    return [];
  }

  return data.map((store) => ({
    ...store,
    latitude: store.latitude === null ? null : Number(store.latitude),
    longitude: store.longitude === null ? null : Number(store.longitude),
  }));
}

export async function getPanelProducts(): Promise<PanelProduct[]> {
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id,
      store_id,
      category_id,
      name,
      description,
      price_usd,
      image_url,
      is_available,
      is_featured,
      sort_order,
      stores(name),
      categories(name)
    `
    )
    .order("sort_order", { ascending: true });

  if (error || !data) {
    console.warn("Panel products error:", error?.message);
    return [];
  }

  return data.map((product: any) => ({
    id: product.id,
    store_id: product.store_id,
    category_id: product.category_id,
    name: product.name,
    description: product.description,
    price_usd: Number(product.price_usd || 0),
    image_url: product.image_url,
    is_available: product.is_available,
    is_featured: product.is_featured,
    sort_order: product.sort_order || 0,
    store_name: product.stores?.name,
    category_name: product.categories?.name,
  }));
}

export async function getPanelOrders() {
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      public_code,
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
      stores(name)
    `
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) {
    return [];
  }

  return data;
}

export async function getPanelStats() {
  const [stores, products, orders] = await Promise.all([
    getPanelStores(),
    getPanelProducts(),
    getPanelOrders(),
  ]);

  const activeProducts = products.filter((product) => product.is_available);
  const inactiveProducts = products.filter((product) => !product.is_available);
  const featuredProducts = products.filter((product) => product.is_featured);

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  const todayOrders = orders.filter((order: any) =>
    String(order.created_at || "").startsWith(todayKey)
  );

  const todayRevenue = todayOrders.reduce(
    (sum: number, order: any) => sum + Number(order.total_usd || 0),
    0
  );

  const totalRevenue = orders.reduce(
    (sum: number, order: any) => sum + Number(order.total_usd || 0),
    0
  );

  const averageTicket = orders.length ? totalRevenue / orders.length : 0;

  return {
    stores,
    products,
    orders,
    activeProducts,
    inactiveProducts,
    featuredProducts,
    todayOrders,
    todayRevenue,
    totalRevenue,
    averageTicket,
  };
}
