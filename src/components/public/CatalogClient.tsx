"use client";
import { StoreBrandHeader } from "@/components/public/StoreBrandHeader";
import type { CSSProperties } from "react";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Store } from "@/types";
import { CategoryTabs } from "@/components/public/CategoryTabs";
import { ProductCard } from "@/components/public/ProductCard";
import { CartBar } from "@/components/public/CartBar";

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

  const products = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return store.products.filter((product) => {
      const matchesCategory = selectedCategoryId === "all" || product.categoryId === selectedCategoryId;
      const matchesQuery = !normalizedQuery || `${product.name} ${product.description} ${product.tags?.join(" ")}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [query, selectedCategoryId, store.products]);

  return (
    <main style={getBrandStyle(store)} className="vp-public-store vp-container pb-32 pt-5">
      <StoreBrandHeader store={store} />
      <section className="mb-4 rounded-[30px] bg-white/90 p-4 shadow-xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.07]">
        <div className="flex items-center gap-3 rounded-2xl bg-[#FFF8F0] px-4 py-3 ring-1 ring-[#25262B]/[0.06]">
          <Search size={18} className="text-[#746f69]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar en el menú..."
            className="w-full bg-transparent text-sm font-bold text-[#25262B] outline-none placeholder:text-[#746f69]/70"
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-[#2E3A79] p-3 text-white">
            <p className="text-[11px] font-bold text-white/70">Pedidos</p>
            <p className="text-sm font-black">WhatsApp</p>
          </div>
          <div className="rounded-2xl bg-[#FFB547] p-3 text-[#25262B]">
            <p className="text-[11px] font-bold text-[#25262B]/65">Tasa</p>
            <p className="text-sm font-black">$1 = Bs. 600</p>
          </div>
          <div className="rounded-2xl bg-[#FFF8F0] p-3 text-[#25262B] ring-1 ring-[#25262B]/[0.06]">
            <p className="text-[11px] font-bold text-[#746f69]">Entrega</p>
            <p className="text-sm font-black">GPS / Mapa</p>
          </div>
        </div>
      </section>

      <CategoryTabs categories={store.categories} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId} />

      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">Menú disponible</p>
          <h2 className="mt-1 text-2xl font-black text-[#25262B]">Elige, revisa y confirma</h2>
        </div>
        <p className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#746f69] shadow-sm">{products.length} productos</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} storeSlug={store.slug} />
        ))}
      </div>

      {products.length === 0 ? (
        <div className="rounded-[28px] bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-black text-[#25262B]">No encontramos productos</p>
          <p className="mt-2 text-sm font-bold text-[#746f69]">Prueba con otra categoría o búsqueda.</p>
        </div>
      ) : null}

      <div className="mobile-cart-safe-space h-44 md:h-10" aria-hidden="true" />
      <CartBar storeSlug={store.slug} />
    </main>
  );
}





