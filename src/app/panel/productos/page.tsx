import { PanelShell } from "@/components/panel/PanelShell";
import { ProductManager } from "@/components/panel/ProductManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelProductsPage() {
  return (
    <PanelShell
      active="/panel/productos"
      title="Productos"
      subtitle="Crea, edita y controla el catálogo real de cada comercio conectado a Supabase."
    >
      <ProductManager />
    </PanelShell>
  );
}
