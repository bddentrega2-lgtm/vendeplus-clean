import { notFound } from "next/navigation";
import { CartPageClient } from "@/components/public/CartPageClient";
import { getPublicStoreBySlug } from "@/lib/supabase/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CartPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getPublicStoreBySlug(storeSlug);

  if (!store) notFound();

  return <CartPageClient store={store} />;
}
