import { notFound } from "next/navigation";
import { CartPageClient } from "@/components/public/CartPageClient";
import { getPublicStoreShellBySlug } from "@/lib/supabase/catalog";

export const revalidate = 30;
export const dynamic = "force-dynamic";

export default async function CartPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getPublicStoreShellBySlug(storeSlug);

  if (!store) notFound();

  return <CartPageClient store={store} />;
}
