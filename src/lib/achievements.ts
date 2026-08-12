import { PanelAccessError } from "@/lib/panel/access";

export const achievementDefinitions = [
  { key: "orders_50_full_stats", title: "Completa 50 pedidos", description: "Completa 50 pedidos de al menos 20 clientes diferentes.", reward: "Estadísticas completas", feature: "full_stats", target: 50 },
  { key: "orders_100_product_limit", title: "Completa 100 pedidos", description: "Completa 100 pedidos de al menos 35 clientes diferentes.", reward: "20 productos adicionales (50 en total)", feature: "product_limit_50", target: 100 },
  { key: "referral_brand_colors", title: "Refiere un comercio", description: "Invita un comercio que se registre y sea autorizado por Super Admin.", reward: "Personalización de colores", feature: "brand_colors", target: 1 },
  { key: "promos_3_three_months_customer_details", title: "Activa 3 promociones y mantén actividad 3 meses", description: "Promociona tres productos distintos y registra ventas en tres meses diferentes.", reward: "Detalles completos de clientes", feature: "customers_detail", target: 3 },
] as const;

export type AchievementKey = (typeof achievementDefinitions)[number]["key"];
export type AchievementFeature = (typeof achievementDefinitions)[number]["feature"];

const cancelledStatuses = new Set(["cancelled", "canceled", "cancelado"]);

function isCompletedOrder(status: unknown) {
  return String(status || "").toLowerCase() === "completed";
}

function monthKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(value));
}

