import { MarketplaceClient } from "@/components/public/MarketplaceClient";
import { getPublicStores } from "@/lib/supabase/catalog";
import { getActiveMonthlyMarketplaceRewards } from "@/lib/monthly-challenges";

export const revalidate = 60;

export default async function MarketplacePage() {
  const [stores, rewards] = await Promise.all([
    getPublicStores(),
    getActiveMonthlyMarketplaceRewards(),
  ]);
  const storesWithBadges = stores.map((store) => ({
    ...store,
    monthlyBadges: rewards.fastStoreIds.has(store.id) ? ["Comercio rápido"] : [],
  }));

  return <MarketplaceClient stores={storesWithBadges} featuredProducts={rewards.featuredProducts} />;
}
