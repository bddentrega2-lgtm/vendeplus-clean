import { notFound } from "next/navigation";
import { ConfirmationClient } from "@/components/public/ConfirmationClient";
import { getStoreBySlug, stores } from "@/data/stores";

export function generateStaticParams() {
  return stores.map((store) => ({ storeSlug: store.slug }));
}

export default async function ConfirmationPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const store = getStoreBySlug(storeSlug);

  if (!store) notFound();

  return <ConfirmationClient store={store} />;
}
