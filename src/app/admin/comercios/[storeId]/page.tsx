import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStoreForm } from "@/components/admin/AdminStoreForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditAdminStorePage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;

  return (
    <AdminShell
      active="/admin/comercios"
      title="Editar comercio"
      subtitle="Ajusta datos base, visibilidad pública, operación, pagos y estilo del comercio."
    >
      <AdminStoreForm storeId={storeId} />
    </AdminShell>
  );
}
