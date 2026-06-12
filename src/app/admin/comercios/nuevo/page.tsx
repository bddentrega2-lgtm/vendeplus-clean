import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStoreForm } from "@/components/admin/AdminStoreForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function NewAdminStorePage() {
  return (
    <AdminShell
      active="/admin/comercios/nuevo"
      title="Crear comercio"
      subtitle="Alta mínima de un nuevo cliente: datos comerciales, URL pública, operación, pagos e identidad visual."
    >
      <AdminStoreForm />
    </AdminShell>
  );
}
