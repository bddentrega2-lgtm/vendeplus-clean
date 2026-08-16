import { AdminShell } from "@/components/admin/AdminShell";
import { AdminSubscriptionPaymentsManager } from "@/components/admin/AdminSubscriptionPaymentsManager";

export default function AdminSubscriptionsPage() {
  return (
    <AdminShell
      active="/admin/suscripciones"
      title="Suscripciones"
      subtitle="Control manual de planes, vencimientos, pausas y cuentas que requieren atencion."
    >
      <AdminSubscriptionPaymentsManager />
    </AdminShell>
  );
}
