"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock3, LocateFixed, MapPin, Search, ShoppingBag, Sparkles, Store as StoreIcon, Truck, Zap } from "lucide-react";
import type { Store } from "@/types";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import type { MarketplaceFeaturedProduct } from "@/lib/monthly-challenges";
import type { MarketplaceDiscovery, MarketplaceProduct } from "@/lib/marketplace";
import { BUSINESS_TYPES, businessTypeLabel } from "@/lib/business-types";

const LOCATION_CACHE_KEY = "somos-marketplace-location-v1";
const LOCATION_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const INITIAL_SECTION_ITEMS = 6;
type LocationStatus = "idle" | "loading" | "ready" | "denied" | "unavailable" | "error";
type Coordinates = { latitude: number; longitude: number };

function labelForStore(store: Store) { return businessTypeLabel(store.category); }
function normalizeSearch(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }
function storeSearchText(store: Store) { return normalizeSearch([store.name, store.category, labelForStore(store), store.description, store.address].join(" ")); }
function validCoordinates(latitude: number, longitude: number) { return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 && !(latitude === 0 && longitude === 0); }
function distanceKm(origin: Coordinates, store: Store) {
  if (!validCoordinates(store.latitude, store.longitude)) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(store.latitude - origin.latitude);
  const longitudeDelta = radians(store.longitude - origin.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(origin.latitude)) * Math.cos(radians(store.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function formatDistance(value: number) { return value < 1 ? `${Math.max(1, Math.round(value * 1000))} m` : `${value.toFixed(value < 10 ? 1 : 0)} km`; }

function ProductCard({ product, badge }: { product: MarketplaceProduct; badge: string }) {
  const discount = Math.max(0, Math.min(95, Number(product.discountPercent || 0)));
  const finalPrice = discount > 0 ? product.priceUsd * (1 - discount / 100) : product.priceUsd;
  return <Link href={`/${product.storeSlug}`} className="group w-[55vw] max-w-[210px] shrink-0 snap-start overflow-hidden rounded-[18px] bg-white shadow-md shadow-[#143D42]/[0.07] ring-1 ring-[#143D42]/[0.07] transition hover:-translate-y-0.5 sm:w-[200px]">
    <div className="relative aspect-[16/11] overflow-hidden bg-[#F4F1EA]"><OptimizedImage src={product.imageUrl} alt={product.productName} fill sizes="210px" className="object-cover transition duration-500 group-hover:scale-105" /><span className="absolute left-2 top-2 rounded-full bg-[#143D42] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.06em] text-white">{badge}</span>{discount > 0 ? <span className="absolute right-2 top-2 rounded-full bg-[#FF7133] px-2 py-1 text-[10px] font-black text-white">-{discount}%</span> : null}</div>
    <div className="p-3"><p className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-[#0F6B63]">{product.storeName}</p><h3 className="mt-1 line-clamp-2 min-h-9 text-sm font-black leading-[18px] text-[#143D42]">{product.productName}</h3><div className="mt-2 flex flex-wrap items-baseline gap-1.5"><span className="text-lg font-black text-[#143D42]">${finalPrice.toFixed(2)}</span>{discount > 0 ? <span className="text-[10px] font-bold text-[#746f69] line-through">${product.priceUsd.toFixed(2)}</span> : null}</div>{product.unitsSold ? <p className="mt-1.5 text-[10px] font-bold text-[#746f69]">{product.unitsSold} vendidos esta semana</p> : null}</div>
  </Link>;
}

function ProductRail({ title, eyebrow, products, badge }: { title: string; eyebrow: string; products: MarketplaceProduct[]; badge: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!products.length) return null;
  const visible = expanded ? products : products.slice(0, INITIAL_SECTION_ITEMS);
  return <section className="vp-container py-5 sm:py-7"><div className="flex items-end justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#FF7133]">{eyebrow}</p><h2 className="mt-1 text-[22px] font-black leading-tight text-[#143D42] sm:text-2xl">{title}</h2></div>{products.length > INITIAL_SECTION_ITEMS ? <button type="button" onClick={() => setExpanded((value) => !value)} className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-black text-[#0F6B63] ring-1 ring-[#143D42]/10">{expanded ? "Ver menos" : "Ver todos"}</button> : null}</div><div className="vp-scrollbar-none mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2">{visible.map((product) => <ProductCard key={`${badge}-${product.productId}`} product={product} badge={badge} />)}</div></section>;
}

function StoreCard({ store, distance }: { store: Store; distance?: number | null }) {
  const canDeliver = store.deliverySettings?.deliveryEnabled !== false;
  const canPickup = store.deliverySettings?.pickupEnabled !== false;
  const isOpen = store.openState?.isOpen !== false;
  const outsideRange = distance != null && Number(store.deliverySettings?.maxDistanceKm || 0) > 0 && distance > Number(store.deliverySettings?.maxDistanceKm);
  const fixedDeliveryFee = store.deliverySettings?.pricingType === "fixed" ? Number(store.deliverySettings.fixedFeeUsd || 0) : null;
  const deliveryLabel = fixedDeliveryFee !== null
    ? fixedDeliveryFee > 0 ? `$${fixedDeliveryFee.toFixed(2)}` : "Gratis"
    : "Delivery";

  return <Link href={`/${store.slug}`} className="group min-w-0 overflow-hidden rounded-[18px] bg-white shadow-sm ring-1 ring-[#143D42]/[0.08] transition hover:-translate-y-0.5 sm:rounded-[22px]">
    <div className="relative aspect-[16/10] overflow-hidden bg-[#F4F1EA]">
      <OptimizedImage src={store.coverImageUrl || store.heroImageUrl || store.logoUrl} alt={store.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover transition duration-500 group-hover:scale-105" fallback={<div className="grid h-full place-items-center text-3xl font-black text-[#0F6B63]">{store.name.slice(0, 1)}</div>} />
      <span className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-black ${isOpen ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{isOpen ? "Abierto" : "Cerrado"}</span>
      {store.logoUrl ? <OptimizedImage src={store.logoUrl} alt={`Logo de ${store.name}`} width={48} height={48} sizes="48px" className="absolute bottom-2 left-2 h-11 w-11 rounded-xl bg-white object-cover p-0.5 shadow-md ring-1 ring-black/10 sm:h-12 sm:w-12" /> : null}
    </div>
    <div className="p-3 sm:p-4">
      <div className="flex items-start gap-1"><h3 className="line-clamp-2 min-h-10 flex-1 text-[15px] font-black leading-5 text-[#143D42] sm:text-lg">{store.name}</h3><ArrowRight size={15} className="mt-0.5 shrink-0 text-[#FF7133]" /></div>
      <p className="mt-1 truncate text-[11px] font-bold text-[#746f69]">{labelForStore(store)}</p>
      <div className="mt-2 space-y-1.5 text-[11px] font-bold text-[#55706E]">
        <p className="flex items-center gap-1"><Clock3 size={12} className="shrink-0" /><span className="truncate">{store.deliveryEstimate || store.openState?.label}</span>{distance != null ? <span className="ml-auto shrink-0 text-[#0F6B63]">{formatDistance(distance)}</span> : null}</p>
        <p className="flex items-center gap-1 truncate">{canDeliver ? <><Truck size={12} className="shrink-0" /><span>{deliveryLabel}</span></> : null}{canDeliver && canPickup ? <span>·</span> : null}{canPickup ? <><ShoppingBag size={12} className="shrink-0" /><span>Retiro</span></> : null}</p>
      </div>
      {outsideRange ? <p className="mt-2 truncate text-[10px] font-black text-[#8A5700]">Consulta cobertura</p> : null}
      {store.monthlyBadges?.some((badge) => normalizeSearch(badge) === "comercio rapido") ? <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-[#8A5700]"><Zap size={11} /> Comercio rapido</p> : null}
    </div>
  </Link>;
}

export function MarketplaceClient({ stores, featuredProducts = [], discovery = { offers: [], bestSellers: [], newProducts: [] }, eyebrow = "Marketplace", title = "Descubre que pedir hoy", description = "Comercios locales, productos reales y pedidos directos por WhatsApp.", storesEyebrow = "Todos los comercios", storesTitle = "Explora y elige", emptyTitle = "No encontramos comercios", emptyText = "Prueba con otra busqueda, rubro o zona.", footerText = "Marketplace de comercios afiliados.", partnerName, partnerLogoUrl, partnerBannerImageUrl, partnerLocation }: { stores: Store[]; featuredProducts?: MarketplaceFeaturedProduct[]; discovery?: MarketplaceDiscovery; eyebrow?: string; title?: string; description?: string; storesEyebrow?: string; storesTitle?: string; emptyTitle?: string; emptyText?: string; footerText?: string; partnerName?: string; partnerLogoUrl?: string | null; partnerBannerImageUrl?: string | null; partnerLocation?: string; }) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);

  useEffect(() => { try { const cached = JSON.parse(localStorage.getItem(LOCATION_CACHE_KEY) || "null"); if (cached && Date.now() - Number(cached.savedAt || 0) < LOCATION_CACHE_TTL_MS && validCoordinates(Number(cached.latitude), Number(cached.longitude))) { setCoordinates({ latitude: Number(cached.latitude), longitude: Number(cached.longitude) }); setLocationStatus("ready"); } } catch { localStorage.removeItem(LOCATION_CACHE_KEY); } }, []);
  const storesWithDistance = useMemo(() => stores.map((store) => ({ store, distance: coordinates ? distanceKm(coordinates, store) : null })), [coordinates, stores]);
  const filters = useMemo(() => ["Todos", ...BUSINESS_TYPES.map((type) => type.label), "Abiertos", "Delivery", "Retiro", "Ofertas"], []);
  const productSearchByStore = useMemo(() => {
    const values = [...discovery.offers, ...discovery.bestSellers, ...discovery.newProducts, ...featuredProducts.map((product) => ({ ...product, productName: product.productName }))];
    const map = new Map<string, string[]>();
    for (const product of values) map.set(product.storeId, [...(map.get(product.storeId) || []), normalizeSearch(`${product.productName} ${product.description}`)]);
    return map;
  }, [discovery, featuredProducts]);
  const offerStoreIds = useMemo(() => new Set(discovery.offers.map((product) => product.storeId)), [discovery.offers]);
  const filteredStores = useMemo(() => { const needle = normalizeSearch(query); const categoryFilter = !["Todos", "Abiertos", "Delivery", "Retiro", "Ofertas"].includes(activeFilter) ? normalizeSearch(activeFilter) : ""; return storesWithDistance.filter(({ store }) => { const text = storeSearchText(store); const productMatch = (productSearchByStore.get(store.id) || []).some((value) => value.includes(needle)); const specialMatch = activeFilter === "Abiertos" ? store.openState?.isOpen !== false : activeFilter === "Delivery" ? store.deliverySettings?.deliveryEnabled !== false : activeFilter === "Retiro" ? store.deliverySettings?.pickupEnabled !== false : activeFilter === "Ofertas" ? offerStoreIds.has(store.id) : true; return (!needle || text.includes(needle) || productMatch) && (!categoryFilter || text.includes(categoryFilter)) && specialMatch; }).sort((a, b) => coordinates ? Number(a.distance ?? Number.MAX_VALUE) - Number(b.distance ?? Number.MAX_VALUE) : a.store.name.localeCompare(b.store.name)); }, [activeFilter, coordinates, offerStoreIds, productSearchByStore, query, storesWithDistance]);
  const filteredStoreIds = useMemo(() => new Set(filteredStores.map(({ store }) => store.id)), [filteredStores]);
  const filterProducts = useCallback((products: MarketplaceProduct[]) => {
    const needle = normalizeSearch(query);
    return products.filter((product) => filteredStoreIds.has(product.storeId) && (!needle || normalizeSearch(`${product.productName} ${product.description} ${product.storeName}`).includes(needle)));
  }, [filteredStoreIds, query]);
  const filteredOffers = useMemo(() => filterProducts(discovery.offers), [discovery.offers, filterProducts]);
  const filteredBestSellers = useMemo(() => activeFilter === "Ofertas" ? [] : filterProducts(discovery.bestSellers), [activeFilter, discovery.bestSellers, filterProducts]);
  const filteredNewProducts = useMemo(() => activeFilter === "Ofertas" ? [] : filterProducts(discovery.newProducts), [activeFilter, discovery.newProducts, filterProducts]);
  const filteredFeaturedProducts = useMemo(() => { const needle = normalizeSearch(query); return activeFilter === "Ofertas" ? [] : featuredProducts.filter((product) => filteredStoreIds.has(product.storeId) && (!needle || normalizeSearch(`${product.productName} ${product.description} ${product.storeName}`).includes(needle))); }, [activeFilter, featuredProducts, filteredStoreIds, query]);
  const nearbyStores = useMemo(() => filteredStores.filter((entry) => entry.distance !== null).sort((a, b) => Number(a.distance) - Number(b.distance)).slice(0, 6), [filteredStores]);
  function requestLocation() { if (!navigator.geolocation) { setLocationStatus("unavailable"); return; } setLocationStatus("loading"); navigator.geolocation.getCurrentPosition((position) => { const next = { latitude: position.coords.latitude, longitude: position.coords.longitude }; setCoordinates(next); setLocationStatus("ready"); try { localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ ...next, savedAt: Date.now() })); } catch {} }, (error) => setLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : error.code === error.POSITION_UNAVAILABLE ? "unavailable" : "error"), { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }); }
  const locationMessages: Partial<Record<LocationStatus, string>> = { denied: "No autorizaste la ubicacion. Puedes seguir explorando todos los comercios.", unavailable: "No pudimos obtener tu ubicacion. Revisa que el GPS este activo e intenta de nuevo.", error: "La ubicacion tardo demasiado. Intenta nuevamente." };

  return <main className="min-h-screen bg-[#F7F5F0] text-[#143D42]">
    <PublicHeader primaryHref="/registro" primaryLabel="Registrar comercio" />
    <section className="overflow-hidden bg-[#143D42] text-white"><div className="vp-container relative py-6 sm:py-10"><div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#FF7133]/25 blur-3xl" />{partnerName && partnerBannerImageUrl ? <div className="relative mb-5 h-36 overflow-hidden rounded-[22px] sm:h-52"><OptimizedImage src={partnerBannerImageUrl} alt={`Banner de ${partnerName}`} fill sizes="1080px" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#143D42]/80 to-transparent" /></div> : null}<div className="relative max-w-3xl"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FFB07C]">{eyebrow}</p><h1 className="mt-2 text-3xl font-black leading-[1.02] sm:text-5xl">{title}</h1><p className="mt-2 max-w-xl text-sm font-semibold leading-relaxed text-white/75 sm:text-base">{description}</p></div>{partnerName ? <div className="relative mt-4 flex max-w-md items-center gap-3 rounded-2xl bg-white/10 p-3"><OptimizedImage src={partnerLogoUrl || ""} alt={partnerName} width={48} height={48} className="h-12 w-12 rounded-xl bg-white object-cover" /><div><p className="font-black">{partnerName}</p>{partnerLocation ? <p className="text-xs font-bold text-white/65">{partnerLocation}</p> : null}</div></div> : null}</div></section>
    <section className="border-b border-[#143D42]/[0.07] bg-white"><div className="vp-container py-4"><div className="flex items-center gap-3 rounded-[18px] bg-[#EAF5F1] p-3"><MapPin size={19} className="shrink-0 text-[#0F6B63]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{locationStatus === "ready" ? "Tiendas ordenadas por cercania" : "Elige tu ubicacion"}</p><p className="truncate text-[11px] font-bold text-[#55706E]">{locationStatus === "ready" ? "Guardada por 2 horas solo en este dispositivo" : "Para mostrarte comercios cercanos"}</p></div><button type="button" aria-label="Usar mi ubicacion" onClick={requestLocation} disabled={locationStatus === "loading"} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FF7133] text-white disabled:opacity-60"><LocateFixed size={18} className={locationStatus === "loading" ? "animate-pulse" : ""} /></button></div>{locationMessages[locationStatus] ? <p role="status" className="mt-2 rounded-xl bg-[#FFF0E8] px-3 py-2 text-xs font-bold text-[#8A451E]">{locationMessages[locationStatus]}</p> : null}<div className="mt-3 flex gap-2"><label className="relative min-w-0 flex-1"><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#746f69]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="¿Que quieres pedir hoy?" className="h-12 w-full rounded-[16px] border border-[#143D42]/10 bg-[#F7F5F0] pl-10 pr-3 text-sm font-bold outline-none focus:border-[#0F6B63]" /></label></div><div className="vp-scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">{filters.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-black transition ${activeFilter === filter ? "bg-[#143D42] text-white" : "bg-[#F4F1EA] text-[#55706E]"}`}>{filter}</button>)}</div></div></section>
    {locationStatus === "loading" ? <section className="vp-container py-8"><div className="h-7 w-44 animate-pulse rounded-lg bg-[#DDE7E3]" /><div className="mt-4 flex gap-3 overflow-hidden">{[1, 2, 3].map((item) => <div key={item} className="h-64 w-[78vw] max-w-sm shrink-0 animate-pulse rounded-[26px] bg-white" />)}</div></section> : null}
    {locationStatus === "ready" && nearbyStores.length ? <section className="vp-container py-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#FF7133]">Segun tu ubicacion</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">Cerca de ti</h2><div className="vp-scrollbar-none mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3">{nearbyStores.map(({ store, distance }) => <div key={store.id} className="w-[46vw] min-w-[164px] max-w-[230px] shrink-0 snap-start"><StoreCard store={store} distance={distance} /></div>)}</div></section> : null}
    {locationStatus === "ready" && !nearbyStores.length ? <section className="vp-container py-6"><div className="rounded-[24px] bg-white p-5 text-center font-bold text-[#746f69]">No hay tiendas con GPS configurado cerca de ti. Puedes explorar todos los comercios abajo.</div></section> : null}
    {filteredFeaturedProducts.length ? <section className="bg-[#FFF0E8]"><div className="vp-container py-7"><div className="flex items-center gap-3"><Sparkles className="text-[#FF7133]" /><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#C44D1B]">Beneficios activos</p><h2 className="text-2xl font-black">Destacados Somos</h2></div></div><div className="vp-scrollbar-none mt-4 flex snap-x gap-3 overflow-x-auto pb-2">{filteredFeaturedProducts.map((product) => <ProductCard key={product.rewardId} badge="Destacado" product={{ productId: product.productId, storeId: product.storeId, storeName: product.storeName, storeSlug: product.storeSlug, productName: product.productName, description: product.description, imageUrl: product.imageUrl, priceUsd: product.priceUsd, discountPercent: product.discountPercent, createdAt: "" }} />)}</div></div></section> : null}
    <ProductRail title="Ofertas que valen la pena" eyebrow="Precios especiales" products={filteredOffers} badge="Oferta" />
    <ProductRail title="Los favoritos de la semana" eyebrow="Un ganador por tienda · minimo 10 ventas" products={filteredBestSellers} badge="Mas vendido" />
    <ProductRail title="Recien llegados" eyebrow="Productos nuevos" products={filteredNewProducts} badge="Nuevo" />
    <section id="todos-los-comercios" className="vp-container py-7"><div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0F6B63]">{storesEyebrow}</p><h2 className="mt-0.5 text-2xl font-black">{storesTitle}</h2></div><p className="pb-0.5 text-xs font-black text-[#746f69]">{filteredStores.length} resultado{filteredStores.length === 1 ? "" : "s"}</p></div>{filteredStores.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{filteredStores.map(({ store, distance }) => <StoreCard key={store.id} store={store} distance={distance} />)}</div> : <div className="mt-5 rounded-[22px] bg-white p-6 text-center shadow-sm ring-1 ring-[#143D42]/[0.07]"><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#FF7133] text-white"><StoreIcon size={22} /></div><h3 className="mt-3 text-xl font-black">{emptyTitle}</h3><p className="mt-2 text-sm font-bold text-[#746f69]">{emptyText}</p><button type="button" onClick={() => { setQuery(""); setActiveFilter("Todos"); }} className="mt-4 rounded-full bg-[#143D42] px-5 py-3 text-sm font-black text-white">Limpiar filtros</button></div>}</section>
    <PublicFooter text={footerText} />
  </main>;
}
