import { DashboardManager } from "@/components/panel/DashboardManager";
import { PanelShell } from "@/components/panel/PanelShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelInicioPage() {
  return (
    <PanelShell active="/panel" title="Inicio">
      <DashboardManager />
    </PanelShell>
  );
}
