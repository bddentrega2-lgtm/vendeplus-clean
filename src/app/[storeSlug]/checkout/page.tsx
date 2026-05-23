import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/public/CheckoutForm";
import { getPublicStoreBySlug, getPublicStoreSlugs } from "@/lib/supabase/catalog";

export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getPublicStoreSlugs();

  return slugs.map((storeSlug) => ({ storeSlug }));
}

export default async function CheckoutPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const store = await getPublicStoreBySlug(storeSlug);

  if (!store) notFound();

  return <CheckoutForm store={store} />;
}
