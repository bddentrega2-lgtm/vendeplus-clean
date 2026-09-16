import { AdminMfaManager } from "@/components/admin/AdminMfaManager";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminSecurityPage() {
  return (
    <AdminShell
      title="Seguridad"
      subtitle="Configura y verifica el segundo factor requerido para administrar Somos."
      active="/admin/seguridad"
    >
      <AdminMfaManager />
    </AdminShell>
  );
}
