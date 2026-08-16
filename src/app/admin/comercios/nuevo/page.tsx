import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStoreForm } from "@/components/admin/AdminStoreForm";

export default function NewAdminStorePage() {
  return (
    <AdminShell
      active="/admin/comercios/nuevo"
      title="Crear comercio"
      subtitle="Alta controlada de comercios, plan inicial, estado comercial y acceso del usuario dueno."
    >
      <AdminStoreForm />
    </AdminShell>
  );
}
