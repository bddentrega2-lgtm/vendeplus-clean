"use client";
import { StoreBrandHeader } from "@/components/public/StoreBrandHeader";
import type { CSSProperties } from "react";
import { Clock, Grid2X2, LayoutList, MessageCircle, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Store } from "@/types";
import { CategoryTabs } from "@/components/public/CategoryTabs";
import { ProductCard, ProductListItem } from "@/components/public/ProductCard";
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
  const [viewMode, setViewMode] = useState<"visual" | "list">("list");
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

  const cartQuantityByProduct = useMemo(() => {
    return cartItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.productId] = (acc[item.productId] || 0) + item.quantity;
      return acc;
    }, {});
  }, [cartItems]);

  useEffect(() => {
    const savedView = localStorage.getItem("vendeplus_public_catalog_view");
    if (savedView === "visual" || savedView === "list") {
      setViewMode(savedView);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("vendeplus_public_catalog_view", viewMode);
  }, [viewMode]);

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
            <p className="text-[11px] font-bold text-white/70">Confirmación</p>
            <p className="text-sm font-black">WhatsApp</p>
          </div>
          <div className="rounded-2xl bg-[#FFB547] p-3 text-[#25262B]">
            <ShieldCheck className="mx-auto mb-1" size={17} />
            <p className="text-[11px] font-bold text-[#25262B]/65">Tasa usada</p>
            <p className="text-sm font-black">$1 = Bs. {store.usdToBs || 600}</p>
          </div>
          <div className="rounded-2xl bg-[#FFF8F0] p-3 text-[#25262B] ring-1 ring-[#25262B]/[0.06]">
            <Clock className="mx-auto mb-1 text-[#2E3A79]" size={17} />
            <p className="text-[11px] font-bold text-[#746f69]">Delivery</p>
            <p className="text-sm font-black">{store.deliveryEstimate}</p>
          </div>
        </div>
      </section>

      <CategoryTabs categories={store.categories} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId} />

      {showFeatured ? (
        <section className="mb-6">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">Destacados</p>
              <h2 className="mt-1 text-2xl font-black text-[#25262B]">Los favoritos</h2>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} storeSlug={store.slug} usdToBs={store.usdToBs || 600} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">Catálogo disponible</p>
          <h2 className="mt-1 text-xl font-black text-[#25262B]">Menú completo</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-[#25262B]/[0.06]">
            <button
              type="button"
              onClick={() => setViewMode("visual")}
              className={[
                "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black",
                viewMode === "visual"
                  ? "bg-[#2E3A79] text-white"
                  : "text-[#746f69]",
              ].join(" ")}
            >
              <Grid2X2 size={15} />
              Vista visual
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={[
                "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black",
                viewMode === "list"
                  ? "bg-[#2E3A79] text-white"
                  : "text-[#746f69]",
              ].join(" ")}
            >
              <LayoutList size={15} />
              Vista lista
            </button>
          </div>
          <p className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#746f69] shadow-sm">{menuProducts.length} productos</p>
        </div>
      </div>

      <div className={viewMode === "visual" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "grid gap-2"}>
        {menuProducts.map((product) => (
          viewMode === "visual" ? (
            <ProductCard key={product.id} product={product} storeSlug={store.slug} usdToBs={store.usdToBs || 600} />
          ) : (
            <ProductListItem
              key={product.id}
              product={product}
              storeSlug={store.slug}
              usdToBs={store.usdToBs || 600}
              cartQuantity={cartQuantityByProduct[product.id] || 0}
            />
          )
        ))}
      </div>

      {menuProducts.length === 0 ? (
        <div className="rounded-[28px] bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-black text-[#25262B]">No encontramos productos</p>
          <p className="mt-2 text-sm font-bold text-[#746f69]">Prueba con otra categoría o búsqueda.</p>
        </div>
      ) : null}

      <div className="mobile-cart-safe-space h-44 md:h-10" aria-hidden="true" />
      <CartBar storeSlug={store.slug} usdToBs={store.usdToBs || 600} />
    </main>
  );
}








