import { AdminAssignmentsManager } from "@/components/admin/AdminAssignmentsManager";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminAssignmentsPage() {
  return (
    <AdminShell
      active="/admin/asignaciones"
      title="Asignaciones"
      subtitle="Conecta usuarios existentes de Supabase Auth con los comercios que pueden administrar desde el panel."
    >
      <AdminAssignmentsManager />
    </AdminShell>
  );
}
