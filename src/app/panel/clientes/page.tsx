import { PanelShell } from "@/components/panel/PanelShell";
import { CustomersManager } from "@/components/panel/CustomersManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelCustomersPage() {
  return (
    <PanelShell
      active="/panel/clientes"
      title="Clientes"
      subtitle="Consulta quién compra, qué pide y a quién puedes volver a escribirle por WhatsApp."
    >
      <CustomersManager />
    </PanelShell>
  );
}
