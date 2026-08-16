import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStoresManager } from "@/components/admin/AdminStoresManager";

export default function AdminStoresPage() {
  return (
    <AdminShell
      active="/admin/comercios"
      title="Comercios"
      subtitle="Directorio de comercios conectados con filtros, estado, plan, actividad y acciones rapidas."
    >
      <AdminStoresManager />
    </AdminShell>
  );
}
