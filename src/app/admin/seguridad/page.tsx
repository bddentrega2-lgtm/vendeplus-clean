import { AdminMfaSetup } from "@/components/admin/AdminMfaSetup";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = { title: "Seguridad | Admin Somos", robots: { index: false, follow: false } };

export default function AdminSecurityPage() {
  return (
    <AdminShell active="/admin/seguridad" title="Seguridad" subtitle="Configura primero tu autenticador. La validación obligatoria se activará solo para Administrador después de esta prueba.">
      <AdminMfaSetup />
    </AdminShell>
  );
}
