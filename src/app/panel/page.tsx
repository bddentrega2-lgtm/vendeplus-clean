import { PanelShell } from "@/components/panel/PanelShell";
import { DashboardManager } from "@/components/panel/DashboardManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelPage() {
  return (
    <PanelShell
      active="/panel"
      title="Dashboard"
      subtitle="Resumen operativo de ventas, pedidos, productos y rendimiento filtrado por los comercios asignados al usuario."
    >
      <DashboardManager />
    </PanelShell>
  );
}
