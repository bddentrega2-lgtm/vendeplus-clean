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
      title="Detalle de comercio"
      subtitle="Ficha completa para editar datos base, plan, vencimientos, estado, operacion, pagos y estilo."
    >
      <AdminStoreForm storeId={storeId} />
    </AdminShell>
  );
}
