import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminPage() {
  return (
    <AdminShell
      active="/admin"
      title="Resumen fundador"
      subtitle="Vista global para preparar clientes, revisar comercios y operar altas sin tocar herramientas técnicas."
    >
      <AdminDashboard />
    </AdminShell>
  );
}
