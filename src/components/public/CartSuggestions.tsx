"use client";

import { useEffect, useMemo, useState } from "react";
import type { CartItem, Product, Store } from "@/types";
import { ProductSuggestionCard } from "@/components/public/ProductCard";

function productHasStock(product: Product) {
  if (product.isAvailable === false) return false;
  if (!product.inventoryManaged) return true;
  return (product.inventorySkus || []).some((sku) => sku.isAvailable && sku.stock > 0);
}

function diversifyProducts(products: Product[], cartCategoryIds: Set<string>) {
  const categoryCounts = new Map<string, number>();
  const selected: Product[] = [];

  for (const product of products) {
    const categoryId = product.categoryId || "general";
    const currentCount = categoryCounts.get(categoryId) || 0;
    const maxPerCategory = cartCategoryIds.has(categoryId) ? 1 : 2;
    if (currentCount >= maxPerCategory) continue;

    selected.push(product);
    categoryCounts.set(categoryId, currentCount + 1);
    if (selected.length >= 6) break;
  }

  if (selected.length >= 6) return selected;

  for (const product of products) {
    if (selected.some((item) => item.id === product.id)) continue;
    selected.push(product);
    if (selected.length >= 6) break;
  }

  return selected;
}

function fallbackRecommendations(store: Store, cartProductIds: Set<string>) {
  return store.products
    .filter((product) => product.isCartSuggestion)
    .filter((product) => !cartProductIds.has(product.id))
    .filter(productHasStock)
    .slice(0, 12);
}

export function CartSuggestions({
  store,
  items,
  isStoreOpen,
}: {
  store: Store;
  items: CartItem[];
  isStoreOpen: boolean;
}) {
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState("");
  const cartProductIds = useMemo(
    () => new Set(items.map((item) => item.productId)),
    [items]
  );
  const cartCategoryIds = useMemo(() => {
    const productById = new Map(store.products.map((product) => [product.id, product]));
    return new Set(
      items
        .map((item) => productById.get(item.productId)?.categoryId)
        .filter(Boolean) as string[]
    );
  }, [items, store.products]);

  useEffect(() => {
    let cancelled = false;

    async function loadSuggestions() {
      if (!items.length) {
        setOrderedIds([]);
        return;
      }

      try {
        const params = new URLSearchParams({
          storeSlug: store.slug,
          productIds: Array.from(cartProductIds).join(","),
          categoryIds: Array.from(cartCategoryIds).join(","),
        });
        const response = await fetch(`/api/catalog/cart-suggestions?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudieron cargar sugerencias.");
        if (!cancelled) setOrderedIds(Array.isArray(data.productIds) ? data.productIds : []);
      } catch {
        if (!cancelled) setOrderedIds([]);
      }
    }

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [cartCategoryIds, cartProductIds, items.length, refreshKey, store.slug]);

  const suggestions = useMemo(() => {
    if (!items.length) return [];

    const productsById = new Map(store.products.map((product) => [product.id, product]));
    const orderedProducts = orderedIds
      .map((productId) => productsById.get(productId))
      .filter(Boolean) as Product[];
    const fallbackProducts = fallbackRecommendations(store, cartProductIds);
    const combined = [...orderedProducts, ...fallbackProducts]
      .filter((product, index, list) => list.findIndex((item) => item.id === product.id) === index)
      .filter((product) => !cartProductIds.has(product.id))
      .filter(productHasStock);

    return diversifyProducts(combined, cartCategoryIds);
  }, [cartCategoryIds, cartProductIds, items.length, orderedIds, store]);

  if (!suggestions.length) return null;

  return (
    <section className="mt-6 overflow-hidden rounded-[30px] bg-white p-4 shadow-sm ring-1 ring-[#25262B]/[0.06]">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black leading-tight text-[#25262B]">¿Te provoca algo más?</h2>
        </div>
        {notice ? <p className="max-w-[150px] text-right text-[11px] font-black text-[#6FA64F]">{notice}</p> : null}
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex snap-x snap-mandatory gap-3 pr-8">
          {suggestions.map((product) => (
            <ProductSuggestionCard
              key={product.id}
              product={product}
              storeSlug={store.slug}
              usdToBs={store.usdToBs || 600}
              baseCurrency={store.baseCurrency || "USD"}
              showPricesInBs={store.showPricesInBs !== false}
              isStoreOpen={isStoreOpen}
              onUnavailable={() => {
                setNotice("Actualizamos las sugerencias.");
                setRefreshKey((current) => current + 1);
                window.setTimeout(() => setNotice(""), 1800);
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
