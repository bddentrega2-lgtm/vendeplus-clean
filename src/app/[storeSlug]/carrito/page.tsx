import { notFound } from "next/navigation";
import { CartPageClient } from "@/components/public/CartPageClient";
import { getPublicStoreBySlug, getPublicStoreSlugs } from "@/lib/supabase/catalog";

export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getPublicStoreSlugs();

  return slugs.map((storeSlug) => ({ storeSlug }));
}

export default async function CartPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const store = await getPublicStoreBySlug(storeSlug);

  if (!store) notFound();

  return <CartPageClient store={store} />;
}
