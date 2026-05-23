import { notFound } from "next/navigation";
import { CatalogClient } from "@/components/public/CatalogClient";
import { StoreHeader } from "@/components/public/StoreHeader";
import { getStoreBySlug, stores } from "@/data/stores";

export function generateStaticParams() {
  return stores.map((store) => ({ storeSlug: store.slug }));
}

export default async function StorePage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const store = getStoreBySlug(storeSlug);

  if (!store) notFound();

  return (
    <>
      <StoreHeader store={store} />
      <CatalogClient store={store} />
    </>
  );
}
