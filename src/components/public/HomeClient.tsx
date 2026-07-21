"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  Check,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Store as StoreIcon,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";
import type { Store } from "@/types";
import type { PublicTransportAgencyLogo } from "@/lib/transport";
import { AffiliatedDeliveryLogos } from "@/components/public/AffiliatedDeliveryLogos";
import { BrandLogo } from "@/components/public/BrandLogo";
import { PwaInstallButton } from "@/components/pwa/PwaInstallButton";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import { plans } from "@/lib/plans";

type AffiliatedStore = {
  name: string;
  category: string;
  slug: string;
  imageUrl: string;
  initials: string;
};

const fallbackAffiliatedStores: AffiliatedStore[] = [
  { name: "Armario", category: "Moda", slug: "armario", imageUrl: "", initials: "AR" },
  { name: "Smash", category: "Comida", slug: "marketplace", imageUrl: "", initials: "SM" },
  { name: "Knockouts", category: "Food", slug: "knockouts", imageUrl: "", initials: "KO" },
  { name: "Migas MCY", category: "Bakery", slug: "migasmcy", imageUrl: "", initials: "MG" },
];

const quickActions = [
  {
    title: "Quiero comprar",
    text: "Ver comercios afiliados y hacer pedidos desde el marketplace.",
    href: "/marketplace",
    icon: ShoppingBag,
    tone: "from-[#FFB547] via-[#FF8A1F] to-[#FF5C35]",
    iconTone: "bg-white/22 text-white",
    textTone: "text-white/88",
    footTone: "text-white",
  },
  {
    title: "Tengo un comercio",
    text: "Crear catalogo, recibir pedidos, controlar pagos y operar con facilidad y orden.",
    href: "/registro",
    icon: StoreIcon,
    tone: "from-[#2E3A79] via-[#2446B8] to-[#1267E8]",
    iconTone: "bg-white/18 text-[#FFB547]",
    textTone: "text-white/84",
    footTone: "text-[#FFB547]",
  },
  {
    title: "Soy empresa delivery",
    text: "Afiliate gratis y obtén beneficios por referir comercios.",
    href: "/transporte",
    icon: Truck,
    tone: "from-[#17A765] via-[#0799A6] to-[#2E3A79]",
    iconTone: "bg-white/18 text-white",
    textTone: "text-white/84",
    footTone: "text-white",
  },
];

const commerceBenefits = [
  { icon: ShoppingBag, title: "Catalogo listo para compartir" },
  { icon: PackageCheck, title: "Pedidos ordenados en panel" },
  { icon: WalletCards, title: "Pagos visibles y comprobables" },
  { icon: Truck, title: "Delivery propio o empresa afiliada" },
  { icon: Users, title: "Clientes frecuentes y recompra" },
  { icon: MessageCircle, title: "Pedidos automatizados y ordenados" },
];

const deliveryBenefits = [
  "Perfil de empresa delivery con logo, cobertura y condiciones",
  "Tarifas por zonas, rangos de km o tarifa plana",
  "Solicitudes de afiliacion aprobadas por ambas partes",
  "Pedidos confirmados por comercio antes de enviarse",
  "Facturacion semanal por comercio y balance general",
  "Historial operativo de cada servicio recibido",
];

const differentiators = [
  "Pensado para comercios que necesitan ordenar ventas y entregas",
  "Mobile-first para operar desde el telefono",
  "Pagos en Bs, USD o EUR segun el comercio",
  "Sin app obligatoria para el cliente final",
  "Panel simple para equipos no tecnicos",
  "Preparado para delivery propio o externo",
];

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function mapAffiliatedStores(stores: Store[]): AffiliatedStore[] {
  const storesWithLogos = stores
    .filter((store) => store.name && store.slug)
    .map((store) => ({
      name: store.name,
      category: store.category || "Comercio",
      slug: store.slug,
      imageUrl: store.logoUrl || "",
      initials: getInitials(store.name),
    }))
    .filter((store) => store.imageUrl);

  if (storesWithLogos.length) return storesWithLogos;

  const storesWithImages = stores
    .filter((store) => store.name && store.slug)
    .map((store) => ({
      name: store.name,
      category: store.category || "Comercio",
      slug: store.slug,
      imageUrl: store.coverImageUrl || store.heroImageUrl || "",
      initials: getInitials(store.name),
    }))
    .filter((store) => store.imageUrl);

  return storesWithImages.length ? storesWithImages : fallbackAffiliatedStores;
}

