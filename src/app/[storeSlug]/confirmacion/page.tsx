import { notFound } from "next/navigation";
import { ConfirmationClient } from "@/components/public/ConfirmationClient";
import { getPublicStoreBySlug } from "@/lib/supabase/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getPublicStoreBySlug(storeSlug);

  if (!store) notFound();

  return <ConfirmationClient store={store} />;
}
