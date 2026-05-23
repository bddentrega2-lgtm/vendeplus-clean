import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/public/CheckoutForm";
import { getStoreBySlug, stores } from "@/data/stores";

export function generateStaticParams() {
  return stores.map((store) => ({ storeSlug: store.slug }));
}

export default async function CheckoutPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const store = getStoreBySlug(storeSlug);

  if (!store) notFound();

  return <CheckoutForm store={store} />;
}
