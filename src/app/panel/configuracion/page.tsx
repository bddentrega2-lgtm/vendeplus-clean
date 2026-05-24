import { PanelShell } from "@/components/panel/PanelShell";
import { ConfigManager } from "@/components/panel/ConfigManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelSettingsPage() {
  return (
    <PanelShell
      active="/panel/configuracion"
      title="Configuración"
      subtitle="Datos operativos filtrados por los comercios asignados al usuario conectado."
    >
      <ConfigManager />
    </PanelShell>
  );
}