export function HomeClient({
  stores = [],
  transportAgencies = [],
}: {
  stores?: Store[];
  transportAgencies?: PublicTransportAgencyLogo[];
}) {
  const affiliatedStores = mapAffiliatedStores(stores);

  function homePlanFeature(feature: string) {
    return feature
      .replace("Pedidos por WhatsApp", "Ventas automatizadas")
      .replace("pedidos", "ventas");
  }

  return (
    <main className="min-h-screen bg-[#F6F4EF] text-[#25262B]">
      <header className="sticky top-0 z-30 border-b border-[#25262B]/[0.06] bg-[#F6F4EF]/95 backdrop-blur">
        <nav className="vp-container flex items-center justify-between gap-3 py-3">
          <Link href="/" aria-label="Ir al inicio de Somos">
            <BrandLogo compact />
          </Link>
          <div className="hidden items-center gap-5 text-sm font-black text-[#5F635E] md:flex">
            <a href="#comercios">Comercios</a>
            <a href="#planes">Planes</a>
            <a href="#delivery">Delivery</a>
            <Link href="/marketplace">Marketplace</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/panel/login"
              className="inline-flex rounded-full bg-white px-3 py-2 text-xs font-black text-[#2E3A79] ring-1 ring-[#25262B]/10 sm:px-4 sm:text-sm"
            >
              Iniciar sesion
            </Link>
            <Link
              href="/registro"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FFB547] to-[#FF7A1A] px-4 py-2 text-sm font-black text-[#25262B] shadow-lg shadow-[#FFB547]/25 transition hover:-translate-y-0.5"
            >
              Vender
              <ArrowRight size={15} />
            </Link>
          </div>
        </nav>
      </header>

      <section className="bg-[#F6F4EF]">
        <div className="vp-container grid min-h-[calc(100vh-76px)] gap-8 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-10">
          <div>
            <p className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#2E3A79] ring-1 ring-[#25262B]/10">
              Ecosistema que conecta comercios y empresas delivery
            </p>
            <h1 className="mt-5 max-w-3xl text-3xl font-black leading-[1.08] text-[#25262B] sm:text-4xl lg:text-[2.65rem]">
              SOMOS es el ecosistema que conecta tus comercios favoritos con las mejores empresas delivery de tu ciudad para brindarte el mejor servicio.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-bold leading-relaxed text-[#5F635E] sm:text-lg">
              Somos une catalogo, carrito, pedidos, pagos, delivery, clientes y recompra en un solo panel simple para tu comercio.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {quickActions.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className={`group relative overflow-hidden rounded-[26px] bg-gradient-to-br ${item.tone} p-4 text-white shadow-xl shadow-[#2E3A79]/15 ring-1 ring-white/40 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#2E3A79]/25`}
                  >
                    <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/20 blur-2xl transition group-hover:scale-125" />
                    <span className="pointer-events-none absolute bottom-0 left-0 h-16 w-16 rounded-full bg-black/10 blur-2xl" />
                    <div className="flex items-center gap-3">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${item.iconTone} ring-1 ring-white/25`}>
                        <Icon size={20} />
                      </span>
                      <span className="relative text-lg font-black leading-tight sm:text-xl">{item.title}</span>
                    </div>
                    <p className={`relative mt-3 min-h-14 text-xs font-bold leading-relaxed ${item.textTone}`}>
                      {item.text}
                    </p>
                    <span className={`relative mt-3 inline-flex items-center gap-2 rounded-full bg-white/16 px-3 py-2 text-xs font-black ${item.footTone} ring-1 ring-white/20`}>
                      Continuar
                      <ArrowRight size={14} className="transition group-hover:translate-x-1" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-[34px] bg-[#25262B] p-5 text-white shadow-2xl shadow-[#25262B]/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFB547]">
                  Red Somos
                </p>
                <h2 className="mt-2 text-2xl font-black leading-tight">
                  Comercios afiliados operando desde un mismo ecosistema
                </h2>
              </div>
              <span className="hidden rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/80 sm:inline-flex">
                En vivo
              </span>
            </div>

            <div className="mt-5 rounded-[26px] bg-white/8 p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between rounded-2xl bg-white/10 p-3">
                <span className="text-sm font-black">Comercio</span>
                <span className="text-sm font-black text-[#FFB547]">Pedido confirmado</span>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 p-3">
                <span className="text-sm font-black">Empresa delivery</span>
                <span className="text-sm font-black text-[#8BD17C]">Servicio recibido</span>
              </div>
              <div className="mt-3 rounded-2xl bg-[#FFB547] p-3 text-[#25262B]">
                <p className="text-sm font-black">Cliente informado automaticamente</p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[26px] bg-white p-3 text-[#25262B]">
              <p className="px-2 text-xs font-black uppercase tracking-[0.16em] text-[#5F635E]">
                Comercios afiliados
              </p>
              <div className="vp-logo-marquee mt-3">
                <div className="vp-logo-marquee-track">
                  {[...affiliatedStores, ...affiliatedStores].map((store, index) => (
                    <Link
                      key={`${store.name}-${index}`}
                      href={store.slug === "marketplace" ? "/marketplace" : `/${store.slug}`}
                      className="flex min-w-[170px] items-center gap-3 rounded-2xl bg-[#F6F4EF] p-3 ring-1 ring-[#25262B]/[0.06]"
                    >
                      {store.imageUrl ? (
                        <OptimizedImage
                          src={store.imageUrl}
                          alt={`${store.name} logo`}
                          width={44}
                          height={44}
                          sizes="44px"
                          className="h-11 w-11 shrink-0 rounded-2xl bg-white object-cover ring-1 ring-[#25262B]/10"
                          fallback={
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2E3A79] text-sm font-black text-[#FFB547]">
                              {store.initials}
                            </span>
                          }
                        />
                      ) : (
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2E3A79] text-sm font-black text-[#FFB547]">
                          {store.initials}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{store.name}</span>
                        <span className="block text-[11px] font-black text-[#5F635E]">{store.category}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <AffiliatedDeliveryLogos
              agencies={transportAgencies}
              className="mt-4 overflow-hidden rounded-[26px] bg-white p-3 text-[#25262B]"
              cardClassName="bg-[#F6F4EF]"
              label="Empresas delivery afiliadas"
            />

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ["15", "dias gratis"],
                ["100%", "control de pedidos"],
                ["24/7", "catalogo online"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-white/10 p-3 text-center ring-1 ring-white/10">
                  <p className="text-lg font-black text-[#FFB547]">{value}</p>
                  <p className="text-[11px] font-black text-white/70">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="comercios" className="bg-white py-12">
        <div className="vp-container grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2E3A79]">
              Para comercios
            </p>
            <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
              Convierte tus pedidos en una operacion ordenada
            </h2>
            <p className="mt-3 text-base font-bold leading-relaxed text-[#5F635E]">
              Muestra productos, recibe pedidos claros, verifica pagos y decide si entregas con delivery propio, retiro o empresa afiliada.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/registro"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FFB547] to-[#FF7A1A] px-6 py-4 text-sm font-black text-[#25262B] shadow-lg shadow-[#FFB547]/25 transition hover:-translate-y-0.5"
              >
                Registrar comercio
                <ArrowRight size={17} />
              </Link>
              <a
                href="#planes"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-6 py-4 text-sm font-black text-white shadow-lg shadow-[#2E3A79]/20 transition hover:-translate-y-0.5"
              >
                Ver planes
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {commerceBenefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <article key={benefit.title} className="rounded-[22px] bg-[#F6F4EF] p-4 ring-1 ring-[#25262B]/[0.07]">
                  <Icon className="text-[#2E3A79]" size={22} />
                  <p className="mt-3 text-sm font-black">{benefit.title}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="planes" className="bg-[#25262B] py-12 text-white">
        <div className="vp-container">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
                Planes para comercios
              </p>
              <h2 className="mt-1 text-3xl font-black">Empieza con 15 dias gratis</h2>
            </div>
            <Link
              href="/registro"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FFB547] to-[#FF7A1A] px-5 py-3 text-sm font-black text-[#25262B] shadow-lg shadow-[#FFB547]/20 transition hover:-translate-y-0.5"
            >
              Crear comercio
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.id}
                className={[
                  "rounded-[26px] p-5 shadow-xl shadow-black/10 ring-1 ring-white/10",
                  plan.id === "monthly" ? "bg-[#FFB547] text-[#25262B]" : "bg-white/10 text-white",
                ].join(" ")}
              >
                <p className={plan.id === "monthly" ? "text-sm font-black text-[#2E3A79]" : "text-sm font-black text-[#FFB547]"}>
                  {plan.name}
                </p>
                <div className="mt-3 flex items-end gap-2">
                  {plan.id === "custom" ? (
                    <span className="text-2xl font-black">Personalizado</span>
                  ) : (
                    <>
                      <span className="text-4xl font-black">${plan.priceUsd}</span>
                      <span className={plan.id === "monthly" ? "pb-1 text-sm font-black text-[#25262B]/70" : "pb-1 text-sm font-black text-white/65"}>
                        {plan.billingLabel}
                      </span>
                    </>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <p key={feature} className="flex items-center gap-2 text-sm font-bold">
                      <Check size={16} className={plan.id === "monthly" ? "text-[#2E3A79]" : "text-[#FFB547]"} />
                      {homePlanFeature(feature)}
                    </p>
                  ))}
                </div>
                <Link
                  href="/registro"
                  className={[
                    "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black",
                    plan.id === "monthly"
                      ? "bg-[#25262B] text-white shadow-lg shadow-[#25262B]/20 transition hover:-translate-y-0.5"
                      : "bg-gradient-to-r from-white to-[#F8F3E8] text-[#2E3A79] shadow-lg shadow-black/10 transition hover:-translate-y-0.5",
                  ].join(" ")}
                >
                  {plan.id === "custom" ? "Solicitar propuesta" : "Empezar"}
                  <ArrowRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="delivery" className="vp-container py-12">
        <div className="grid gap-6 rounded-[30px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.07] lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2E3A79]">
              Para empresas delivery
            </p>
            <h2 className="mt-2 text-3xl font-black leading-tight">
              Recibe comercios afiliados con reglas claras desde el primer pedido
            </h2>
            <p className="mt-3 text-sm font-bold leading-relaxed text-[#5F635E]">
              La empresa publica cobertura, moneda de cobro, condiciones, capacidad y tarifas. El comercio solicita afiliacion y luego envia pedidos confirmados desde su panel.
            </p>
            <Link
              href="/transporte"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#17A765] via-[#0799A6] to-[#2E3A79] px-6 py-4 text-sm font-black text-white shadow-lg shadow-[#0799A6]/25 transition hover:-translate-y-0.5"
            >
              Afiliar mi empresa
              <ArrowRight size={17} />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
            <div className="relative h-72 overflow-hidden rounded-[26px]">
              <OptimizedImage
              src="https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?auto=format&fit=crop&w=900&q=80"
              alt="Empresa delivery organizando entregas urbanas"
                fill
                sizes="(max-width: 640px) 100vw, 45vw"
                className="object-cover"
                fallback={<div className="h-full w-full bg-[#F6F4EF]" />}
              />
            </div>
            <div className="grid gap-3">
              {deliveryBenefits.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-[18px] bg-[#F6F4EF] p-4">
                  <Truck size={20} className="shrink-0 text-[#2E3A79]" />
                  <p className="text-sm font-black">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="vp-container grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2E3A79]">
              Operacion real
            </p>
            <h2 className="mt-1 text-3xl font-black">Hecho para vender todos los dias</h2>
            <p className="mt-3 text-sm font-bold leading-relaxed text-[#5F635E]">
              La plataforma reduce mensajes repetidos, ventas perdidas y cobros confusos sin cambiar la forma natural de vender.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {differentiators.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-[20px] bg-[#F6F4EF] p-4">
                <ShieldCheck size={20} className="shrink-0 text-[#6FA64F]" />
                <p className="text-sm font-black">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#25262B] py-8 text-white">
        <div className="vp-container grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <BrandLogo compact />
            <p className="mt-3 max-w-xl text-sm font-bold leading-relaxed text-white/65">
              Somos ayuda a comercios y empresas delivery a operar ventas con mas orden, control y seguimiento.
            </p>
          </div>
          <div className="grid gap-2 text-sm font-black text-white/72 sm:grid-cols-2">
            <a href="#comercios">Comercios</a>
            <a href="#planes">Planes</a>
            <a href="#delivery">Delivery</a>
            <Link href="/marketplace">Marketplace</Link>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <PwaInstallButton />
            <Link
              href="/registro"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FFB547] to-[#FF7A1A] px-5 py-3 text-sm font-black text-[#25262B] shadow-lg shadow-[#FFB547]/20 transition hover:-translate-y-0.5"
            >
              Crear comercio
              <BadgeDollarSign size={17} />
            </Link>
            <Link
              href="/transporte"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-white to-[#DCEBFF] px-5 py-3 text-sm font-black text-[#2E3A79] shadow-lg shadow-white/10 transition hover:-translate-y-0.5"
            >
              Afiliar empresa
              <Truck size={17} />
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
