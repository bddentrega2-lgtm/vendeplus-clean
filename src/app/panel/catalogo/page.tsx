import { PanelShell } from "@/components/panel/PanelShell";
import { CatalogManager } from "@/components/panel/CatalogManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelCatalogPage() {
  return (
    <PanelShell
      active="/panel/catalogo"
      title="Catálogo"
      subtitle="Organiza categorías, visibilidad, destacados y orden visual del catálogo público de cada comercio."
    >
      <CatalogManager />
    </PanelShell>
  );
}
