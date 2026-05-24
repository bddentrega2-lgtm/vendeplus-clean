import { PanelShell } from "@/components/panel/PanelShell";
import { StatsManager } from "@/components/panel/StatsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelStatsPage() {
  return (
    <PanelShell
      active="/panel/estadisticas"
      title="Estadisticas"
      subtitle="Analiza ventas, pedidos, clientes, productos, metodos de pago, estados y comportamiento logistico."
    >
      <StatsManager />
    </PanelShell>
  );
}
