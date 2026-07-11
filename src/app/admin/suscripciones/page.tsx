import { AdminShell } from "@/components/admin/AdminShell";
import { AdminSubscriptionPaymentsManager } from "@/components/admin/AdminSubscriptionPaymentsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
