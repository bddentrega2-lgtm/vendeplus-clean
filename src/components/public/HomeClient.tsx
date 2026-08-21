"use client";

import Link from "next/link";
import { ArrowRight, Check, ClipboardList, MessageCircle, Motorbike, PackageCheck, QrCode, Settings2, ShoppingBag, Store as StoreIcon, UtensilsCrossed } from "lucide-react";
import type { Store } from "@/types";
import type { PublicTransportAgencyLogo } from "@/lib/transport";
import { AffiliatedDeliveryLogos } from "@/components/public/AffiliatedDeliveryLogos";
import { ButtonLink } from "@/components/public/ButtonLink";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";
import { SectionHeading } from "@/components/public/SectionHeading";
import { SurfaceCard } from "@/components/public/SurfaceCard";
import { PwaInstallButton } from "@/components/pwa/PwaInstallButton";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import { WelcomeChoice } from "@/components/public/WelcomeChoice";
import { buildSomosWhatsAppUrl } from "@/lib/whatsapp";

const commerceFeatures = ["Catálogo público por comercio", "Productos, precios, imágenes y variantes", "Carrito y finalización de pedido", "Solicitud de pedido por WhatsApp", "Delivery o retiro según configuración"];
const deliveryFeatures = ["Panel para empresas delivery", "Solicitudes de afiliación", "Tarifas por rango de km", "Cobertura máxima configurable", "Datos operativos y de contacto"];
const benefits = [
  { icon: ShoppingBag, title: "Catálogo digital", text: "Productos, precios e imágenes en un enlace fácil de compartir." },
  { icon: ClipboardList, title: "Pedidos más ordenados", text: "Información clara para que el comercio gestione cada solicitud." },
  { icon: Motorbike, title: "Delivery conectado", text: "Delivery propio, retiro o empresas afiliadas según la configuración." },
  { icon: Settings2, title: "Configuración flexible", text: "Opciones adaptables a la forma real de operar de cada comercio." },
  { icon: PackageCheck, title: "Operación centralizada", text: "Catálogo, pedidos, clientes y entregas desde un mismo panel." },
];

