"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  Check,
  Clock3,
  Menu,
  MessageCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store as StoreIcon,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";
import type { Store } from "@/types";
import { BrandLogo } from "@/components/public/BrandLogo";
import { PwaInstallButton } from "@/components/pwa/PwaInstallButton";
import { plans } from "@/lib/plans";

const businessLabels: Record<string, string> = {
  food: "Comida",
  fashion: "Ropa",
  accessories: "Accesorios",
  tech: "Tecnología",
  desserts: "Postres",
  beauty: "Belleza",
  general: "Otros",
};

const commerceBenefits = [
  { icon: ShoppingCart, title: "Catálogo con carrito" },
  { icon: PackageCheck, title: "Pedidos organizados" },
  { icon: Sparkles, title: "Opciones, tallas y extras" },
  { icon: WalletCards, title: "Pagos claros" },
  { icon: Truck, title: "Delivery o retiro" },
  { icon: Users, title: "Clientes y recompra" },
];

const differentiators = [
  "USD, EUR y Bs con tasa visible",
  "Pago móvil, transferencia y efectivo",
  "WhatsApp como canal natural",
  "Delivery propio, zonas o distancia",
  "Productos con tallas, colores o extras",
  "Clientes frecuentes y recompra",
];

const faqs = [
  {
    question: "¿Necesito página web propia?",
    answer: "No. Vende+ te da un catálogo público con link para compartir por WhatsApp e Instagram.",
  },
  {
    question: "¿Mis clientes necesitan instalar una app?",
    answer: "No. Pueden comprar desde el navegador del teléfono y confirmar por WhatsApp.",
  },
  {
    question: "¿Puedo usar delivery propio?",
    answer: "Sí. Puedes configurar delivery propio, retiro o cotización manual según tu operación.",
  },
  {
    question: "¿Puedo vender ropa con tallas y colores?",
    answer: "Sí. Las opciones y extras sirven para tallas, colores, sabores, agregados o variantes.",
  },
  {
    question: "¿Puedo recibir pago móvil?",
    answer: "Sí. El comercio puede mostrar datos de pago móvil, transferencia, efectivo y otros métodos.",
  },
  {
    question: "¿Vende+ cobra comisión?",
    answer: "La versión comercial funciona por plan mensual. Las condiciones finales se definen contigo.",
  },
];

function labelForStore(store: Store) {
  const key = String(store.category || "").toLowerCase();
  return businessLabels[key] || store.category || "Comercio";
}

