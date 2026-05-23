import { notFound } from "next/navigation";
import { CatalogClient } from "@/components/public/CatalogClient";
import { StoreHeader } from "@/components/public/StoreHeader";
import { getPublicStoreBySlug, getPublicStoreSlugs } from "@/lib/supabase/catalog";

export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getPublicStoreSlugs();

  return slugs.map((storeSlug) => ({ storeSlug }));
}

export default async function StorePage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const store = await getPublicStoreBySlug(storeSlug);

  if (!store) notFound();

  return (
    <>
      <StoreHeader store={store} />
      <CatalogClient store={store} />
    </>
  );
}
