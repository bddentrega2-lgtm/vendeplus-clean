import { notFound } from "next/navigation";
import { ConfirmationClient } from "@/components/public/ConfirmationClient";
import { getPublicStoreBySlug, getPublicStoreSlugs } from "@/lib/supabase/catalog";

export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getPublicStoreSlugs();

  return slugs.map((storeSlug) => ({ storeSlug }));
}

export default async function ConfirmationPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const store = await getPublicStoreBySlug(storeSlug);

  if (!store) notFound();

  return <ConfirmationClient store={store} />;
}