function FeatureList({ items, light = false }: { items: string[]; light?: boolean }) {
  return <ul className="mt-6 grid gap-3">{items.map((item) => <li key={item} className={`flex items-start gap-3 text-sm font-medium leading-6 ${light ? "text-white/75" : "text-[var(--somos-navy)]/75"}`}><span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full ${light ? "bg-white/10 text-[var(--somos-amber)]" : "bg-[var(--somos-amber)]/20 text-[var(--somos-teal)]"}`}><Check size={13} strokeWidth={3} /></span>{item}</li>)}</ul>;
}

export function HomeClient({ stores = [], transportAgencies = [] }: { stores?: Store[]; transportAgencies?: PublicTransportAgencyLogo[] }) {
  const affiliatedStores = stores.filter((store) => store.name && store.slug && (store.logoUrl || store.coverImageUrl || store.heroImageUrl)).map((store) => ({
    name: store.name,
    category: store.category || "Comercio",
    slug: store.slug,
    imageUrl: store.logoUrl || store.coverImageUrl || store.heroImageUrl || "",
  }));

  return <main className="somos-page">
    <WelcomeChoice />
    <PublicHeader />

    <section className="relative overflow-hidden">
      <div className="absolute -right-24 top-12 h-72 w-72 rounded-full bg-[var(--somos-orange)]/10 blur-3xl" />
      <div className="absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-[var(--somos-teal)]/10 blur-3xl" />
      <div className="vp-container relative py-14 sm:py-20 lg:py-24">
        <div className="max-w-4xl">
          <p className="somos-badge">Comercio y logística local</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.02] tracking-[-0.04em] text-[var(--somos-navy)] sm:text-6xl lg:text-7xl">Dos soluciones. Un mismo ecosistema.</h1>
          <p className="somos-muted mt-6 max-w-2xl text-lg font-medium leading-8 sm:text-xl">Somos conecta comercios, pedidos y empresas delivery en una experiencia más ordenada, digital y fácil de gestionar.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><ButtonLink href="/marketplace" variant="secondary">Ver marketplace</ButtonLink><ButtonLink href="/registro">Registrar comercio <ArrowRight size={17} /></ButtonLink><ButtonLink href="/transporte/registro" variant="secondary">Registrar empresa delivery</ButtonLink></div>
        </div>

        <div id="soluciones" className="mt-12 grid gap-5 lg:grid-cols-2">
          <SurfaceCard dark className="flex flex-col p-6 sm:p-8">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--somos-amber)] text-[var(--somos-navy)]"><StoreIcon size={23} /></span>
            <p className="mt-6 text-sm font-semibold text-[var(--somos-amber)]">Para comercios</p>
            <h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight">Vende mejor desde tu catálogo digital.</h2>
            <p className="mt-4 text-base font-medium leading-7 text-white/70">Muestra tus productos, recibe pedidos y ofrece una experiencia de compra más ordenada para tus clientes.</p>
            <FeatureList items={commerceFeatures} light />
            <ButtonLink href="/registro" variant="light" className="mt-7 w-full sm:w-fit">Registrar comercio <ArrowRight size={17} /></ButtonLink>
          </SurfaceCard>
          <SurfaceCard className="flex flex-col p-6 sm:p-8">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--somos-orange)] text-[var(--somos-navy)]"><Motorbike size={23} /></span>
            <p className="mt-6 text-sm font-semibold text-[var(--somos-orange)]">Para empresas delivery</p>
            <h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-[var(--somos-navy)]">Conecta con comercios y organiza tu operación.</h2>
            <p className="somos-muted mt-4 text-base font-medium leading-7">Configura tarifas, cobertura y datos operativos para que los comercios puedan solicitar afiliación a tu empresa.</p>
            <FeatureList items={deliveryFeatures} />
            <ButtonLink href="/transporte/registro" className="mt-7 w-full sm:w-fit">Registrar empresa delivery <ArrowRight size={17} /></ButtonLink>
          </SurfaceCard>
        </div>

        <div className="mt-5 overflow-hidden rounded-[32px] bg-[var(--somos-teal)] p-6 text-white shadow-xl shadow-[var(--somos-teal)]/15 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--somos-amber)] text-[var(--somos-navy)]"><UtensilsCrossed size={23} /></span>
              <div>
                <p className="text-sm font-semibold text-[var(--somos-amber)]">Nueva modalidad</p>
                <h2 className="mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">Pedidos en mesa o barra</h2>
                <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/75 sm:text-base">Tus clientes escanean el QR, hacen su pedido desde el teléfono y revisan su estado hasta que esté listo.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: QrCode, title: "Pedido con QR", text: "Sin esperar para ser atendido." },
                { icon: UtensilsCrossed, title: "Menos filas", text: "Atención más rápida en mesa o barra." },
                { icon: ClipboardList, title: "Estado visible", text: "El cliente sabe cómo avanza su pedido." },
              ].map((item) => {
                const Icon = item.icon;
                return <article key={item.title} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10"><Icon size={19} className="text-[var(--somos-amber)]" /><h3 className="mt-3 text-sm font-bold">{item.title}</h3><p className="mt-1 text-xs font-medium leading-5 text-white/65">{item.text}</p></article>;
              })}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="bg-white py-14 sm:py-20"><div className="vp-container">
      <SectionHeading eyebrow="Operaciones locales" title="Creado para operaciones locales reales" description="Somos está diseñado para comercios y empresas delivery que necesitan ordenar pedidos, mostrar mejor sus productos y trabajar con reglas claras de cobertura y tarifas." />
      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{benefits.map((benefit) => { const Icon = benefit.icon; return <article key={benefit.title} className="rounded-3xl border border-[var(--somos-navy)]/8 bg-[var(--somos-off-white)] p-5"><Icon size={22} className="text-[var(--somos-orange)]" /><h3 className="mt-4 text-base font-bold text-[var(--somos-navy)]">{benefit.title}</h3><p className="somos-muted mt-2 text-sm font-medium leading-6">{benefit.text}</p></article>; })}</div>
      <div className="mt-6 flex flex-col gap-4 rounded-3xl bg-[var(--somos-off-white)] p-5 ring-1 ring-[var(--somos-navy)]/8 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div><p className="text-base font-bold text-[var(--somos-navy)]">¿Necesitas ayuda o quieres conocer Somos?</p><p className="somos-muted mt-1 text-sm font-medium">Escríbenos directamente al WhatsApp oficial.</p></div>
        <a href={buildSomosWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="somos-button-primary w-full shrink-0 sm:w-auto"><MessageCircle size={17} /> Contactar por WhatsApp</a>
      </div>
    </div></section>

    {affiliatedStores.length || transportAgencies.length ? <section className="bg-[var(--somos-teal)] py-14 text-white sm:py-20"><div className="vp-container">
      <SectionHeading light eyebrow="Red Somos" title="Comercios y empresas delivery en un mismo ecosistema" description="Perfiles reales y activos disponibles en la plataforma." />
      {affiliatedStores.length ? <div className="mt-8 overflow-hidden rounded-3xl bg-white p-4 text-[var(--somos-navy)]"><p className="px-2 text-sm font-semibold">Comercios afiliados</p><div className="vp-logo-marquee mt-3"><div className="vp-logo-marquee-track">{[...affiliatedStores, ...affiliatedStores].map((store, index) => <Link key={`${store.slug}-${index}`} href={`/${store.slug}`} className="flex min-w-44 items-center gap-3 rounded-2xl bg-[var(--somos-off-white)] p-3"><OptimizedImage src={store.imageUrl} alt={`Logo de ${store.name}`} width={44} height={44} sizes="44px" className="h-11 w-11 rounded-xl bg-white object-cover" /><span className="min-w-0"><span className="block truncate text-sm font-bold">{store.name}</span><span className="block text-xs font-medium text-[var(--somos-navy)]/60">{store.category}</span></span></Link>)}</div></div></div> : null}
      {transportAgencies.length ? <AffiliatedDeliveryLogos agencies={transportAgencies} className="mt-4 overflow-hidden rounded-3xl bg-white p-4 text-[var(--somos-navy)]" cardClassName="bg-[var(--somos-off-white)]" label="Empresas delivery afiliadas" /> : null}
    </div></section> : null}

    <section className="py-14 sm:py-20"><div className="vp-container grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
      <SectionHeading eyebrow="Marketplace" title="También puedes explorar comercios en Somos" description="Descubre catálogos activos y realiza pedidos desde comercios configurados en la plataforma." />
      <SurfaceCard className="flex flex-col items-start bg-white sm:p-7"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--somos-amber)]/20 text-[var(--somos-teal)]"><ShoppingBag size={22} /></span><p className="somos-muted mt-4 text-sm font-medium leading-6">Busca por comercio o rubro y entra directamente a su catálogo.</p><ButtonLink href="/marketplace" className="mt-5">Ver comercios <ArrowRight size={17} /></ButtonLink></SurfaceCard>
    </div></section>

    <section className="bg-[var(--somos-navy)] py-14 text-white sm:py-20"><div className="vp-container grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
      <div><p className="somos-badge somos-badge-light">Modelo simple para comercios</p><h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">Tu negocio, tus precios, tus pagos y tus clientes</h2><p className="mt-4 max-w-2xl text-base font-medium leading-7 text-white/70">Usa Somos sin pagar mensualidad ni entregar un porcentaje de tus ventas. Solo se agrega un fee fijo de $0.10 por pedido recibido.</p></div>
      <div className="rounded-3xl bg-white/8 p-6 ring-1 ring-white/10"><p className="text-sm font-semibold text-[var(--somos-amber)]">Pagas por resultado</p><div className="mt-2 flex items-end gap-2"><span className="text-5xl font-bold">$0.10</span><span className="pb-1 text-sm font-medium text-white/60">por pedido recibido</span></div><p className="mt-3 text-sm font-medium text-white/70">Sin mensualidades, contratos ni comisiones porcentuales.</p><ButtonLink href="/registro" variant="light" className="mt-6 w-full sm:w-fit">Registrar comercio <ArrowRight size={17} /></ButtonLink></div>
      <div className="overflow-hidden rounded-3xl border border-white/10 lg:col-span-2">
        <div className="grid grid-cols-2 border-b border-white/10 text-sm font-bold">
          <p className="bg-[var(--somos-teal)] p-4 text-[var(--somos-amber)] sm:px-6">Con Somos</p>
          <p className="p-4 text-white/60 sm:px-6">Otras apps</p>
        </div>
        {[
          ["Pagos directos a tu cuenta", "Pagos con intermediarios"],
          ["Sin comisión sobre la venta", "Comisión porcentual"],
          ["Tú decides quién asume el fee", "La plataforma define sus cargos"],
          ["Mantienes tus precios reales", "Puedes terminar subiendo precios"],
          ["Tus clientes siguen siendo tuyos", "La plataforma controla la relación"],
          ["WhatsApp como canal principal", "El cliente depende de otra app"],
        ].map(([somos, otrasApps]) => (
          <div key={somos} className="grid grid-cols-2 border-b border-white/10 last:border-0">
            <p className="flex gap-2 bg-[var(--somos-teal)]/55 p-4 text-sm font-medium leading-6 sm:px-6">
              <Check className="mt-1 shrink-0 text-[var(--somos-amber)]" size={16} />
              {somos}
            </p>
            <p className="p-4 text-sm font-medium leading-6 text-white/55 sm:px-6">{otrasApps}</p>
          </div>
        ))}
      </div>
    </div></section>

    <section className="bg-[var(--somos-orange)] py-14 sm:py-16"><div className="vp-container flex flex-col justify-between gap-7 lg:flex-row lg:items-center"><div><h2 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-[var(--somos-navy)] sm:text-4xl">Empieza a ordenar tu operación con Somos</h2><p className="mt-3 text-base font-medium text-[var(--somos-navy)]/70">Elige el camino que corresponde a tu operación.</p></div><div className="flex flex-col gap-3 sm:flex-row"><ButtonLink href="/registro" variant="light">Configurar comercio</ButtonLink><ButtonLink href="/transporte/registro" variant="secondary" className="bg-[var(--somos-navy)] text-white">Registrar empresa delivery</ButtonLink></div></div></section>

    <section className="bg-white py-7"><div className="vp-container flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-[var(--somos-navy)]">Acceso rápido en tu dispositivo</p><p className="somos-muted mt-1 text-sm font-medium">Puedes instalar Somos para abrirlo directamente desde tu pantalla de inicio.</p></div><PwaInstallButton /></div></section>
    <PublicFooter />
  </main>;
}
