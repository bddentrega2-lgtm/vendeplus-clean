import { notFound } from "next/navigation";
import { MarketplaceClient } from "@/components/public/MarketplaceClient";
import { getPublicTransportAgencyMarketplaceBySlug } from "@/lib/supabase/catalog";

export const revalidate = 60;

export default async function TransportAgencyMarketplacePage({
  params,
}: {
  params: Promise<{ agencySlug: string }>;
}) {
  const { agencySlug } = await params;
  const marketplace = await getPublicTransportAgencyMarketplaceBySlug(agencySlug);

  if (!marketplace) notFound();

  const { agency, stores } = marketplace;
  const location = [agency.city, agency.state].filter(Boolean).join(", ");

  return (
    <MarketplaceClient
      stores={stores}
      eyebrow=""
      title={`Comercios aliados a ${agency.name}`}
      description=""
      storesEyebrow="Red aliada"
      storesTitle="Elige un comercio aliado"
      emptyTitle="Esta empresa aun no tiene comercios visibles"
      emptyText="Cuando un comercio activo se conecte con esta empresa delivery, aparecera aqui."
      footerText={`Marketplace aliado de ${agency.name}.`}
      partnerName={agency.name}
      partnerLogoUrl={agency.logoUrl}
      partnerBannerImageUrl={agency.bannerImageUrl}
      partnerLocation={location}
    />
  );
}
