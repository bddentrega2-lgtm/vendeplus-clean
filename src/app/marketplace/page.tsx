import { MarketplaceClient } from "@/components/public/MarketplaceClient";
import { getPublicStores } from "@/lib/supabase/catalog";

export const revalidate = 60;

export default async function MarketplacePage() {
  const stores = await getPublicStores();

  return <MarketplaceClient stores={stores} />;
}
