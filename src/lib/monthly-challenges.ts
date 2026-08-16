import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ChallengeRow = {
  id: string;
  challenge_key: string;
  title: string;
  description: string;
  reward_label: string;
  reward_type: "featured_product" | "fast_store_badge";
  starts_at: string;
  ends_at: string;
  config: Record<string, number> | null;
};

function minutesBetween(start: string, end: string) {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60000;
}

export async function loadMonthlyChallenges(supabase: any, storeId: string) {
  const now = new Date().toISOString();
  const { data: challenges, error: challengeError } = await supabase
    .from("monthly_challenges")
    .select("id, challenge_key, title, description, reward_label, reward_type, starts_at, ends_at, config")
    .eq("is_active", true)
    .lte("starts_at", now)
    .order("starts_at", { ascending: false });
  if (challengeError) throw challengeError;
  if (!challenges?.length) return [];

  const earliestStart = challenges.reduce((value: string, row: ChallengeRow) => row.starts_at < value ? row.starts_at : value, challenges[0].starts_at);
  const latestEnd = challenges.reduce((value: string, row: ChallengeRow) => row.ends_at > value ? row.ends_at : value, challenges[0].ends_at);
  const [ordersResult, activationsResult, productsResult, rewardsResult] = await Promise.all([
    supabase.from("orders").select("id, status, created_at, first_responded_at, completed_at, customer_phone").eq("store_id", storeId).gte("created_at", earliestStart).lt("created_at", latestEnd),
    supabase.from("store_promotion_events").select("product_id, discount_percent, activated_at").eq("store_id", storeId).gte("activated_at", earliestStart).lt("activated_at", latestEnd),
    supabase.from("products").select("id, name, discount_percent, is_available").eq("store_id", storeId),
    supabase.from("store_monthly_challenge_rewards").select("challenge_id, product_id, source, status, earned_at, reward_starts_at, reward_ends_at").eq("store_id", storeId),
  ]);
  for (const result of [ordersResult, activationsResult, productsResult, rewardsResult]) if (result.error) throw result.error;

  const orders = ordersResult.data || [];
  const products = productsResult.data || [];
  const rewards = new Map((rewardsResult.data || []).map((row: any) => [row.challenge_id, row]));
  const output = [];
  for (const challenge of challenges as ChallengeRow[]) {
    const challengeOrders = orders.filter((order: any) => order.created_at >= challenge.starts_at && order.created_at < challenge.ends_at);
    let progress: { current: number; target: number; completed: boolean; detail: string; productId?: string };

    if (challenge.reward_type === "featured_product") {
      const activations = (activationsResult.data || []).filter((row: any) => row.activated_at >= challenge.starts_at && row.activated_at < challenge.ends_at);
      const winningProductId = activations[0]?.product_id ? String(activations[0].product_id) : "";
      const activatedNames = activations.map((row: any) => products.find((product: any) => product.id === row.product_id)?.name).filter(Boolean);
      progress = {
        current: winningProductId ? 1 : 0,
        target: 1,
        completed: Boolean(winningProductId),
        detail: winningProductId ? `Descuento activado en ${activatedNames[0] || "tu producto"}` : "Activa un descuento para comenzar",
        productId: winningProductId || undefined,
      };
    } else {
      const minimumOrders = Number(challenge.config?.minimum_orders || 10);
      const targetPercent = Number(challenge.config?.target_percent || 90);
      const responseMinutes = Number(challenge.config?.response_minutes || 15);
      const eligible = challengeOrders.filter((order: any) => order.status !== "cancelled");
      const fast = eligible.filter((order: any) => order.first_responded_at && minutesBetween(order.created_at, order.first_responded_at) <= responseMinutes);
      const percent = eligible.length ? Math.round((fast.length / eligible.length) * 100) : 0;
      progress = {
        current: Math.min(eligible.length, minimumOrders),
        target: minimumOrders,
        completed: eligible.length >= minimumOrders && percent >= targetPercent,
        detail: `${eligible.length}/${minimumOrders} pedidos · ${percent}% respondidos en 15 min`,
      };
    }

    let reward: any = rewards.get(challenge.id);
    if (progress.completed && !reward) {
      const earnedAt = new Date();
      const rewardStartsAt = challenge.reward_type === "fast_store_badge" ? new Date("2026-09-01T04:00:00.000Z") : earnedAt;
      const rewardEndsAt = challenge.reward_type === "fast_store_badge" ? new Date("2026-10-01T04:00:00.000Z") : new Date(earnedAt.getTime() + 7 * 86400000);
      const { data, error } = await supabase.from("store_monthly_challenge_rewards").upsert({
        challenge_id: challenge.id,
        store_id: storeId,
        product_id: progress.productId || null,
        progress_snapshot: progress,
        reward_starts_at: rewardStartsAt.toISOString(),
        reward_ends_at: rewardEndsAt.toISOString(),
      }, { onConflict: "challenge_id,store_id", ignoreDuplicates: true }).select("challenge_id, product_id, source, status, earned_at, reward_starts_at, reward_ends_at").maybeSingle();
      if (error) throw error;
      reward = data || rewards.get(challenge.id);
    }

    output.push({
      key: challenge.challenge_key,
      title: challenge.title,
      description: challenge.description,
      reward: challenge.reward_label,
      startsAt: challenge.starts_at,
      endsAt: challenge.ends_at,
      progress,
      unlocked: reward?.status === "active",
      source: reward?.source || null,
      rewardStatus: reward?.status || null,
      rewardStartsAt: reward?.reward_starts_at || null,
      rewardEndsAt: reward?.reward_ends_at || null,
    });
  }

  return output;
}

export type MarketplaceFeaturedProduct = {
  rewardId: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  productId: string;
  productName: string;
  description: string;
  imageUrl: string;
  priceUsd: number;
  discountPercent: number;
};

export async function getActiveMonthlyMarketplaceRewards() {
  const featuredProducts: MarketplaceFeaturedProduct[] = [];
  const fastStoreIds = new Set<string>();

  try {
    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("store_monthly_challenge_rewards")
      .select("id, store_id, product_id, monthly_challenges!inner(reward_type), stores!inner(name, slug, is_active), products(name, description, image_url, price_usd, discount_percent, is_available)")
      .eq("status", "active")
      .lte("reward_starts_at", now)
      .gt("reward_ends_at", now);
    if (error) throw error;

    for (const row of data || []) {
      const challenge = Array.isArray(row.monthly_challenges) ? row.monthly_challenges[0] : row.monthly_challenges;
      const store = Array.isArray(row.stores) ? row.stores[0] : row.stores;
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      if (!store?.is_active) continue;
      if (challenge?.reward_type === "fast_store_badge") fastStoreIds.add(String(row.store_id));
      if (challenge?.reward_type === "featured_product" && product?.is_available && row.product_id) {
        featuredProducts.push({
          rewardId: String(row.id), storeId: String(row.store_id), storeName: store.name, storeSlug: store.slug,
          productId: String(row.product_id), productName: product.name, description: product.description || "Producto destacado en Somos.",
          imageUrl: product.image_url || "", priceUsd: Number(product.price_usd || 0), discountPercent: Number(product.discount_percent || 0),
        });
      }
    }
  } catch (error) {
    console.warn(
      "Could not load active monthly marketplace rewards:",
      error instanceof Error ? error.message : error
    );
  }

  return { featuredProducts, fastStoreIds };
}
