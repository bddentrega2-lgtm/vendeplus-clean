"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { StoreRating } from "@/components/buyer/StoreRating";
import { Map as MapIcon, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNativeApp, useNativeBackLayer, useNativeTextState } from "@/hooks/use-native-app";
import { readMobile, writeMobile } from "@/lib/mobile/state";
import { inferMarketplaceCity, type NativeCityPreference } from "@/lib/mobile/marketplace-city";
import type { CSSProperties } from "react";
import { ArrowRight, CakeSlice, ChevronDown, Clock3, Compass, Home, MapPin, MoreHorizontal, Motorbike, Navigation, Percent, Search, Shirt, ShoppingBag, Smartphone, Sparkles, Store as StoreIcon, Utensils, X, Zap } from "lucide-react";
import type { Store } from "@/types";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";
import { BrandLogo } from "@/components/public/BrandLogo";
import { MarketplaceCityPicker } from "@/components/public/MarketplaceCityPicker";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import { PwaInstallButton } from "@/components/pwa/PwaInstallButton";
import type { MarketplaceFeaturedProduct } from "@/lib/monthly-challenges";
import type { MarketplaceDiscovery, MarketplaceProduct } from "@/lib/marketplace";
import { BUSINESS_TYPES, businessTypeLabel } from "@/lib/business-types";
import { DEFAULT_STORE_COVER_IMAGE } from "@/lib/brand-copy";

const MarketplaceMap = dynamic(() => import("./MarketplaceMap").then(module => module.MarketplaceMap), { ssr: false, loading: () => <p role="status">Cargando mapa...</p> });
const PREFERENCES_CACHE_KEY = "somos-marketplace-preferences-v1";
const LOCATION_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const INITIAL_SECTION_ITEMS = 6;
type LocationStatus = "idle" | "loading" | "ready" | "denied" | "unavailable" | "error" | "uncertain";
type Coordinates = { latitude: number; longitude: number };
type MarketplaceView = "home" | "nearby" | "offers" | "stores";

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
function CategoryIcon({ label, size = 19 }: { label: string; size?: number }) {
  if (label === "Comida") return <Utensils size={size} />;
  if (label === "Postres") return <CakeSlice size={size} />;
  if (label === "Ropa") return <Shirt size={size} />;
  if (label === "Tecnología") return <Smartphone size={size} />;
  if (label === "Otros") return <MoreHorizontal size={size} />;
  return <StoreIcon size={size} />;
}

function fairStoreOrder<T extends { storeId: string }>(items: T[], maxPerStore: number) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.storeId) || [];
    if (group.length < maxPerStore) group.push(item);
    groups.set(item.storeId, group);
  }
  const ordered: T[] = [];
  for (let position = 0; position < maxPerStore; position += 1) {
    for (const group of groups.values()) if (group[position]) ordered.push(group[position]);
  }
  return ordered;
}

function takeFairProducts<T extends { productId: string; storeId: string }>(items: T[], usedProducts: Set<string>, storeAppearances: Map<string, number>, maxPerStore: number) {
  const selected: T[] = [];
  for (const item of fairStoreOrder(items, maxPerStore)) {
    if (usedProducts.has(item.productId) || Number(storeAppearances.get(item.storeId) || 0) >= 2) continue;
    usedProducts.add(item.productId);
    storeAppearances.set(item.storeId, Number(storeAppearances.get(item.storeId) || 0) + 1);
    selected.push(item);
  }
  return selected;
}

