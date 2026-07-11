"use client";
import { StoreBrandHeader } from "@/components/public/StoreBrandHeader";
import type { CSSProperties } from "react";
import { Clock, MessageCircle, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Store } from "@/types";
import { CategoryTabs } from "@/components/public/CategoryTabs";
import { ProductListItem } from "@/components/public/ProductCard";
import { CartBar } from "@/components/public/CartBar";
import { getCart } from "@/lib/cart";

function getBrandStyle(store: any): CSSProperties {
  return {
    "--brand-primary": store.primaryColor || "#2E3A79",
    "--brand-accent": store.accentColor || "#FFB547",
    "--brand-button-text": store.buttonTextColor || "#25262B",
  } as CSSProperties;
}
export function CatalogClient({ store }: { store: Store }) {
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [query, setQuery] = useState("");
  const [cartItems, setCartItems] = useState<ReturnType<typeof getCart>>([]);

  const products = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return store.products.filter((product) => {
      const matchesCategory = selectedCategoryId === "all" || product.categoryId === selectedCategoryId;
      const matchesQuery = !normalizedQuery || `${product.name} ${product.description} ${product.tags?.join(" ")}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [query, selectedCategoryId, store.products]);

  const featuredProducts = useMemo(
    () =>
      store.products
        .filter((product) => product.isFeatured)
        .slice(0, 3),
    [store.products]
  );

  const showFeatured = selectedCategoryId === "all" && !query.trim() && featuredProducts.length > 0;
  const menuProducts = showFeatured
    ? products.filter((product) => !product.isFeatured)
    : products;
  const showPricesInBs = store.showPricesInBs !== false;
  const baseCurrency = store.baseCurrency || "USD";
  const showGroupedMenu = selectedCategoryId === "all";

  const categorySections = useMemo(() => {
    const productsByCategory = new Map<string, typeof menuProducts>();
    const uncategorized: typeof menuProducts = [];

    for (const product of menuProducts) {
      if (!product.categoryId) {
        uncategorized.push(product);
        continue;
      }

      const current = productsByCategory.get(product.categoryId) || [];
      current.push(product);
      productsByCategory.set(product.categoryId, current);
    }

    const sections = store.categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        products: productsByCategory.get(category.id) || [],
      }))
      .filter((section) => section.products.length > 0);

    if (uncategorized.length > 0) {
      sections.push({
        id: "uncategorized",
        name: "Otros",
        products: uncategorized,
      });
    }

    return sections;
  }, [menuProducts, store.categories]);

  const cartQuantityByProduct = useMemo(() => {
    return cartItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.productId] = (acc[item.productId] || 0) + item.quantity;
      return acc;
    }, {});
  }, [cartItems]);

  useEffect(() => {
    function syncCart() {
      setCartItems(getCart(store.slug));
    }

    syncCart();
    window.addEventListener("vendeplus-cart-change", syncCart);
    window.addEventListener("storage", syncCart);
    return () => {
      window.removeEventListener("vendeplus-cart-change", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, [store.slug]);

  return (
    <main style={getBrandStyle(store)} className="vp-public-store vp-container pb-32 pt-5">
      <StoreBrandHeader store={store} />
      {store.openState && !store.openState.isOpen ? (
        <section className="mb-4 rounded-[24px] bg-red-50 p-4 text-sm font-black text-red-700 ring-1 ring-red-100">
          {store.openState.label}. Puedes revisar el catálogo, pero el comercio no está recibiendo pedidos ahora.
        </section>
      ) : null}
      <section className="mb-4 rounded-[30px] bg-white/90 p-4 shadow-xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.07]">
        <div className="flex items-center gap-3 rounded-2xl bg-[#FFF8F0] px-4 py-3 ring-1 ring-[#25262B]/[0.06]">
          <Search size={18} className="text-[#746f69]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar productos"
            className="w-full bg-transparent text-sm font-bold text-[#25262B] outline-none placeholder:text-[#746f69]/70"
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-[#2E3A79] p-3 text-white">
            <MessageCircle className="mx-auto mb-1 text-[#FFB547]" size={17} />
            <p className="text-sm font-black">WhatsApp</p>
          </div>
          {showPricesInBs ? (
            <div className="rounded-2xl bg-[#FFB547] p-3 text-[#25262B]">
              <ShieldCheck className="mx-auto mb-1" size={17} />
              <p className="text-sm font-black">{baseCurrency === "EUR" ? "€" : "$"}1 = Bs. {store.usdToBs || 600}</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#FFB547] p-3 text-[#25262B]">
              <ShieldCheck className="mx-auto mb-1" size={17} />
              <p className="text-sm font-black">{baseCurrency === "EUR" ? "€ Euro" : "$ Dólar"}</p>
            </div>
          )}
          <div className="rounded-2xl bg-[#FFF8F0] p-3 text-[#25262B] ring-1 ring-[#25262B]/[0.06]">
            <Clock className="mx-auto mb-1 text-[#2E3A79]" size={17} />
            <p className="text-sm font-black">{store.deliveryEstimate || "Delivery"}</p>
          </div>
        </div>
      </section>

      <CategoryTabs categories={store.categories} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId} />

      {showFeatured ? (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-black text-[#25262B]">Favoritos</h2>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex snap-x snap-mandatory gap-3">
              {featuredProducts.map((product) => (
                <div key={product.id} className="min-w-[88%] snap-start sm:min-w-[420px] lg:min-w-[460px]">
                  <ProductListItem
                    product={product}
                    storeSlug={store.slug}
                    usdToBs={store.usdToBs || 600}
                    baseCurrency={baseCurrency}
                    showPricesInBs={showPricesInBs}
                    cartQuantity={cartQuantityByProduct[product.id] || 0}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-xl font-black text-[#25262B]">Menú</h2>
        <p className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#746f69] shadow-sm">{menuProducts.length} productos</p>
      </div>

      {showGroupedMenu ? (
        <div className="grid gap-6">
          {categorySections.map((section) => (
            <section key={section.id} className="scroll-mt-24">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-lg font-black text-[#25262B]">{section.name}</h3>
                <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#746f69] shadow-sm">
                  {section.products.length}
                </span>
              </div>
              <div className="grid gap-2">
                {section.products.map((product) => (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    storeSlug={store.slug}
                    usdToBs={store.usdToBs || 600}
                    baseCurrency={baseCurrency}
                    showPricesInBs={showPricesInBs}
                    cartQuantity={cartQuantityByProduct[product.id] || 0}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          {menuProducts.map((product) => (
            <ProductListItem
              key={product.id}
              product={product}
              storeSlug={store.slug}
              usdToBs={store.usdToBs || 600}
              baseCurrency={baseCurrency}
              showPricesInBs={showPricesInBs}
              cartQuantity={cartQuantityByProduct[product.id] || 0}
            />
          ))}
        </div>
      )}

      {menuProducts.length === 0 ? (
        <div className="rounded-[28px] bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-black text-[#25262B]">No encontramos productos</p>
          <p className="mt-2 text-sm font-bold text-[#746f69]">Prueba con otra categoría o búsqueda.</p>
        </div>
      ) : null}

      <div className="mobile-cart-safe-space h-44 md:h-10" aria-hidden="true" />
      <CartBar storeSlug={store.slug} usdToBs={store.usdToBs || 600} baseCurrency={baseCurrency} showPricesInBs={showPricesInBs} />
    </main>
  );
}








