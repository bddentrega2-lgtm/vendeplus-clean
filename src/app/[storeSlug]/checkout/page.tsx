import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/public/CheckoutForm";
import { getPublicStoreBySlug } from "@/lib/supabase/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getPublicStoreBySlug(storeSlug);

  if (!store) notFound();

  return <CheckoutForm store={store} />;
}
