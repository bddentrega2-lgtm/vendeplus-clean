import { AdminAnnouncementsManager } from "@/components/admin/AdminAnnouncementsManager";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminAnnouncementsPage() {
  return (
    <AdminShell
      active="/admin/notificaciones"
      title="Notificaciones"
      subtitle="Publica novedades, retos y funciones nuevas para todos los comercios."
    >
      <AdminAnnouncementsManager />
    </AdminShell>
  );
}
