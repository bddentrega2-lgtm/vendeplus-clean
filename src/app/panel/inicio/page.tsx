import { PanelShell } from "@/components/panel/PanelShell";
import { DashboardManager } from "@/components/panel/DashboardManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelInicioPage() {
  return (
    <PanelShell
      active="/panel"
      title="Inicio"
      subtitle="Primeros pasos, accesos rápidos y resumen de ventas para operar tu negocio."
    >
      <DashboardManager />
    </PanelShell>
  );
}
