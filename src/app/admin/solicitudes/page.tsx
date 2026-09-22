import { AdminRegistrationRequestsManager } from "@/components/admin/AdminRegistrationRequestsManager";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminRegistrationRequestsPage() {
  return (
    <AdminShell
      active="/admin/solicitudes"
      title="Solicitudes"
      subtitle="Revisa el potencial de cada comercio y habilita el acceso únicamente después de aprobarlo."
    >
      <AdminRegistrationRequestsManager />
    </AdminShell>
  );
}
