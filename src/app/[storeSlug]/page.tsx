import { notFound } from "next/navigation";
import { CatalogClient } from "@/components/public/CatalogClient";
import { getPublicStoreBySlug } from "@/lib/supabase/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StorePage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getPublicStoreBySlug(storeSlug);

  if (!store) notFound();

  return <CatalogClient store={store} />;
}