export async function loadStoreAchievements(supabase: any, storeId: string) {
  const [storeResult, productsResult, ordersResult, referralsResult, promotionsResult, unlocksResult, resetsResult] =
    await Promise.all([
      supabase.from("stores").select("id, name, whatsapp, address, latitude, longitude, logo_url, product_limit, updated_at").eq("id", storeId).single(),
      supabase.from("products").select("id, discount_percent, is_available, created_at, updated_at").eq("store_id", storeId),
      supabase.from("orders").select("id, status, created_at, customer_id, customer_phone").eq("store_id", storeId),
      supabase.from("store_referrals").select("id, referred_store_id, status, qualified_at").eq("referrer_store_id", storeId),
      supabase.from("store_promotion_activations").select("product_id, first_activated_at").eq("store_id", storeId),
      supabase.from("store_achievement_unlocks").select("achievement_key, source, unlocked_at").eq("store_id", storeId),
      supabase.from("store_achievement_resets").select("achievement_key, reset_at").eq("store_id", storeId),
    ]);

  for (const result of [storeResult, productsResult, ordersResult, referralsResult, promotionsResult, unlocksResult, resetsResult]) {
    if (result.error) throw result.error;
  }

  const store = storeResult.data;
  const products = productsResult.data || [];
  const resetByKey = new Map((resetsResult.data || []).map((row: any) => [row.achievement_key, row.reset_at]));
  const afterReset = (value: string | null | undefined, key: AchievementKey) => {
    const resetAt = resetByKey.get(key);
    return !resetAt || Boolean(value && new Date(value).getTime() > new Date(String(resetAt)).getTime());
  };
  const metricsFor = (key: AchievementKey) => {
    const completedOrders = (ordersResult.data || []).filter((order: any) => isCompletedOrder(order.status) && afterReset(order.created_at, key));
    const uniqueCustomers = new Set(completedOrders.map((order: any) => order.customer_id || String(order.customer_phone || "").replace(/\D/g, "")).filter(Boolean)).size;
    const activeMonths = new Set(completedOrders.map((order: any) => monthKey(order.created_at))).size;
    return { completedOrders, uniqueCustomers, activeMonths };
  };
  const registeredReferrals = (referralsResult.data || []).filter((row: any) => row.status === "registered");
  if (registeredReferrals.length) {
    const { data: referredUsers, error: referredUsersError } = await supabase
      .from("store_users")
      .select("store_id, user_id")
      .in("store_id", registeredReferrals.map((row: any) => row.referred_store_id))
      .in("role", ["owner", "admin"]);
    if (referredUsersError) throw referredUsersError;
    const authorizationChecks = await Promise.all((referredUsers || []).map(async (row: any) => {
      const { data, error } = await supabase.auth.admin.getUserById(row.user_id);
      if (error) throw error;
      return data.user?.email_confirmed_at ? row.store_id : null;
    }));
    const qualifiedStoreIds = [...new Set(authorizationChecks.filter(Boolean))];
    if (qualifiedStoreIds.length) {
      const { error } = await supabase.from("store_referrals").update({ status: "qualified", qualified_at: new Date().toISOString() }).eq("referrer_store_id", storeId).in("referred_store_id", qualifiedStoreIds);
      if (error) throw error;
      for (const row of registeredReferrals) if (qualifiedStoreIds.includes(row.referred_store_id)) {
        row.status = "qualified";
        row.qualified_at = new Date().toISOString();
      }
    }
  }
  const referralCount = (referralsResult.data || []).filter((row: any) => row.status === "qualified" && afterReset(row.qualified_at, "referral_brand_colors")).length;
  const orders50 = metricsFor("orders_50_full_stats");
  const orders100 = metricsFor("orders_100_product_limit");
  const promo3 = metricsFor("promos_3_three_months_customer_details");
  const promotedCountFor = (key: AchievementKey) => new Set((promotionsResult.data || []).filter((row: any) => afterReset(row.first_activated_at, key)).map((row: any) => row.product_id)).size;
  const promo3Count = promotedCountFor("promos_3_three_months_customer_details");

  const progressByKey: Record<AchievementKey, { current: number; target: number; completed: boolean; detail?: string }> = {
    orders_50_full_stats: { current: Math.min(orders50.completedOrders.length, 50), target: 50, completed: orders50.completedOrders.length >= 50 && orders50.uniqueCustomers >= 20, detail: `${orders50.completedOrders.length}/50 pedidos · ${orders50.uniqueCustomers}/20 clientes` },
    orders_100_product_limit: { current: Math.min(orders100.completedOrders.length, 100), target: 100, completed: orders100.completedOrders.length >= 100 && orders100.uniqueCustomers >= 35, detail: `${orders100.completedOrders.length}/100 pedidos · ${orders100.uniqueCustomers}/35 clientes` },
    referral_brand_colors: { current: Math.min(referralCount, 1), target: 1, completed: referralCount >= 1 },
    promos_3_three_months_customer_details: { current: Math.min(promo3.activeMonths, 3), target: 3, completed: promo3Count >= 3 && promo3.activeMonths >= 3, detail: `${promo3Count}/3 promociones · ${promo3.activeMonths}/3 meses` },
  };

  const existing = new Map((unlocksResult.data || []).map((row: any) => [row.achievement_key, row]));
  const earnedRows = achievementDefinitions
    .filter((definition) => progressByKey[definition.key].completed && !existing.has(definition.key))
    .map((definition) => ({ store_id: storeId, achievement_key: definition.key, source: "earned", progress_snapshot: progressByKey[definition.key] }));

  if (earnedRows.length) {
    const { error } = await supabase.from("store_achievement_unlocks").upsert(earnedRows, { onConflict: "store_id,achievement_key", ignoreDuplicates: true });
    if (error) throw error;
    for (const row of earnedRows) existing.set(row.achievement_key, { ...row, unlocked_at: new Date().toISOString() });
  }

  if (existing.has("orders_100_product_limit") && Number(store.product_limit || 30) < 50) {
    const { error } = await supabase.from("stores").update({ product_limit: 50 }).eq("id", storeId);
    if (error) throw error;
    store.product_limit = 50;
  }

  const achievements = achievementDefinitions.map((definition) => {
    const unlock: any = existing.get(definition.key);
    return { ...definition, progress: progressByKey[definition.key], unlocked: Boolean(unlock), source: unlock?.source || null, unlockedAt: unlock?.unlocked_at || null, resetAt: resetByKey.get(definition.key) || null };
  });
  const features: Record<string, boolean> = {
    delivery: true,
    basic_stats: true,
    customers_basic: true,
    ...Object.fromEntries(achievementDefinitions.map((definition) => [definition.feature, achievements.find((item) => item.key === definition.key)?.unlocked || false])),
  };

  return { storeId, productLimit: features.product_limit_50 ? Math.max(50, Number(store.product_limit || 30)) : Math.min(30, Number(store.product_limit || 30)), achievements, features };
}

export async function assertAchievementFeature(supabase: any, storeId: string, feature: AchievementFeature) {
  const state = await loadStoreAchievements(supabase, storeId);
  if (!state.features[feature]) {
    const achievement = state.achievements.find((item) => item.feature === feature);
    throw new PanelAccessError(`Completa el logro “${achievement?.title || feature}” para desbloquear esta función.`, 403);
  }
  return state;
}

export function isNonCancelledOrder(status: unknown) {
  return !cancelledStatuses.has(String(status || "").toLowerCase());
}
