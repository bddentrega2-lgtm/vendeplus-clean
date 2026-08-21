import type { Metadata } from "next";
import { TdkBranchSelector, type TdkBranch } from "@/components/public/TdkBranchSelector";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildPublicUrl } from "@/lib/public-url";

export const revalidate = 30;

const TDK_STORE_SLUGS = [
  "pasteleria-tdk",
  "pasteleria-tdk-delicias",
  "pasteleria-tdk-los-cedros",
];

export const metadata: Metadata = {
  title: "Elige tu sede | Pastelería TDK",
  description: "Encuentra la sede de Pastelería TDK más cercana y realiza tu pedido en su catálogo.",
  alternates: { canonical: buildPublicUrl("/tdk") },
};

export default async function TdkPage() {
  const isPreview = process.env.VERCEL_ENV === "preview";
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("stores")
    .select("id, slug, name, address, latitude, longitude, logo_url, cover_image_url, is_active")
    .in("slug", TDK_STORE_SLUGS)
    .order("name", { ascending: true });

  if (!isPreview) query = query.eq("is_active", true);

  const { data, error } = await query;
  const stores: TdkBranch[] = error
    ? []
    : (data || []).map((store) => ({
        id: String(store.id),
        slug: String(store.slug),
        name: String(store.name),
        address: String(store.address || "Ubicación por confirmar"),
        latitude: Number(store.latitude || 0),
        longitude: Number(store.longitude || 0),
        logoUrl: String(store.logo_url || ""),
        heroImageUrl: String(store.cover_image_url || ""),
        isActive: store.is_active === true,
      }));

  return <TdkBranchSelector stores={stores} isPreview={isPreview} />;
}
