import { CatalogManager } from "@/components/panel/CatalogManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelCatalogPage() {
  return <CatalogManager />;
}
