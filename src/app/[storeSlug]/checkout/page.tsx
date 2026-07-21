import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/public/CheckoutForm";
import { getPublicStoreShellBySlug } from "@/lib/supabase/catalog";

export const revalidate = 30;

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getPublicStoreShellBySlug(storeSlug);

  if (!store) notFound();

  return <CheckoutForm store={store} />;
}
