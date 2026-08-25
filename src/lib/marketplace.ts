import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type MarketplaceProduct = {
  productId: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  productName: string;
  description: string;
  imageUrl: string;
  priceUsd: number;
  discountPercent: number;
  createdAt: string;
  unitsSold?: number;
};

export type MarketplaceDiscovery = {
  offers: MarketplaceProduct[];
  bestSellers: MarketplaceProduct[];
  newProducts: MarketplaceProduct[];
};

const emptyDiscovery: MarketplaceDiscovery = {
  offers: [],
  bestSellers: [],
  newProducts: [],
};

function normalizeProducts(value: unknown): MarketplaceProduct[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item: any) => ({
      productId: String(item.productId || ""),
      storeId: String(item.storeId || ""),
      storeName: String(item.storeName || "Comercio"),
      storeSlug: String(item.storeSlug || ""),
      productName: String(item.productName || "Producto"),
      description: String(item.description || ""),
      imageUrl: String(item.imageUrl || ""),
      priceUsd: Number(item.priceUsd || 0),
      discountPercent: Number(item.discountPercent || 0),
      createdAt: String(item.createdAt || ""),
      unitsSold: item.unitsSold === undefined ? undefined : Number(item.unitsSold || 0),
    }))
    .filter((item) => item.productId && item.storeSlug && item.priceUsd > 0);
}

export async function getMarketplaceDiscovery(): Promise<MarketplaceDiscovery> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("marketplace_discovery", { p_limit: 12 });
    if (error) return emptyDiscovery;
    const payload = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const newProducts = normalizeProducts(payload.newProducts);
    const newProductIds = newProducts.map((product) => product.productId);
    const productImages = new Map<string, string>();

    if (newProductIds.length) {
      const { data: rows, error: imagesError } = await supabase
        .from("products")
        .select("id, image_url")
        .in("id", newProductIds);

      if (!imagesError) {
        for (const row of rows || []) {
          const imageUrl = String(row.image_url || "").trim();
          if (imageUrl) productImages.set(String(row.id), imageUrl);
        }
      }
    }

    return {
      offers: normalizeProducts(payload.offers),
      bestSellers: normalizeProducts(payload.bestSellers),
      newProducts: newProducts
        .filter((product) => productImages.has(product.productId))
        .map((product) => ({ ...product, imageUrl: productImages.get(product.productId) || "" })),
    };
  } catch {
    return emptyDiscovery;
  }
}
