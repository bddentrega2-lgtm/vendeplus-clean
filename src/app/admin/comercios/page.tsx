import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStoresManager } from "@/components/admin/AdminStoresManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminStoresPage() {
  return (
    <AdminShell
      active="/admin/comercios"
      title="Comercios"
      subtitle="Directorio de comercios conectados, con estado, actividad y accesos rápidos para editar o abrir el catálogo público."
    >
      <AdminStoresManager />
    </AdminShell>
  );
}
