import { DeliveryManager } from "@/components/panel/DeliveryManager";
import { PanelShell } from "@/components/panel/PanelShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PanelDeliveryPage() {
  return (
    <PanelShell
      active="/panel/delivery"
      title="Delivery"
      subtitle="Configura retiro, tarifas, zonas, rangos y reglas de delivery gratis."
    >
      <DeliveryManager />
    </PanelShell>
  );
}
