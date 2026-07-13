"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Clock3,
  MessageCircle,
  Search,
  ShoppingBag,
  Store as StoreIcon,
  Truck,
} from "lucide-react";
import type { Store } from "@/types";
import { BrandLogo } from "@/components/public/BrandLogo";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

const businessLabels: Record<string, string> = {
  food: "Comida",
  fashion: "Ropa",
  accessories: "Accesorios",
  tech: "Tecnologia",
  desserts: "Postres",
  beauty: "Belleza",
  general: "Otros",
};

function labelForStore(store: Store) {
  const key = String(store.category || "").toLowerCase();
  return businessLabels[key] || store.category || "Comercio";
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function storeSearchText(store: Store) {
  return [store.name, store.category, store.description, store.address]
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function StoreCard({ store }: { store: Store }) {
  const canDeliver = store.deliverySettings?.deliveryEnabled !== false;
  const canPickup = store.deliverySettings?.pickupEnabled !== false;
  const isOpen = store.openState?.isOpen !== false;

  return (
    <Link
      href={`/${store.slug}`}
      className="group grid overflow-hidden rounded-[24px] bg-white shadow-xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.07] transition hover:-translate-y-1"
    >
      <div className="relative h-44 overflow-hidden">
        <OptimizedImage
          src={store.logoUrl || store.heroImageUrl}
          alt={store.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="bg-[#F8F3E8] object-cover transition duration-500 group-hover:scale-105"
          fallback={
            <div className="grid h-full w-full place-items-center bg-[#F8F3E8] text-4xl font-black text-[#2E3A79]">
              {store.name.slice(0, 1).toUpperCase()}
            </div>
          }
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-[#2E3A79]">
            {labelForStore(store)}
          </span>
          <span className={isOpen ? "rounded-full bg-green-100 px-3 py-1.5 text-xs font-black text-green-700" : "rounded-full bg-red-100 px-3 py-1.5 text-xs font-black text-red-700"}>
            {isOpen ? "Abierto" : "Cerrado"}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-xl font-black leading-tight text-[#25262B]">{store.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm font-bold leading-relaxed text-[#746f69]">
          {store.description}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {canDeliver ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF6E3] px-2.5 py-1 text-[11px] font-black text-[#437028]">
              <Truck size={12} />
              Delivery
            </span>
          ) : null}
          {canPickup ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E9EEFF] px-2.5 py-1 text-[11px] font-black text-[#2E3A79]">
              <ShoppingBag size={12} />
              Retiro
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1 text-xs font-black text-[#746f69]">
            <Clock3 size={14} />
            {store.openState?.label || store.deliveryEstimate}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFB547] px-3 py-2 text-xs font-black text-[#25262B]">
            Ver catalogo
            <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function MarketplaceClient({ stores }: { stores: Store[] }) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");

  const filters = useMemo(() => {
    const names = new Set<string>();
    for (const store of stores) names.add(labelForStore(store));
    return ["Todos", ...Array.from(names).filter(Boolean).slice(0, 9)];
  }, [stores]);

  const filteredStores = useMemo(() => {
    const needle = normalizeSearch(query);
    const filter = activeFilter === "Todos" ? "" : normalizeSearch(activeFilter);

    return stores.filter((store) => {
      const text = storeSearchText(store);
      return (!needle || text.includes(needle)) && (!filter || text.includes(filter));
    });
  }, [activeFilter, query, stores]);

  return (
    <main className="min-h-screen bg-[#FFF8F0] text-[#25262B]">
      <header className="sticky top-0 z-30 border-b border-[#25262B]/[0.06] bg-[#FFF8F0]/95 backdrop-blur">
        <nav className="vp-container flex items-center justify-between gap-3 py-3">
          <Link href="/" aria-label="Ir al inicio de VendeMas">
            <BrandLogo compact />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden rounded-full bg-white px-4 py-2 text-sm font-black text-[#2E3A79] ring-1 ring-[#25262B]/10 sm:inline-flex"
            >
              Comercios y delivery
            </Link>
            <Link
              href="/panel/login"
              className="inline-flex rounded-full bg-[#FFB547] px-4 py-2 text-sm font-black text-[#25262B]"
            >
              Iniciar sesion
            </Link>
          </div>
        </nav>
      </header>

      <section className="bg-white">
        <div className="vp-container py-8 sm:py-12">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2E3A79]">
            Marketplace
          </p>
          <h1 className="mt-2 max-w-3xl text-4xl font-black leading-[1.03] sm:text-6xl">
            Compra en comercios afiliados a VendeMas
          </h1>
          <p className="mt-4 max-w-2xl text-base font-bold leading-relaxed text-[#746f69]">
            Busca un comercio, arma tu pedido, elige delivery o retiro y confirma por WhatsApp.
          </p>

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {[
              ["1", "Busca", "Encuentra negocios por nombre o rubro."],
              ["2", "Pide", "Agrega productos, cantidades y opciones."],
              ["3", "Confirma", "El comercio recibe el pedido por WhatsApp."],
            ].map(([number, title, text]) => (
              <div key={number} className="flex items-center gap-3 border-t border-[#25262B]/10 pt-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#2E3A79] text-sm font-black text-[#FFB547]">
                  {number}
                </span>
                <div>
                  <p className="text-sm font-black">{title}</p>
                  <p className="text-xs font-bold text-[#746f69]">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#25262B]/[0.06] bg-white">
        <div className="vp-container py-5">
          <label className="relative block">
            <Search
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#746f69]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar negocio o rubro..."
              className="w-full rounded-[22px] border border-[#25262B]/10 bg-[#FFF8F0] py-4 pl-12 pr-4 text-base font-extrabold outline-none transition focus:border-[#2E3A79] focus:bg-white focus:ring-4 focus:ring-[#2E3A79]/10"
            />
          </label>

          {filters.length > 1 ? (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 vp-scrollbar-none">
              {filters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={[
                    "shrink-0 rounded-full px-4 py-2 text-sm font-black transition",
                    activeFilter === filter
                      ? "bg-[#2E3A79] text-white"
                      : "bg-[#F8F3E8] text-[#746f69] ring-1 ring-[#25262B]/[0.06]",
                  ].join(" ")}
                >
                  {filter}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="vp-container py-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2E3A79]">
              Comercios disponibles
            </p>
            <h2 className="mt-1 text-3xl font-black">Elige donde comprar</h2>
          </div>
          <p className="text-sm font-black text-[#746f69]">
            {filteredStores.length} resultado{filteredStores.length === 1 ? "" : "s"}
          </p>
        </div>

        {filteredStores.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredStores.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[26px] bg-white p-6 text-center shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.07]">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FFB547] text-[#25262B]">
              <StoreIcon size={24} />
            </div>
            <h3 className="mt-4 text-2xl font-black">Pronto veras negocios disponibles aqui</h3>
            <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
              Mientras tanto, puedes volver al inicio para registrar un comercio o empresa delivery.
            </p>
          </div>
        )}
      </section>

      <footer className="bg-[#25262B] py-8 text-white">
        <div className="vp-container flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <BrandLogo compact />
            <p className="mt-3 text-sm font-bold text-white/65">
              Marketplace de comercios afiliados.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#2E3A79]"
          >
            <MessageCircle size={17} />
            Soy comercio o delivery
          </Link>
        </div>
      </footer>
    </main>
  );
}
