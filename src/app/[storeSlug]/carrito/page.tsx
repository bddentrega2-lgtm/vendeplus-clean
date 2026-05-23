import { notFound } from "next/navigation";
import { CartPageClient } from "@/components/public/CartPageClient";
import { getStoreBySlug, stores } from "@/data/stores";

export function generateStaticParams() {
  return stores.map((store) => ({ storeSlug: store.slug }));
}

export default async function CartPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const store = getStoreBySlug(storeSlug);

  if (!store) notFound();

  return <CartPageClient store={store} />;
}
