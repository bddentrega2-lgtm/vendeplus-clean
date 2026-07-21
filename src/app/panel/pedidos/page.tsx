import { OrdersManager } from "@/components/panel/OrdersManager";
import { PanelShell } from "@/components/panel/PanelShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelOrdersPage() {
  return (
    <PanelShell active="/panel/pedidos" title="Pedidos">
      <OrdersManager />
    </PanelShell>
  );
}
