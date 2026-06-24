import { PanelShell } from "@/components/panel/PanelShell";
import { OptionsManager } from "@/components/panel/OptionsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelOptionsPage() {
  return (
    <PanelShell
      active="/panel/opciones"
      title="Opciones y extras"
      subtitle="Crea tallas, colores, salsas, bebidas, sabores o extras y aplícalos a varios productos."
    >
      <OptionsManager />
    </PanelShell>
  );
}
