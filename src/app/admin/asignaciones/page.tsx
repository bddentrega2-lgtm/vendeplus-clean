import { AdminAssignmentsManager } from "@/components/admin/AdminAssignmentsManager";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminAssignmentsPage() {
  return (
    <AdminShell
      active="/admin/asignaciones"
      title="Asignaciones"
      subtitle="Administra que usuarios pueden operar cada comercio y con que rol."
    >
      <AdminAssignmentsManager />
    </AdminShell>
  );
}
