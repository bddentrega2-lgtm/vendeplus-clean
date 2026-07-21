import { TransportLanding } from "@/components/transport/TransportLanding";
import { getPublicTransportAgencyLogos } from "@/lib/transport";

export const dynamic = "force-dynamic";

export default async function TransportePage() {
  const transportAgencies = await getPublicTransportAgencyLogos();

  return <TransportLanding transportAgencies={transportAgencies} />;
}