function ProductCard({ product, badge }: { product: MarketplaceProduct; badge: string }) {
  const discount = Math.max(0, Math.min(95, Number(product.discountPercent || 0)));
  const finalPrice = discount > 0 ? product.priceUsd * (1 - discount / 100) : product.priceUsd;
  const badgeTone = badge === "Oferta" ? "bg-[#FF7133]" : badge === "Nuevo" ? "bg-[#BDEDDD] text-[#0F6B63]" : "bg-[#0F6B63]";
  return <Link href={`/${product.storeSlug}`} className="market-product-card group w-[55vw] max-w-[210px] shrink-0 snap-start overflow-hidden rounded-[18px] bg-white shadow-md shadow-[#143D42]/[0.07] ring-1 ring-[#143D42]/[0.07] transition duration-200 hover:-translate-y-0.5 active:scale-[0.98] sm:w-[200px]">
    <div className="relative aspect-[16/11] overflow-hidden bg-[#F4F1EA]"><OptimizedImage src={product.imageUrl} alt={product.productName} fill sizes="210px" className="object-cover transition duration-500 group-hover:scale-105" /><span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.06em] text-white ${badgeTone}`}>{badge}</span>{discount > 0 ? <span className="absolute right-2 top-2 rounded-full bg-[#FF7133] px-2 py-1 text-[10px] font-black text-white">-{discount}%</span> : null}</div>
    <div className="p-3"><p className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-[#0F6B63]">{product.storeName}</p><h3 className="mt-1 line-clamp-2 min-h-9 text-sm font-black leading-[18px] text-[#143D42]">{product.productName}</h3><div className="mt-2 flex flex-wrap items-baseline gap-1.5"><span className="text-lg font-black text-[#143D42]">${finalPrice.toFixed(2)}</span>{discount > 0 ? <span className="text-[10px] font-bold text-[#746f69] line-through">${product.priceUsd.toFixed(2)}</span> : null}</div></div>
  </Link>;
}

function ProductRail({ title, eyebrow, products, badge }: { title: string; eyebrow?: string; products: MarketplaceProduct[]; badge: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!products.length) return null;
  const visible = expanded ? products : products.slice(0, INITIAL_SECTION_ITEMS);
  const eyebrowTone = badge === "Oferta" ? "text-[#C44D1B]" : badge === "Mas vendido" ? "text-[#946300]" : "text-[#0F6B63]";
  return <section className="bg-white py-6"><div className="vp-container"><div className="flex items-end justify-between gap-4"><div>{eyebrow ? <p className={`text-[10px] font-black uppercase tracking-[0.15em] ${eyebrowTone}`}>{eyebrow}</p> : null}<div className="mt-1 flex items-center gap-3"><span className="h-8 w-1.5 rounded-full bg-[#FF7133]" aria-hidden="true" /><h2 className="text-xl font-black leading-tight text-[#143D42] sm:text-2xl">{title}</h2></div></div>{products.length > INITIAL_SECTION_ITEMS ? <button type="button" onClick={() => setExpanded((value) => !value)} className="shrink-0 rounded-full bg-[#E8F6F1] px-4 py-2 text-xs font-black text-[#0F6B63] ring-1 ring-[#0F6B63]/10">{expanded ? "Ver menos" : "Ver todos"}</button> : null}</div><div className="vp-scrollbar-none mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">{visible.map((product) => <ProductCard key={`${badge}-${product.productId}`} product={product} badge={badge} />)}</div></div></section>;
}

function StoreCard({ store, distance, badge }: { store: Store; distance?: number | null; badge?: string }) {
  const coverImage = store.coverImageUrl || store.heroImageUrl || store.logoUrl || DEFAULT_STORE_COVER_IMAGE;
  const usesSomosCover = coverImage === DEFAULT_STORE_COVER_IMAGE;
  const canDeliver = store.deliverySettings?.deliveryEnabled !== false;
  const canPickup = store.deliverySettings?.pickupEnabled !== false;
  const isOpen = store.openState?.isOpen !== false;
  const outsideRange = distance != null && Number(store.deliverySettings?.maxDistanceKm || 0) > 0 && distance > Number(store.deliverySettings?.maxDistanceKm);
  const fixedDeliveryFee = store.deliverySettings?.pricingType === "fixed" ? Number(store.deliverySettings.fixedFeeUsd || 0) : null;
  const deliveryLabel = fixedDeliveryFee !== null
    ? fixedDeliveryFee > 0 ? `$${fixedDeliveryFee.toFixed(2)}` : "Gratis"
    : "Delivery";

  return <Link href={`/${store.slug}`} className="group min-w-0 overflow-hidden rounded-[18px] bg-white shadow-sm ring-1 ring-[#143D42]/[0.08] transition duration-200 hover:-translate-y-0.5 active:scale-[0.98] sm:rounded-[22px]">
    <div className="relative aspect-[16/10] overflow-hidden bg-[#F4F1EA]">
      <OptimizedImage src={coverImage} alt={store.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className={`${usesSomosCover ? "object-contain p-5" : "object-cover group-hover:scale-105"} transition duration-500`} fallback={<div className="grid h-full place-items-center text-3xl font-black text-[#0F6B63]">{store.name.slice(0, 1)}</div>} />
      {badge ? <span className="absolute left-2 top-2 rounded-full bg-[#BDEDDD] px-2.5 py-1 text-[9px] font-black uppercase text-[#0F6B63] shadow-sm">{badge}</span> : null}
      <span className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-black ${isOpen ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{isOpen ? "Abierto" : "Cerrado"}</span>
      {store.logoUrl ? <OptimizedImage src={store.logoUrl} alt={`Logo de ${store.name}`} width={48} height={48} sizes="48px" className="absolute bottom-2 left-2 h-11 w-11 rounded-xl bg-white object-cover p-0.5 shadow-md ring-1 ring-black/10 sm:h-12 sm:w-12" /> : null}
    </div>
    <div className="p-3 sm:p-4">
      <div className="flex items-start gap-1"><h3 className="line-clamp-2 min-h-10 flex-1 text-[15px] font-black leading-5 text-[#143D42] sm:text-lg">{store.name}</h3><ArrowRight size={15} className="mt-0.5 shrink-0 text-[#FF7133]" /></div>
      <p className="mt-1 truncate text-[11px] font-bold text-[#746f69]">{labelForStore(store)}</p>
      <StoreRating summary={store.ratingSummary || null} />
      <div className="mt-2 space-y-1.5 text-[11px] font-bold text-[#55706E]">
        <p className="flex items-center gap-1"><Clock3 size={12} className="shrink-0" /><span className="truncate">{store.deliveryEstimate || store.openState?.label}</span>{distance != null ? <span className="ml-auto shrink-0 text-[#0F6B63]">{formatDistance(distance)}</span> : null}</p>
        <p className="flex items-center gap-1 truncate">{canDeliver ? <><Motorbike size={12} className="shrink-0" /><span>{deliveryLabel}</span></> : null}{canDeliver && canPickup ? <span>·</span> : null}{canPickup ? <><ShoppingBag size={12} className="shrink-0" /><span>Retiro</span></> : null}</p>
      </div>
      {outsideRange ? <p className="mt-2 truncate text-[10px] font-black text-[#8A5700]">Consulta cobertura</p> : null}
      {store.monthlyBadges?.some((badge) => normalizeSearch(badge) === "comercio rapido") ? <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-[#8A5700]"><Zap size={11} /> Comercio rapido</p> : null}
    </div>
  </Link>;
}

function StoreRail({ stores }: { stores: Array<{ store: Store; distance: number | null }> }) {
  if (!stores.length) return null;
  return <section className="border-y border-[#0F6B63]/10 bg-[#E8F6F1] py-6"><div className="vp-container"><p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#0F6B63]">Nuevos en Somos</p><div className="mt-1 flex items-center gap-3"><span className="h-8 w-1.5 rounded-full bg-[#FF7133]" aria-hidden="true" /><div><h2 className="text-xl font-black leading-tight text-[#143D42] sm:text-2xl">Comercios recién llegados</h2><p className="mt-0.5 text-xs font-semibold text-[#55706E]">Descubre nuevas opciones cerca de ti</p></div></div><div className="vp-scrollbar-none mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">{stores.map(({ store, distance }) => { const coverImage = store.coverImageUrl || store.heroImageUrl || store.logoUrl || DEFAULT_STORE_COVER_IMAGE; return <Link href={`/${store.slug}`} key={store.id} className="group w-[76vw] max-w-[310px] shrink-0 snap-start overflow-hidden rounded-[20px] bg-white shadow-md shadow-[#143D42]/10 ring-1 ring-[#0F6B63]/10 transition duration-200 active:scale-[0.98]"><div className="relative aspect-[16/9] overflow-hidden bg-white"><OptimizedImage src={coverImage} alt={store.name} fill sizes="310px" className="object-cover transition duration-500 group-hover:scale-105" /><span className="absolute left-3 top-3 rounded-full bg-[#BDEDDD] px-3 py-1.5 text-[10px] font-black uppercase text-[#0F6B63] shadow-sm">Nuevo</span>{store.logoUrl ? <OptimizedImage src={store.logoUrl} alt={`Logo de ${store.name}`} width={52} height={52} className="absolute bottom-3 left-3 h-12 w-12 rounded-xl bg-white object-cover p-0.5 shadow-md" /> : null}</div><div className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><h3 className="truncate text-base font-black text-[#143D42]">{store.name}</h3><p className="mt-1 flex items-center gap-2 text-[11px] font-bold text-[#55706E]"><span>{labelForStore(store)}</span>{distance != null ? <><span>·</span><span>{formatDistance(distance)}</span></> : null}</p></div><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FF7133] text-white"><ArrowRight size={17} /></span></div></Link>; })}</div></div></section>;
}

function StoreGrid({ stores, emptyTitle, emptyText, onReset }: { stores: Array<{ store: Store; distance: number | null }>; emptyTitle: string; emptyText: string; onReset: () => void }) {
  if (stores.length) return <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{stores.map(({ store, distance }) => <StoreCard key={store.id} store={store} distance={distance} />)}</div>;
  return <div className="mt-5 rounded-[22px] bg-[#F6F8F7] p-6 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#FF7133] text-white"><StoreIcon size={22} /></div><h3 className="mt-3 text-xl font-black">{emptyTitle}</h3><p className="mt-2 text-sm font-bold text-[#746f69]">{emptyText}</p><button type="button" onClick={onReset} className="mt-4 rounded-full bg-[#143D42] px-5 py-3 text-sm font-black text-white">Limpiar filtros</button></div>;
}

export function MarketplaceClient({ stores, featuredProducts = [], discovery = { offers: [], bestSellers: [], newProducts: [], newStoreIds: [] }, eyebrow = "Marketplace", title = "Descubre que pedir hoy", description = "Las mejores opciones en un solo lugar.", storesEyebrow = "Todos los comercios", storesTitle = "Explora y elige", emptyTitle = "No encontramos comercios", emptyText = "Prueba con otra busqueda, rubro o zona.", footerText = "Marketplace de comercios afiliados.", partnerName, partnerLogoUrl, partnerBannerImageUrl, partnerLocation, partnerPrimaryColor, partnerAccentColor }: { stores: Store[]; featuredProducts?: MarketplaceFeaturedProduct[]; discovery?: MarketplaceDiscovery; eyebrow?: string; title?: string; description?: string; storesEyebrow?: string; storesTitle?: string; emptyTitle?: string; emptyText?: string; footerText?: string; partnerName?: string; partnerLogoUrl?: string | null; partnerBannerImageUrl?: string | null; partnerLocation?: string; partnerPrimaryColor?: string; partnerAccentColor?: string; }) {
  const [query, setQuery] = useNativeTextState(`market_${partnerName || "somos"}_query`, "");
  const [activeFilter, setActiveFilter] = useNativeTextState(`market_${partnerName || "somos"}_filter`, "Todos");
  const [activeCity, setActiveCity] = useState("Todas");
  const [activeView, setActiveView] = useState<MarketplaceView>("home");
  useEffect(() => { window.dispatchEvent(new CustomEvent("somos:market-view", { detail: activeView })); }, [activeView]);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [cityConfirmed, setCityConfirmed] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const native = useNativeApp();
  const [ratings, setRatings] = useState<Record<string, { average: number; count: number }>>({});
  const [mapOpen, setMapOpen] = useState(false);
  const mapTrigger = useRef<HTMLButtonElement>(null);
  const closeMap = useCallback(() => { setMapOpen(false); mapTrigger.current?.focus(); }, []);
  useNativeBackLayer(mapOpen, closeMap);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/marketplace/directory", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("directory");
      const data = await response.json();
      setRatings(data.ratings || {});
    }).catch(() => { /* Ratings remain hidden when unavailable. */ });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!mapOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMap();
      if (event.key === "Tab") {
        const controls = [...document.querySelectorAll<HTMLElement>('.market-map-dialog button, .market-map-dialog select, .market-map-dialog a, .market-map-dialog [tabindex="0"]')].filter(element => element.getClientRects().length && !element.hasAttribute("disabled"));
        const target = event.shiftKey ? controls.at(-1) : controls[0];
        const edge = event.shiftKey ? controls[0] : controls.at(-1);
        if (document.activeElement === edge) { event.preventDefault(); target?.focus(); }
      }
    };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", escape); };
  }, [mapOpen, closeMap]);
  const locationRequest = useRef(0);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [compactHeaderVisible, setCompactHeaderVisible] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  useEffect(() => {
    if (!preferencesReady) return;
    const navigate = () => {
      const hash = window.location.hash;
      if (hash === "#promociones" || hash === "#inicio") {
        const view = hash === "#promociones" ? "offers" : "home";
        setActiveView(view);
        setActiveFilter(view === "offers" ? "Ofertas" : "Todos");
        window.scrollTo({ top: 0 });
      }
    };
    navigate();
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, [preferencesReady, setActiveFilter]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useNativeBackLayer(cityPickerOpen && cityConfirmed, () => setCityPickerOpen(false));
  useEffect(() => {
    if (!cityConfirmed) return;
    const search = () => { window.scrollTo({ top: 0 }); searchInputRef.current?.focus(); };
    if (window.location.hash === "#buscar") search();
    window.addEventListener("somos:search", search);
    return () => window.removeEventListener("somos:search", search);
  }, [cityConfirmed]);
  const storesWithDistance = useMemo(() => stores.map((store) => ({ store: { ...store, ratingSummary: ratings[store.id] }, distance: coordinates ? distanceKm(coordinates, store) : null })), [coordinates, stores, ratings]);
  const categoryFilters = useMemo(() => ["Todos", ...BUSINESS_TYPES.map((type) => type.label)], []);
  const storeFilters = useMemo(() => ["Todos", "Abiertos", "Delivery", "Retiro", "Ofertas"], []);
  const cities = useMemo(() => Array.from(new Map(stores.filter((store) => store.citySlug && store.cityName).map((store) => [store.citySlug!, store.cityName!])).entries()), [stores]);
  const locationCitySlug = activeCity === "Todas" ? null : activeCity;
  const locationCityName = locationCitySlug ? cities.find(([slug]) => slug === locationCitySlug)?.[1] : null;
  useEffect(() => {
    setCityConfirmed(false);
    setActiveCity("Todas");
    try {
      const cached = JSON.parse(localStorage.getItem(PREFERENCES_CACHE_KEY) || "null");
      const availableCities = new Set(cities.map(([slug]) => slug));
      if (cached && ["home", "nearby", "offers", "stores"].includes(cached.view)) {
        setActiveView(cached.view);
        if (cached.view === "offers") setActiveFilter("Ofertas");
      }
      const saved = readMobile<NativeCityPreference | null>("market_city", null);
      if (availableCities.has(cached?.city) || (cached?.city === "Todas" && cached?.cityConfirmed === true)) {
        setActiveCity(cached.city); setCityConfirmed(true);
      } else if (saved && availableCities.has(saved.city || "") && (saved.mode === "manual" || (saved.mode === "auto" && Date.now() - saved.updatedAt >= 0 && Date.now() - saved.updatedAt < LOCATION_CACHE_TTL_MS))) {
        setActiveCity(saved.city!); setCityConfirmed(true);
      }
    } catch { /* A blocked or malformed preference must not prevent manual choice. */ }
    setPreferencesReady(true);
  }, [cities, setActiveFilter]);
  useEffect(() => {
    if (!preferencesReady || !cityConfirmed) return;
    try { localStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify({ city: activeCity, view: activeView, cityConfirmed: true })); } catch {}
  }, [activeCity, activeView, preferencesReady, cityConfirmed]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setCompactHeaderVisible(window.scrollY > 190);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  const selectedCityName = locationStatus === "loading" ? "Buscando tu ciudad..." : activeCity === "Todas" ? "Todas las ciudades" : cities.find(([slug]) => slug === activeCity)?.[1] || "Elige tu ciudad";
  const productSearchByStore = useMemo(() => {
    const values = [...discovery.offers, ...discovery.bestSellers, ...discovery.newProducts, ...featuredProducts.map((product) => ({ ...product, productName: product.productName }))];
    const map = new Map<string, string[]>();
    for (const product of values) map.set(product.storeId, [...(map.get(product.storeId) || []), normalizeSearch(`${product.productName} ${product.description}`)]);
    return map;
  }, [discovery, featuredProducts]);
  const offerStoreIds = useMemo(() => new Set(discovery.offers.map((product) => product.storeId)), [discovery.offers]);
  const filteredStores = useMemo(() => { const needle = normalizeSearch(query); const categoryFilter = !["Todos", "Abiertos", "Delivery", "Retiro", "Ofertas"].includes(activeFilter) ? normalizeSearch(activeFilter) : ""; const effectiveCity = activeView === "nearby" && locationCitySlug ? locationCitySlug : activeCity; return storesWithDistance.filter(({ store }) => { const text = storeSearchText(store); const productMatch = (productSearchByStore.get(store.id) || []).some((value) => value.includes(needle)); const specialMatch = activeFilter === "Abiertos" ? store.openState?.isOpen !== false : activeFilter === "Delivery" ? store.deliverySettings?.deliveryEnabled !== false : activeFilter === "Retiro" ? store.deliverySettings?.pickupEnabled !== false : activeFilter === "Ofertas" ? offerStoreIds.has(store.id) : true; const cityMatch = effectiveCity === "Todas" || store.citySlug === effectiveCity; return cityMatch && (!needle || text.includes(needle) || productMatch) && (!categoryFilter || text.includes(categoryFilter)) && specialMatch; }).sort((a, b) => coordinates ? Number(a.distance ?? Number.MAX_VALUE) - Number(b.distance ?? Number.MAX_VALUE) : a.store.name.localeCompare(b.store.name)); }, [activeCity, activeFilter, activeView, coordinates, locationCitySlug, offerStoreIds, productSearchByStore, query, storesWithDistance]);
  const filteredStoreIds = useMemo(() => new Set(filteredStores.map(({ store }) => store.id)), [filteredStores]);
  const mapStores = useMemo(() => filteredStores.map(({ store }) => store), [filteredStores]);
  const filterProducts = useCallback((products: MarketplaceProduct[]) => {
    const needle = normalizeSearch(query);
    return products.filter((product) => filteredStoreIds.has(product.storeId) && (!needle || normalizeSearch(`${product.productName} ${product.description} ${product.storeName}`).includes(needle)));
  }, [filteredStoreIds, query]);
  const filteredOffers = useMemo(() => filterProducts(discovery.offers).filter(product => product.discountPercent > 0), [discovery.offers, filterProducts]);
  const filteredBestSellers = useMemo(() => activeFilter === "Ofertas" ? [] : filterProducts(discovery.bestSellers), [activeFilter, discovery.bestSellers, filterProducts]);
  const filteredFeaturedProducts = useMemo(() => { const needle = normalizeSearch(query); return activeFilter === "Ofertas" ? [] : featuredProducts.filter((product) => filteredStoreIds.has(product.storeId) && (!needle || normalizeSearch(`${product.productName} ${product.description} ${product.storeName}`).includes(needle))); }, [activeFilter, featuredProducts, filteredStoreIds, query]);
  const curatedSections = useMemo(() => {
    const usedProducts = new Set<string>();
    const storeAppearances = new Map<string, number>();
    const featured = takeFairProducts(filteredFeaturedProducts, usedProducts, storeAppearances, 1);
    const offers = takeFairProducts(filteredOffers, usedProducts, storeAppearances, 2);
    const bestSellers = takeFairProducts(filteredBestSellers, usedProducts, storeAppearances, 1);
    const storesById = new Map(filteredStores.map((entry) => [entry.store.id, entry]));
    const newStores = activeFilter === "Ofertas" ? [] : discovery.newStoreIds.flatMap((storeId) => {
      const entry = storesById.get(storeId);
      if (!entry || Number(storeAppearances.get(storeId) || 0) >= 2) return [];
      storeAppearances.set(storeId, Number(storeAppearances.get(storeId) || 0) + 1);
      return [entry];
    });
    return { featured, offers, bestSellers, newStores };
  }, [activeFilter, discovery.newStoreIds, filteredBestSellers, filteredFeaturedProducts, filteredOffers, filteredStores]);
  const nearbyStores = useMemo(() => filteredStores.filter((entry) => entry.distance !== null).sort((a, b) => Number(a.distance) - Number(b.distance)), [filteredStores]);
  function persistPreferences(city: string, view: MarketplaceView, confirmed = cityConfirmed) { try { localStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify({ city, view, cityConfirmed: confirmed })); } catch {} }
  const locate = useCallback(() => {
    const request = ++locationRequest.current;
    setCityPickerOpen(true);
    const fail = (status: LocationStatus) => {
      if (!mounted.current || request !== locationRequest.current) return;
      setLocationStatus(status);
      setCityPickerOpen(true);
    };
    if (!navigator.geolocation) { fail("unavailable"); return; }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition((position) => {
      if (!mounted.current || request !== locationRequest.current) return;
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (!validCoordinates(next.latitude, next.longitude)) { fail("unavailable"); return; }
      const city = inferMarketplaceCity(stores.map((store) => ({ slug: store.citySlug, distance: distanceKm(next, store) })), position.coords.accuracy);
      if (!city) { fail("uncertain"); return; }
      setCoordinates(next);
      setActiveCity(city);
      setCityConfirmed(true);
      setActiveView("home");
      setQuery("");
      setActiveFilter("Todos");
      writeMobile("market_city", { mode: "auto", city, updatedAt: Date.now() });
      try { localStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify({ city, view: "home", cityConfirmed: true })); } catch {}
      setCityPickerOpen(false);
      setLocationStatus("ready");
    }, (error) => fail(error.code === error.PERMISSION_DENIED ? "denied" : error.code === error.POSITION_UNAVAILABLE ? "unavailable" : "error"), { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 });
  }, [stores, setActiveFilter, setQuery]);
  function requestLocation() { locate(); }
  function selectView(view: MarketplaceView) { setActiveView(view); persistPreferences(activeCity, view); if (view === "offers") setActiveFilter("Ofertas"); else if (activeFilter === "Ofertas") setActiveFilter("Todos"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function selectCity(city: string) {
    locationRequest.current += 1;
    setActiveCity(city);
    setCityConfirmed(true);
    setQuery("");
    setActiveFilter("Todos");
    writeMobile("market_city", { mode: "manual", city, updatedAt: Date.now() });
    if (activeView === "nearby") setActiveView("home");
    setCoordinates(null);
    setLocationStatus("idle");
    persistPreferences(city, activeView === "nearby" ? "home" : activeView, true);
    setCityPickerOpen(false);
  }
  function focusSearch() { window.scrollTo({ top: 0, behavior: "smooth" }); window.setTimeout(() => searchInputRef.current?.focus(), 350); }
  const locationMessages: Partial<Record<LocationStatus, string>> = { denied: "No autorizaste la ubicacion. Elige tu ciudad para continuar.", unavailable: "No pudimos obtener tu ubicacion. Puedes elegir tu ciudad.", error: "La ubicacion tardo demasiado. Puedes elegir tu ciudad.", uncertain: "No pudimos identificar tu ciudad con seguridad. Elige tu ciudad." };
  const cityRequired = cities.length > 0 && (!preferencesReady || !cityConfirmed);
  const cityPicker = <MarketplaceCityPicker cities={cities} activeCity={activeCity} required={cityRequired} loading={locationStatus === "loading"} message={locationMessages[locationStatus]} onLocate={requestLocation} onSelect={selectCity} onClose={() => setCityPickerOpen(false)} />;

  const marketplaceTheme = {
    "--marketplace-primary": partnerPrimaryColor || "#143D42",
    "--marketplace-accent": partnerAccentColor || "#FF7133",
  } as CSSProperties;

  if (cities.length > 0 && !preferencesReady) return <main className="market-city-loading" role="status"><BrandLogo size="sm" priority /><span>Cargando Marketplace...</span></main>;
  if (cityRequired) return <main className="market-city-entry">{cityPicker}</main>;
  return <main id="inicio" style={marketplaceTheme} className={`${!partnerName ? "somos-marketplace" : ""} min-h-screen scroll-smooth bg-white pb-20 text-[#143D42] sm:pb-0`}>
    {!partnerName ? <div className="hidden sm:block"><PublicHeader primaryHref="/registro" primaryLabel="Registrar comercio" /></div> : null}
    <div className={`fixed inset-x-0 top-0 z-[60] border-b border-white/10 bg-[var(--marketplace-primary)] text-white shadow-lg transition duration-300 sm:hidden ${compactHeaderVisible ? "visible translate-y-0 opacity-100" : "invisible pointer-events-none -translate-y-full opacity-0"}`} aria-hidden={!compactHeaderVisible}>
      <div className="vp-container flex h-14 items-center gap-2">
        {partnerName ? <OptimizedImage src={partnerLogoUrl || ""} alt={partnerName} width={36} height={36} className="h-9 w-9 rounded-lg bg-white object-cover p-0.5" /> : <Link href="/" aria-label="Ir al inicio de Somos" className="shrink-0"><BrandLogo variant="white" size="sm" /></Link>}
        {cities.length ? <button type="button" onClick={() => setCityPickerOpen(true)} className="market-city-selector ml-auto flex min-w-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-black transition active:scale-95"><MapPin size={14} className="shrink-0 text-[var(--marketplace-accent)]" /><span className="max-w-[120px] truncate">{selectedCityName}</span><ChevronDown size={14} className="shrink-0" /></button> : <span className="ml-auto" />}
        <button type="button" onClick={focusSearch} aria-label="Buscar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--marketplace-accent)] text-white transition active:scale-90"><Search size={18} /></button>
      </div>
    </div>
    <section className="market-intro rounded-b-[32px] bg-[var(--marketplace-primary)] pb-5 text-white shadow-lg shadow-[#143D42]/10 sm:mx-auto sm:mt-5 sm:max-w-[1180px] sm:rounded-[30px] sm:pb-7">
      <header className="vp-container flex min-h-16 items-center justify-between gap-3 py-2 sm:hidden">{partnerName ? <div className="flex min-w-0 items-center gap-2.5"><OptimizedImage src={partnerLogoUrl || ""} alt={partnerName} width={44} height={44} className="h-11 w-11 rounded-xl bg-white object-cover p-0.5" /><div className="min-w-0"><p className="truncate text-sm font-black">{partnerName}</p><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-white/65">Con tecnología Somos</p></div></div> : <Link href="/" aria-label="Ir al inicio de Somos" className="min-w-0 shrink"><BrandLogo variant="white" size="sm" priority /></Link>}<PwaInstallButton subtle label="Instalar" /></header>
      <div className="market-search-area vp-container pt-2 sm:pt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="hidden max-w-2xl sm:block">{partnerName ? <div className="flex items-center gap-3"><OptimizedImage src={partnerLogoUrl || ""} alt={partnerName} width={56} height={56} className="h-14 w-14 rounded-xl bg-white object-cover p-0.5" /><div><p className="text-xs font-bold uppercase tracking-[0.08em] text-white/65">Marketplace aliado · Con tecnología Somos</p><h1 className="text-3xl font-black leading-tight">{title}</h1></div></div> : <>{eyebrow ? <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFD45C]">{eyebrow}</p> : null}<h1 className="mt-1 text-4xl font-black leading-tight">{title}</h1>{description ? <p className="mt-1 text-sm font-semibold text-white/70">{description}</p> : null}</>}</div>
          {cities.length ? <button type="button" onClick={() => setCityPickerOpen(true)} className="market-city-selector inline-flex h-12 min-w-[190px] items-center gap-2 rounded-full bg-[var(--marketplace-accent)] px-4 text-sm font-black text-white shadow-md shadow-black/10 ring-2 ring-white/20 transition active:scale-[0.97]"><MapPin size={17} className="shrink-0" /><span className="min-w-0 flex-1 text-left"><small>Ciudad</small><b className="truncate">{selectedCityName}</b></span><ChevronDown size={17} /></button> : null}
        </div>
        {partnerName && partnerBannerImageUrl ? <div className="relative mt-4 h-36 overflow-hidden rounded-[20px] sm:h-52"><OptimizedImage src={partnerBannerImageUrl} alt={`Banner de ${partnerName}`} fill sizes="1080px" className="object-cover" /></div> : null}
        {partnerName && partnerLocation ? <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-white/70"><MapPin size={13} />{partnerLocation}</p> : null}
        <label className="relative mt-4 block"><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="¿Qué quieres pedir hoy?" className="h-14 w-full rounded-[20px] bg-white pl-5 pr-16 text-sm font-bold text-[#143D42] shadow-md outline-none ring-2 ring-transparent focus:ring-[#FF7133] sm:h-16 sm:text-base" /><span className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-[#FF7133] text-white"><Search size={21} /></span></label>
        {locationMessages[locationStatus] ? <p role="status" className="mt-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white">{locationMessages[locationStatus]}</p> : null}
        <div className="vp-scrollbar-none mt-4 flex gap-2 overflow-x-auto pb-1">{categoryFilters.map((filter) => <button key={filter} type="button" onClick={() => { setActiveFilter(filter); if (activeView === "offers") setActiveView("home"); }} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-black transition duration-200 active:scale-95 ${activeFilter === filter ? "bg-white text-[#143D42] shadow-sm" : "border border-white/25 bg-white/5 text-white"}`}><CategoryIcon label={filter} />{filter}</button>)}</div>
      </div>
    </section>
    <div className="market-directory-toolbar vp-container">
      <button ref={mapTrigger} type="button" onClick={() => setMapOpen(true)}><MapIcon size={18} />Mapa</button>
      {!native ? <Link href="/mi-cuenta"><UserRound size={18} />Mi perfil</Link> : null}
    </div>
    {mapOpen ? <section role="dialog" aria-modal="true" aria-label="Mapa del Marketplace" className="market-map-dialog">
      <header><h2>Comercios en el mapa</h2><button type="button" autoFocus aria-label="Cerrar mapa" title="Cerrar mapa" onClick={closeMap}><X size={22} /></button></header>
      <div className="market-map-filters"><span>{filteredStores.length} comercios</span><span>{selectedCityName}</span></div>
      <MarketplaceMap stores={mapStores} />
    </section> : null}
    {activeView === "home" ? <>
      {curatedSections.featured.length ? <section className="bg-white py-6"><div className="vp-container"><div className="flex items-center gap-3"><span className="h-8 w-1.5 rounded-full bg-[#FF7133]" aria-hidden="true" /><Sparkles className="text-[#0F6B63]" /><h2 className="text-xl font-black sm:text-2xl">Destacados Somos</h2></div><div className="vp-scrollbar-none mt-4 flex snap-x gap-3 overflow-x-auto pb-2">{curatedSections.featured.slice(0, 6).map((product) => <ProductCard key={product.rewardId} badge="Destacado" product={{ productId: product.productId, storeId: product.storeId, storeName: product.storeName, storeSlug: product.storeSlug, productName: product.productName, description: product.description, imageUrl: product.imageUrl, priceUsd: product.priceUsd, discountPercent: product.discountPercent, createdAt: "" }} />)}</div></div></section> : null}
      <ProductRail title="Ofertas que valen la pena" eyebrow="Precios especiales" products={curatedSections.offers.slice(0, 6)} badge="Oferta" />
      <ProductRail title="Los favoritos de la semana" products={curatedSections.bestSellers.slice(0, 6)} badge="Mas vendido" />
      <StoreRail stores={curatedSections.newStores} />
      <section className="vp-container py-6"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F6B63]">{storesEyebrow}</p><div className="mt-1 flex items-center gap-3"><span className="h-8 w-1.5 rounded-full bg-[#FF7133]" aria-hidden="true" /><h2 className="text-xl font-black sm:text-2xl">Todos los comercios</h2></div></div><p className="rounded-full bg-[#E8F6F1] px-2.5 py-1 text-xs font-black text-[#0F6B63]">{filteredStores.length}</p></div><StoreGrid stores={filteredStores} emptyTitle={emptyTitle} emptyText={emptyText} onReset={() => { setQuery(""); setActiveFilter("Todos"); }} /></section>
    </> : null}
    {activeView === "nearby" ? <section className="vp-container py-7"><div className="flex items-center gap-3"><span className="h-8 w-1.5 rounded-full bg-[#FF7133]" /><Compass className="text-[#0F6B63]" /><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0F6B63]">{locationCityName ? `En ${locationCityName}` : "Según tu ubicación"}</p><h2 className="text-2xl font-black">Cerca de ti</h2></div></div>{locationStatus === "loading" ? <div className="mt-6 grid grid-cols-2 gap-3">{[1, 2, 3, 4].map((item) => <div key={item} className="h-60 animate-pulse rounded-[18px] bg-[#EEF3F1]" />)}</div> : locationStatus === "ready" ? <><p className="mt-3 text-xs font-semibold text-[#55706E]">{nearbyStores.length} comercio{nearbyStores.length === 1 ? "" : "s"} ordenado{nearbyStores.length === 1 ? "" : "s"} por distancia</p><StoreGrid stores={nearbyStores} emptyTitle="No encontramos comercios en tu ciudad" emptyText="Puedes explorar todos los comercios disponibles." onReset={() => selectView("stores")} /></> : <div className="mt-6 rounded-[22px] bg-[#E8F6F1] p-6 text-center"><Navigation className="mx-auto text-[#0F6B63]" /><h3 className="mt-3 text-lg font-black">Encuentra comercios cerca de ti</h3><p className="mt-1 text-sm font-semibold text-[#55706E]">Usaremos tu ubicación para identificar tu ciudad y ordenar sus comercios por distancia.</p><button type="button" onClick={requestLocation} className="mt-4 rounded-full bg-[#FF7133] px-5 py-3 text-sm font-black text-white transition active:scale-[0.97]">Usar mi ubicación</button></div>}</section> : null}
    {activeView === "offers" ? <section className="pb-5"><ProductRail title="Todas las ofertas" eyebrow="Precios especiales" products={curatedSections.offers} badge="Oferta" />{!curatedSections.offers.length ? <div className="vp-container"><div className="rounded-[22px] bg-[#FFF4EE] p-6 text-center"><Percent className="mx-auto text-[#FF7133]" /><h2 className="mt-3 text-xl font-black">No hay ofertas activas</h2><p className="mt-1 text-sm font-semibold text-[#746f69]">Vuelve pronto para descubrir nuevos precios especiales.</p></div></div> : null}</section> : null}
    {activeView === "stores" ? <section className="vp-container py-6"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F6B63]">{storesEyebrow}</p><div className="mt-1 flex items-center gap-3"><span className="h-8 w-1.5 rounded-full bg-[#FF7133]" /><h2 className="text-xl font-black sm:text-2xl">{storesTitle}</h2></div></div><p className="rounded-full bg-[#E8F6F1] px-2.5 py-1 text-xs font-black text-[#0F6B63]">{filteredStores.length} resultado{filteredStores.length === 1 ? "" : "s"}</p></div><div className="vp-scrollbar-none mt-4 flex gap-2 overflow-x-auto pb-1">{storeFilters.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-black transition duration-200 active:scale-95 ${activeFilter === filter ? "bg-[#143D42] text-white" : "bg-[#E8F6F1] text-[#0F6B63]"}`}>{filter}</button>)}</div><StoreGrid stores={filteredStores} emptyTitle={emptyTitle} emptyText={emptyText} onReset={() => { setQuery(""); setActiveFilter("Todos"); }} /></section> : null}
    <PublicFooter
      text={footerText}
      shareTitle={partnerName ? `Marketplace de ${partnerName}` : "Marketplace Somos"}
      shareText={partnerName ? `Explora comercios aliados de ${partnerName} en Somos.` : "Explora comercios activos en el Marketplace Somos."}
      whatsappMessage={partnerName ? `Hola Somos, necesito informacion sobre el marketplace de ${partnerName}.` : "Hola Somos, necesito informacion sobre el Marketplace."}
    />
    {cityPickerOpen ? cityPicker : null}
    <nav aria-label="Navegación del Marketplace" className="fixed inset-x-0 bottom-0 z-50 border-t border-[#143D42]/[0.08] bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(20,61,66,0.08)] backdrop-blur-xl sm:hidden"><div className="mx-auto grid max-w-md grid-cols-4">{([{ id: "home", label: "Inicio", icon: Home }, { id: "nearby", label: "Cerca", icon: Compass }, { id: "offers", label: "Ofertas", icon: Percent }, { id: "stores", label: "Comercios", icon: StoreIcon }] as const).map((item) => { const Icon = item.icon; const active = activeView === item.id; return <button key={item.id} type="button" onClick={() => selectView(item.id)} aria-current={active ? "page" : undefined} className={`flex min-h-12 flex-col items-center gap-1 text-[10px] font-black transition duration-200 active:scale-90 ${active ? "text-[#143D42]" : "text-[#55706E]"}`}><span className={`grid h-7 w-7 place-items-center transition duration-200 ${active ? "rounded-full bg-[#143D42] text-white" : "text-[#143D42]"}`}><Icon size={18} /></span>{item.label}<span className={`h-1 w-5 rounded-full transition duration-200 ${active ? "bg-[#FF7133]" : "bg-transparent"}`} /></button>; })}</div></nav>
  </main>;
}
