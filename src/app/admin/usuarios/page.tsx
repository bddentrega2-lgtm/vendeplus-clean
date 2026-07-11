import { AdminAssignmentsManager } from "@/components/admin/AdminAssignmentsManager";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminUsersPage() {
  return (
    <AdminShell
      active="/admin/usuarios"
      title="Usuarios"
      subtitle="Busca usuarios, asigna accesos a comercios, cambia roles y quita accesos sin entrar a Supabase."
    >
      <AdminAssignmentsManager />
    </AdminShell>
  );
}
