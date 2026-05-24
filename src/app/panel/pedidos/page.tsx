import { PanelShell } from "@/components/panel/PanelShell";
import { OrdersManager } from "@/components/panel/OrdersManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelOrdersPage() {
  return (
    <PanelShell
      active="/panel/pedidos"
      title="Pedidos"
      subtitle="Opera pedidos reales: revisa detalles, cambia estados, copia comandas y abre GPS o ruta."
    >
      <OrdersManager />
    </PanelShell>
  );
}
