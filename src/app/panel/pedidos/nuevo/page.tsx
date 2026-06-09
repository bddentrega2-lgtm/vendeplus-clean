import { PanelShell } from "@/components/panel/PanelShell";
import { ManualOrderManager } from "@/components/panel/ManualOrderManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPanelOrderPage() {
  return (
    <PanelShell
      active="/panel/pedidos"
      title="Crear pedido"
      subtitle="Registra pedidos recibidos por WhatsApp, Instagram, llamada o atención directa sin salir del panel."
    >
      <ManualOrderManager />
    </PanelShell>
  );
}
