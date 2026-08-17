"use client";
import { StoreBrandHeader } from "@/components/public/StoreBrandHeader";
import type { CSSProperties } from "react";
import { Clock, MessageCircle, Search, Share2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Store } from "@/types";
import { CategoryTabs } from "@/components/public/CategoryTabs";
import { ProductListItem } from "@/components/public/ProductCard";
import { CartBar } from "@/components/public/CartBar";
import { getCart } from "@/lib/cart";
import { buildClientPublicUrl } from "@/lib/public-url";
import { useLiveStoreOpenState } from "@/hooks/use-live-store-open-state";
import {
  getTableOrderContext,
  saveTableOrderContext,
  type TableOrderContext,
} from "@/lib/table-orders";

const FEATURED_PRODUCTS_LIMIT = 5;
const CATEGORY_PREVIEW_LIMIT = 7;

function getBrandStyle(store: any): CSSProperties {
  return {
    "--brand-primary": store.primaryColor || "#1F464C",
    "--brand-accent": store.accentColor || "#F27533",
    "--brand-button-text": store.buttonTextColor || "#25262B",
  } as CSSProperties;
}
export function CatalogClient({
  store,
  tableOrder = null,
  onChangeTable,
}: {
  store: Store;
  tableOrder?: TableOrderContext | null;
  onChangeTable?: () => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [query, setQuery] = useState("");
  const [cartItems, setCartItems] = useState<ReturnType<typeof getCart>>([]);
  const [shareStatus, setShareStatus] = useState("");
  const [savedTableOrder, setSavedTableOrder] = useState<TableOrderContext | null>(null);
  const activeTableOrder = tableOrder || savedTableOrder;

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
        .slice(0, FEATURED_PRODUCTS_LIMIT),
    [store.products]
  );

  const showFeatured = selectedCategoryId === "all" && !query.trim() && featuredProducts.length > 0;
  const menuProducts = showFeatured
    ? products.filter((product) => !product.isFeatured)
    : products;
  const showPricesInBs = store.showPricesInBs !== false;
  const baseCurrency = store.baseCurrency || "USD";
  const showGroupedMenu = selectedCategoryId === "all";
  const showCategoryPreviews = showGroupedMenu && !query.trim();
  const whatsappUrl = store.whatsappPhone ? `https://wa.me/${store.whatsappPhone}` : "";
  const openState = useLiveStoreOpenState(store);
  const isStoreOpen = openState.isOpen;

  async function shareCatalog() {
    const url = buildClientPublicUrl(`${window.location.pathname}${window.location.search}`);
    const shareData = {
      title: `${store.name} en Somos`,
      text: `Mira el catálogo de ${store.name} en Somos.`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(url);
      setShareStatus("Link copiado");
      window.setTimeout(() => setShareStatus(""), 2200);
    } catch {
      setShareStatus("No se pudo compartir");
      window.setTimeout(() => setShareStatus(""), 2200);
    }
  }

  const categorySections = useMemo(() => {
    const allProductsByCategory = new Map<string, typeof products>();
    const allUncategorized: typeof products = [];

    for (const product of products) {
      if (!product.categoryId) {
        allUncategorized.push(product);
        continue;
      }

      const current = allProductsByCategory.get(product.categoryId) || [];
      current.push(product);
      allProductsByCategory.set(product.categoryId, current);
    }

    const sections = store.categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        products: allProductsByCategory.get(category.id) || [],
        totalProducts: allProductsByCategory.get(category.id)?.length || 0,
      }))
      .filter((section) => section.products.length > 0 || section.totalProducts > 0);

    if (allUncategorized.length > 0) {
      sections.push({
        id: "uncategorized",
        name: "Otros",
        products: allUncategorized,
        totalProducts: allUncategorized.length,
      });
    }

    return sections;
  }, [products, store.categories]);

  const cartQuantityByProduct = useMemo(() => {
    return cartItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.productId] = (acc[item.productId] || 0) + item.quantity;
      return acc;
    }, {});
  }, [cartItems]);

  useEffect(() => {
    if (tableOrder) saveTableOrderContext(store.slug, tableOrder);
    setSavedTableOrder(tableOrder || getTableOrderContext(store.slug));
  }, [store.slug, tableOrder]);

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
      {activeTableOrder ? (
        <section className="mb-4 flex items-center justify-between gap-3 rounded-[24px] bg-[#FFB547] p-4 text-[#25262B] shadow-lg">
          <div>
            <p className="text-xs font-black uppercase">
              {activeTableOrder.fulfillmentMode === "counter_pickup" ? "Entrega" : "Recibir en"}
            </p>
            <p className="text-base font-black">{activeTableOrder.tableName}{activeTableOrder.tableZone ? ` · ${activeTableOrder.tableZone}` : ""}</p>
          </div>
          {onChangeTable ? <button type="button" onClick={onChangeTable} className="text-xs font-black underline">Cambiar</button> : null}
        </section>
      ) : null}
      {!isStoreOpen ? (
        <section className="mb-4 rounded-[24px] bg-red-50 p-4 text-sm font-black text-red-700 ring-1 ring-red-100">
          {openState.label}. Puedes revisar el catálogo, pero el comercio no está recibiendo pedidos ahora.
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
        <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <a
            href={whatsappUrl || undefined}
            target={whatsappUrl ? "_blank" : undefined}
            rel={whatsappUrl ? "noopener noreferrer" : undefined}
            aria-disabled={!whatsappUrl}
            className={[
              "rounded-2xl bg-[#2E3A79] p-3 text-white transition",
              whatsappUrl ? "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#2E3A79]/15" : "pointer-events-none opacity-60",
            ].join(" ")}
          >
            <MessageCircle className="mx-auto mb-1 text-[#FFB547]" size={17} />
            <p className="text-sm font-black">WhatsApp</p>
          </a>
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
          <button
            type="button"
            onClick={shareCatalog}
            className="rounded-2xl bg-white p-3 text-[#25262B] ring-1 ring-[#25262B]/[0.06] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#2E3A79]/10"
          >
            <Share2 className="mx-auto mb-1 text-[#2E3A79]" size={17} />
            <p className="text-sm font-black">{shareStatus || "Compartir"}</p>
          </button>
        </div>
      </section>

      <CategoryTabs categories={store.categories} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId} />

      {showFeatured ? (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#746f69]">Promocional</p>
              <h2 className="text-2xl font-black text-[#25262B]">Favoritos del momento</h2>
            </div>
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
                    isStoreOpen={isStoreOpen}
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
                  {section.totalProducts} producto{section.totalProducts === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid gap-2">
                {(showCategoryPreviews && section.products.length > CATEGORY_PREVIEW_LIMIT
                  ? section.products.slice(0, CATEGORY_PREVIEW_LIMIT)
                  : section.products
                ).map((product) => (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    storeSlug={store.slug}
                    usdToBs={store.usdToBs || 600}
                    baseCurrency={baseCurrency}
                    showPricesInBs={showPricesInBs}
                    cartQuantity={cartQuantityByProduct[product.id] || 0}
                    isStoreOpen={isStoreOpen}
                  />
                ))}
              </div>
              {showCategoryPreviews && section.totalProducts > CATEGORY_PREVIEW_LIMIT && section.id !== "uncategorized" ? (
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId(section.id)}
                  className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#2E3A79] shadow-sm ring-1 ring-[#25262B]/[0.07]"
                >
                  Ver todos en {section.name} ({section.totalProducts})
                </button>
              ) : null}
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
              isStoreOpen={isStoreOpen}
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
      <CartBar storeSlug={store.slug} usdToBs={store.usdToBs || 600} baseCurrency={baseCurrency} showPricesInBs={showPricesInBs} isStoreOpen={isStoreOpen} />
    </main>
  );
}








