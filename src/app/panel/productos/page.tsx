import { ProductManager } from "@/components/panel/ProductManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelProductsPage() {
  return <ProductManager />;
}
