import { HomeClient } from "@/components/public/HomeClient";
import { getPublicStores } from "@/lib/supabase/catalog";
import { getPublicTransportAgencyLogos } from "@/lib/transport";

export const revalidate = 60;

export default async function HomePage() {
  const [stores, transportAgencies] = await Promise.all([
    getPublicStores(),
    getPublicTransportAgencyLogos(),
  ]);

  return <HomeClient stores={stores} transportAgencies={transportAgencies} />;
}
