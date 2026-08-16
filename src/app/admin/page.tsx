import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminPage() {
  return (
    <AdminShell
      active="/admin"
      title="Resumen fundador"
      subtitle="Vista global para revisar comercios, planes, vencimientos, pedidos y alertas sin tocar herramientas tecnicas."
    >
      <AdminDashboard />
    </AdminShell>
  );
}
