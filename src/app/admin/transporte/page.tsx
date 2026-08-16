import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTransportManager } from "@/components/admin/AdminTransportManager";

export default function AdminTransportePage() {
  return (
    <AdminShell
      active="/admin/transporte"
      title="Transporte"
      subtitle="Aprueba empresas delivery, revisa solicitudes, conexiones y resumen semanal de delivery afiliado."
    >
      <AdminTransportManager />
    </AdminShell>
  );
}