function storeSearchText(store: Store) {
  return [
    store.name,
    store.category,
    store.description,
    store.address,
  ]
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function StoreCard({ store, compact = false }: { store: Store; compact?: boolean }) {
  const canDeliver = store.deliverySettings?.deliveryEnabled !== false;
  const canPickup = store.deliverySettings?.pickupEnabled !== false;
  const isOpen = store.openState?.isOpen !== false;

  return (
    <Link
      href={`/${store.slug}`}
      className={[
        "group grid overflow-hidden rounded-[24px] bg-white shadow-xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.07] transition hover:-translate-y-1",
        compact ? "grid-cols-[104px_1fr]" : "",
      ].join(" ")}
    >
      <div className={compact ? "relative min-h-36 overflow-hidden" : "relative h-44 overflow-hidden"}>
        <img
          src={store.logoUrl || store.heroImageUrl}
          alt={store.name}
          className="h-full w-full bg-[#F8F3E8] object-cover transition duration-500 group-hover:scale-105"
          decoding="async"
          loading="lazy"
        />
        {!compact ? (
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-[#2E3A79]">
              {labelForStore(store)}
            </span>
            <span className={isOpen ? "rounded-full bg-green-100 px-3 py-1.5 text-xs font-black text-green-700" : "rounded-full bg-red-100 px-3 py-1.5 text-xs font-black text-red-700"}>
              {isOpen ? "Abierto" : "Cerrado"}
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-4">
        {compact ? (
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#746f69]">
            {labelForStore(store)}
          </p>
        ) : null}
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
            Ver catálogo
            <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function HomeClient({ stores }: { stores: Store[] }) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");

  const filters = useMemo(() => {
    const names = new Set<string>();

    for (const store of stores) {
      names.add(labelForStore(store));
    }

    return ["Todos", ...Array.from(names).filter(Boolean).slice(0, 9)];
  }, [stores]);

  const filteredStores = useMemo(() => {
    const needle = normalizeSearch(query);
    const filter = activeFilter === "Todos" ? "" : normalizeSearch(activeFilter);

    return stores.filter((store) => {
      const text = storeSearchText(store);
      const matchesQuery = !needle || text.includes(needle);
      const matchesFilter = !filter || text.includes(filter);
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, query, stores]);

  return (
    <main className="min-h-screen bg-[#FFF8F0] text-[#25262B]">
      <header className="sticky top-0 z-30 border-b border-[#25262B]/[0.06] bg-[#FFF8F0]/95 backdrop-blur">
        <nav className="vp-container flex items-center justify-between gap-3 py-3">
          <Link href="/" aria-label="Ir al inicio de Vende+">
            <BrandLogo compact />
          </Link>
          <div className="hidden items-center gap-5 text-sm font-black text-[#746f69] md:flex">
            <a href="#negocios">Negocios</a>
            <a href="#comercios">Comercios</a>
            <a href="#planes">Planes</a>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/panel/login"
              className="inline-flex rounded-full bg-white px-3 py-2 text-xs font-black text-[#2E3A79] ring-1 ring-[#25262B]/10 sm:px-4 sm:text-sm"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="inline-flex items-center gap-2 rounded-full bg-[#FFB547] px-4 py-2 text-sm font-black text-[#25262B]"
            >
              Vender
              <ArrowRight size={15} />
            </Link>
            <a
              href="#negocios"
              aria-label="Ver negocios"
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#2E3A79] ring-1 ring-[#25262B]/10 md:hidden"
            >
              <Menu size={18} />
            </a>
          </div>
        </nav>
      </header>

      <section className="bg-white">
        <div className="vp-container py-6 sm:py-8">
          <div className="grid gap-5 rounded-[28px] border border-[#25262B]/[0.07] bg-[#FFF8F0] p-4 shadow-xl shadow-[#2E3A79]/[0.06] sm:p-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#2E3A79] ring-1 ring-[#25262B]/10">
                <Sparkles size={13} />
                Compra local, rapido y por WhatsApp
              </p>
              <h1 className="mt-3 max-w-2xl text-3xl font-black leading-[1.04] text-[#25262B] sm:text-5xl">
                Encuentra un negocio, arma tu pedido y confirma sin vueltas
              </h1>
              <p className="mt-3 max-w-xl text-sm font-bold leading-relaxed text-[#746f69] sm:text-base">
                Comida, ropa, postres y servicios en una sola pantalla. Elige delivery o retiro y el comercio recibe todo ordenado.
              </p>

              <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
                <a
                  href="#negocios"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
                >
                  Pedir ahora
                  <ArrowRight size={17} />
                </a>
                <PwaInstallButton compact />
                <a
                  href="#comercios"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#2E3A79] ring-1 ring-[#25262B]/10"
                >
                  Tengo un comercio
                  <StoreIcon size={17} />
                </a>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {[
                ["1", "Busca", "Por negocio o rubro"],
                ["2", "Pide", "Carrito claro y rapido"],
                ["3", "Confirma", "WhatsApp sin copiar datos"],
              ].map(([step, title, text]) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-[#25262B]/[0.06]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#2E3A79] text-sm font-black text-[#FFB547]">
                    {step}
                  </span>
                  <div>
                    <p className="text-sm font-black text-[#25262B]">{title}</p>
                    <p className="text-xs font-bold text-[#746f69]">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="hidden">
        <div className="absolute inset-0">
          <img
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
            alt=""
            className="h-full w-full object-cover opacity-[0.34]"
            decoding="async"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-[#25262B]/70" />
        </div>

        <div className="vp-container relative py-8 sm:py-12 lg:py-16">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#FFB547] ring-1 ring-white/15">
              <Sparkles size={14} />
              Comercios cerca de ti
            </p>
            <h1 className="mt-5 text-4xl font-black leading-[1.02] sm:text-6xl lg:text-7xl">
              Pide fácil en tus negocios favoritos
            </h1>
            <p className="mt-4 max-w-2xl text-base font-bold leading-relaxed text-white/78 sm:text-lg">
              Encuentra comida, ropa, postres y servicios. Arma tu pedido, elige delivery o retiro y confirma por WhatsApp.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="#negocios"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-6 py-4 text-sm font-black text-[#25262B]"
              >
                Ver negocios
                <ArrowRight size={17} />
              </a>
              <a
                href="#comercios"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-black text-[#2E3A79]"
              >
                Tengo un comercio
                <StoreIcon size={17} />
              </a>
            </div>
          </div>

          <div className="mt-8 grid gap-3 text-sm font-black text-white/80 sm:grid-cols-3">
            <div className="rounded-[22px] bg-white/12 p-4 ring-1 ring-white/15">Sin apps raras: confirmas por WhatsApp</div>
            <div className="rounded-[22px] bg-white/12 p-4 ring-1 ring-white/15">Delivery o retiro según el comercio</div>
            <div className="rounded-[22px] bg-white/12 p-4 ring-1 ring-white/15">Pagos en Bs, USD o efectivo</div>
          </div>
        </div>
      </section>

      <section id="negocios" className="border-b border-[#25262B]/[0.06] bg-white">
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
              Negocios disponibles
            </p>
            <h2 className="mt-1 text-3xl font-black">Elige, pide y confirma</h2>
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
            <h3 className="mt-4 text-2xl font-black">Pronto verás negocios disponibles aquí</h3>
            <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
              ¿Tienes un comercio? Sé de los primeros en vender con Vende+.
            </p>
            <Link
              href="/registro"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
            >
              Quiero vender con Vende+
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>

      <section className="vp-container py-10">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ["1", "Elige un negocio", "Busca por nombre, rubro o lo que quieres comprar."],
            ["2", "Agrega productos", "Arma tu carrito con cantidades, tallas, colores o extras."],
            ["3", "Confirma por WhatsApp", "El comercio recibe el pedido listo para atenderte."],
          ].map(([number, title, text]) => (
            <article key={number} className="rounded-[24px] bg-white p-5 shadow-lg shadow-[#2E3A79]/[0.06] ring-1 ring-[#25262B]/[0.06]">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#2E3A79] text-lg font-black text-[#FFB547]">
                {number}
              </div>
              <h3 className="mt-4 text-xl font-black">{title}</h3>
              <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="comercios" className="bg-[#25262B] py-10 text-white">
        <div className="vp-container">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
                ¿Tienes un negocio?
              </p>
              <h2 className="mt-2 text-4xl font-black leading-tight">
                Convierte tu WhatsApp en un sistema de ventas
              </h2>
              <p className="mt-3 text-base font-bold leading-relaxed text-white/72">
                Catálogo, carrito, pedidos, pagos, clientes y recompra para comercios que venden todos los días.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/registro"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-6 py-4 text-sm font-black text-[#25262B]"
                >
                  Quiero vender con Vende+
                  <ArrowRight size={17} />
                </Link>
                <a
                  href="#planes"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-black text-[#2E3A79]"
                >
                  Ver planes
                </a>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {commerceBenefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <article key={benefit.title} className="rounded-[22px] bg-white/10 p-4 ring-1 ring-white/10">
                    <Icon className="text-[#FFB547]" size={22} />
                    <p className="mt-3 text-sm font-black">{benefit.title}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="planes" className="vp-container py-10">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2E3A79]">
              Planes para comercios
            </p>
            <h2 className="mt-1 text-3xl font-black">Empieza con 15 días gratis</h2>
          </div>
          <Link
            href="/panel/login"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#2E3A79] ring-1 ring-[#25262B]/10"
          >
            Iniciar sesión comercio
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={[
                "rounded-[26px] p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.07]",
                plan.id === "emprendedor" ? "bg-[#2E3A79] text-white" : "bg-white text-[#25262B]",
              ].join(" ")}
            >
              <p className={plan.id === "emprendedor" ? "text-sm font-black text-[#FFB547]" : "text-sm font-black text-[#2E3A79]"}>
                {plan.name}
              </p>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-4xl font-black">${plan.priceUsd}</span>
                <span className={plan.id === "emprendedor" ? "pb-1 text-sm font-black text-white/65" : "pb-1 text-sm font-black text-[#746f69]"}>
                  {plan.billingLabel}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {plan.features.map((feature) => (
                  <p key={feature} className="flex items-center gap-2 text-sm font-bold">
                    <Check size={16} className={plan.id === "emprendedor" ? "text-[#FFB547]" : "text-[#6FA64F]"} />
                    {feature}
                  </p>
                ))}
              </div>
              <Link
                href="/registro"
                className={[
                  "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black",
                  plan.id === "emprendedor"
                    ? "bg-[#FFB547] text-[#25262B]"
                    : "bg-[#F8F3E8] text-[#2E3A79]",
                ].join(" ")}
              >
                Empezar
                <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="vp-container">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2E3A79]">
                Pensado para Venezuela
              </p>
              <h2 className="mt-1 text-3xl font-black">Más cercano a cómo vendemos aquí</h2>
              <p className="mt-3 text-sm font-bold leading-relaxed text-[#746f69]">
                Vende+ no reemplaza WhatsApp: lo ordena, lo hace cobrable y le da al comercio una operación más clara.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {differentiators.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-[20px] bg-[#F8F3E8] p-4">
                  <ShieldCheck size={20} className="shrink-0 text-[#6FA64F]" />
                  <p className="text-sm font-black">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="vp-container py-10">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2E3A79]">
              Preguntas frecuentes
            </p>
            <h2 className="mt-1 text-3xl font-black">Claro desde el primer día</h2>
          </div>
          <div className="grid gap-3">
            {faqs.map((item) => (
              <details
                key={item.question}
                className="group rounded-[20px] bg-white p-4 shadow-lg shadow-[#2E3A79]/[0.05] ring-1 ring-[#25262B]/[0.06]"
              >
                <summary className="cursor-pointer list-none text-sm font-black">
                  {item.question}
                </summary>
                <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#25262B] py-8 text-white">
        <div className="vp-container grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <BrandLogo compact />
            <p className="mt-3 max-w-xl text-sm font-bold leading-relaxed text-white/65">
              Encuentra negocios, arma tu pedido y confirma por WhatsApp. Hecho para comercios que venden por WhatsApp.
            </p>
          </div>
          <div className="grid gap-2 text-sm font-black text-white/72 sm:grid-cols-2">
            <a href="#negocios">Negocios</a>
            <a href="#comercios">Comercios</a>
            <a href="#planes">Planes</a>
            <Link href="/panel/login">Iniciar sesión</Link>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <PwaInstallButton />
            <Link
              href="/registro"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
            >
              Crear comercio
              <BadgeDollarSign size={17} />
            </Link>
            <a
              href="#negocios"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#2E3A79]"
            >
              Ver negocios
              <MessageCircle size={17} />
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
