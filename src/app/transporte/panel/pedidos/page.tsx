import { TransportAgencyPanel } from "@/components/transport/TransportAgencyPanel";

export default function TransportePedidosPage() {
  return (
    <main className="min-h-screen bg-[#FFF8F0] px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <TransportAgencyPanel initialTab="pedidos" />
      </div>
    </main>
  );
}
