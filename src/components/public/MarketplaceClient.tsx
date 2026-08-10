"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Clock3,
  MessageCircle,
  Search,
  Star,
  ShoppingBag,
  Store as StoreIcon,
  Truck,
  Zap,
} from "lucide-react";
import type { Store } from "@/types";
import { BrandLogo } from "@/components/public/BrandLogo";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import type { MarketplaceFeaturedProduct } from "@/lib/monthly-challenges";

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
          {store.monthlyBadges?.includes("Comercio rápido") ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0C9] px-2.5 py-1 text-[11px] font-black text-[#8A5700]">
              <Zap size={12} /> Comercio rápido
            </span>
          ) : null}
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

export function MarketplaceClient({
  stores,
  featuredProducts = [],
  eyebrow = "Marketplace",
  title = "Compra en comercios afiliados a Somos",
  description = "Busca un comercio, arma tu pedido, elige delivery o retiro y confirma por WhatsApp.",
  storesEyebrow = "Comercios disponibles",
  storesTitle = "Elige donde comprar",
  emptyTitle = "Pronto veras negocios disponibles aqui",
  emptyText = "Mientras tanto, puedes volver al inicio para registrar un comercio o empresa delivery.",
  footerText = "Marketplace de comercios afiliados.",
  partnerName,
  partnerLogoUrl,
  partnerBannerImageUrl,
  partnerLocation,
}: {
  stores: Store[];
  featuredProducts?: MarketplaceFeaturedProduct[];
  eyebrow?: string;
  title?: string;
  description?: string;
  storesEyebrow?: string;
  storesTitle?: string;
  emptyTitle?: string;
  emptyText?: string;
  footerText?: string;
  partnerName?: string;
  partnerLogoUrl?: string | null;
  partnerBannerImageUrl?: string | null;
  partnerLocation?: string;
}) {
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
          <Link href="/" aria-label="Ir al inicio de Somos">
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
          {partnerName && partnerBannerImageUrl ? (
            <div className="relative mb-6 h-44 overflow-hidden rounded-[32px] bg-[#2E3A79] shadow-2xl shadow-[#2E3A79]/15 sm:h-64">
              <OptimizedImage
                src={partnerBannerImageUrl}
                alt={`Banner de ${partnerName}`}
                fill
                sizes="(max-width: 768px) 100vw, 1080px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#25262B]/70 via-[#25262B]/10 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/75">
                    Marketplace aliado
                  </p>
                  <p className="mt-1 text-3xl font-black text-white sm:text-5xl">{partnerName}</p>
                </div>
              </div>
            </div>
          ) : null}
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2E3A79]">
            {eyebrow}
          </p>
          <h1 className="mt-2 max-w-3xl text-4xl font-black leading-[1.03] sm:text-6xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base font-bold leading-relaxed text-[#746f69]">
            {description}
          </p>

          {partnerName ? (
            <div className="mt-6 flex max-w-2xl items-center gap-4 rounded-[28px] bg-[#FFF8F0] p-4 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
              <OptimizedImage
                src={partnerLogoUrl || ""}
                alt={`${partnerName} logo`}
                width={80}
                height={80}
                sizes="80px"
                className="h-20 w-20 shrink-0 rounded-3xl bg-white object-cover shadow-lg shadow-[#2E3A79]/10 ring-1 ring-[#25262B]/10"
                fallback={
                  <span className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-[#2E3A79] text-2xl font-black text-[#FFB547]">
                    {partnerName.slice(0, 1).toUpperCase()}
                  </span>
                }
              />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                  Empresa delivery aliada
                </p>
                <p className="truncate text-2xl font-black text-[#25262B]">{partnerName}</p>
                {partnerLocation ? (
                  <p className="text-sm font-bold text-[#746f69]">{partnerLocation}</p>
                ) : null}
              </div>
            </div>
          ) : null}

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

      {featuredProducts.length ? (
        <section className="border-y border-[#FFB547]/30 bg-gradient-to-br from-[#2E3A79] to-[#4656A4] text-white">
          <div className="vp-container py-5 sm:py-6">
            <div className="flex items-end justify-between gap-3">
              <div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FFB547]">Recompensas de agosto</p><h2 className="mt-0.5 text-2xl font-black">Productos destacados</h2><p className="mt-1 text-xs font-bold text-white/70">Descuentos especiales activados este mes.</p></div>
              <Star className="hidden fill-[#FFB547] text-[#FFB547] sm:block" size={30} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {featuredProducts.map((product) => {
                const finalPrice = product.discountPercent > 0 ? product.priceUsd * (1 - product.discountPercent / 100) : product.priceUsd;
                return <Link key={product.rewardId} href={`/${product.storeSlug}`} className="group grid min-h-32 grid-cols-[108px_1fr] overflow-hidden rounded-[20px] bg-white text-[#25262B] shadow-xl shadow-black/10 transition hover:-translate-y-0.5 sm:grid-cols-[126px_1fr]">
                  <div className="relative min-h-32 overflow-hidden"><OptimizedImage src={product.imageUrl} alt={product.productName} fill sizes="126px" className="bg-[#F8F3E8] object-cover transition duration-500 group-hover:scale-105" /><span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#FFB547] px-2 py-1 text-[10px] font-black"><Star size={10} className="fill-current" /> Destacado</span></div>
                  <div className="min-w-0 p-3"><p className="truncate text-[10px] font-black uppercase tracking-[0.1em] text-[#2E3A79]">{product.storeName}</p><h3 className="mt-0.5 truncate text-base font-black">{product.productName}</h3><p className="mt-1 line-clamp-1 text-xs font-bold text-[#746f69]">{product.description}</p><div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="text-lg font-black text-[#2E3A79]">${finalPrice.toFixed(2)}</span>{product.discountPercent > 0 ? <><span className="text-xs font-bold text-[#746f69] line-through">${product.priceUsd.toFixed(2)}</span><span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-black text-green-700">-{product.discountPercent}%</span></> : null}</div></div>
                </Link>;
              })}
            </div>
          </div>
        </section>
      ) : null}

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
              {storesEyebrow}
            </p>
            <h2 className="mt-1 text-3xl font-black">{storesTitle}</h2>
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
            <h3 className="mt-4 text-2xl font-black">{emptyTitle}</h3>
            <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
              {emptyText}
            </p>
          </div>
        )}
      </section>

      <footer className="bg-[#25262B] py-8 text-white">
        <div className="vp-container flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <BrandLogo compact />
            <p className="mt-3 text-sm font-bold text-white/65">
              {footerText}
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
