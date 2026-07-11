import { notFound } from "next/navigation";
import { ConfirmationClient } from "@/components/public/ConfirmationClient";
import { getPublicStoreShellBySlug } from "@/lib/supabase/catalog";

export const revalidate = 30;
export const dynamic = "force-dynamic";

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getPublicStoreShellBySlug(storeSlug);

  if (!store) notFound();

  return <ConfirmationClient store={store} />;
}
