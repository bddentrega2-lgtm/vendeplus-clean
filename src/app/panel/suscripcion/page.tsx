import { PanelShell } from "@/components/panel/PanelShell";
import { SubscriptionPaymentManager } from "@/components/panel/SubscriptionPaymentManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PanelSubscriptionPage() {
  return (
    <PanelShell
      active="/panel/suscripcion"
      title="Suscripción"
      subtitle="Revisa vencimiento, calcula el monto en Bs y envía tu pago a revisión."
    >
      <SubscriptionPaymentManager />
    </PanelShell>
  );
}
