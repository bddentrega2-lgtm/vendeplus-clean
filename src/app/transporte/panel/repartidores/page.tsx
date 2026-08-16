import { TransportAgencyPanel } from "@/components/transport/TransportAgencyPanel";

export default function TransporteRepartidoresPage() {
  return (
    <main className="min-h-screen bg-[#FFF8F0] px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <TransportAgencyPanel initialTab="repartidores" />
      </div>
    </main>
  );
}
