import { getPublicStoreSlugs } from "@/lib/supabase/catalog";

export const revalidate = 30;

export async function generateStaticParams() {
  const slugs = await getPublicStoreSlugs();

  return slugs.map((storeSlug) => ({ storeSlug }));
}

export default function StoreSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
