import { HomeClient } from "@/components/public/HomeClient";
import { getPublicStores } from "@/lib/supabase/catalog";

export const revalidate = 60;

export default async function HomePage() {
  const stores = await getPublicStores();

  return <HomeClient stores={stores} />;
}
