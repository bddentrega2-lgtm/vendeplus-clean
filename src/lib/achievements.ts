import { getStoreProductLimit } from "@/lib/plans";

export const achievementDefinitions = [
  { key: "orders_50_full_stats", title: "Completa 50 pedidos", description: "Completa 50 pedidos de al menos 20 clientes diferentes.", reward: "Estadísticas completas", feature: "full_stats", target: 50 },
  { key: "orders_100_product_limit", title: "Completa 100 pedidos", description: "Completa 100 pedidos de al menos 35 clientes diferentes.", reward: "20 productos adicionales (50 en total)", feature: "product_limit_50", target: 100 },
  { key: "referral_brand_colors", title: "Refiere un comercio", description: "Invita un comercio que se registre y sea autorizado por Super Admin.", reward: "Personalización de colores", feature: "brand_colors", target: 1 },
  { key: "promos_3_three_months_customer_details", title: "Activa 3 promociones y mantén actividad 3 meses", description: "Promociona tres productos distintos y registra ventas en tres meses diferentes.", reward: "Detalles completos de clientes", feature: "customers_detail", target: 3 },
] as const;

export type AchievementKey = (typeof achievementDefinitions)[number]["key"];
export type AchievementFeature = (typeof achievementDefinitions)[number]["feature"];

export const includedAchievementFeatures: Record<AchievementFeature | "delivery" | "basic_stats" | "customers_basic", boolean> = {
  delivery: true,
  basic_stats: true,
  customers_basic: true,
  full_stats: true,
  product_limit_50: true,
  brand_colors: true,
  customers_detail: true,
};

export async function loadStoreAchievements(supabase: any, storeId: string) {
  const { data: store, error } = await supabase.from("stores").select("plan_type, product_limit").eq("id", storeId).single();
  if (error) throw error;
  return {
    storeId,
    productLimit: getStoreProductLimit(store),
    achievements: achievementDefinitions.map((definition) => ({
      ...definition,
      progress: { current: definition.target, target: definition.target, completed: true },
      unlocked: true,
      source: "included" as const,
      unlockedAt: null,
      resetAt: null,
    })),
    features: includedAchievementFeatures,
  };
}

export async function assertAchievementFeature(supabase: any, storeId: string, feature: AchievementFeature) {
  const state = await loadStoreAchievements(supabase, storeId);
  if (!state.features[feature]) throw new Error("Esta función no está disponible.");
  return state;
}

export function isNonCancelledOrder(status: unknown) {
  return !new Set(["cancelled", "canceled", "cancelado"]).has(String(status || "").toLowerCase());
}
