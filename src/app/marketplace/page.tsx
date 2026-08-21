import { MarketplaceClient } from "@/components/public/MarketplaceClient";
import { getPublicStores } from "@/lib/supabase/catalog";
import { getActiveMonthlyMarketplaceRewards } from "@/lib/monthly-challenges";
import { getMarketplaceDiscovery } from "@/lib/marketplace";

export const revalidate = 60;

export default async function MarketplacePage() {
  const [stores, rewards, discovery] = await Promise.all([
    getPublicStores(),
    getActiveMonthlyMarketplaceRewards(),
    getMarketplaceDiscovery(),
  ]);
  const storesWithBadges = stores.map((store) => ({
    ...store,
    monthlyBadges: rewards.fastStoreIds.has(store.id) ? ["Comercio rápido"] : [],
  }));

  return <MarketplaceClient stores={storesWithBadges} featuredProducts={rewards.featuredProducts} discovery={discovery} />;
}
