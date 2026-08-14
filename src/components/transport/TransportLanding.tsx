import { ArrowRight, Building2, CheckCircle2, ClipboardList, MapPinned, Truck } from "lucide-react";
import { AffiliatedDeliveryLogos } from "@/components/public/AffiliatedDeliveryLogos";
import { ButtonLink } from "@/components/public/ButtonLink";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";
import { SectionHeading } from "@/components/public/SectionHeading";
import { SurfaceCard } from "@/components/public/SurfaceCard";
import type { PublicTransportAgencyLogo } from "@/lib/transport";

const steps = [
  { title: "Registra tu empresa", text: "Completa los datos de contacto y acceso para enviar tu solicitud." },
  { title: "Somos revisa", text: "Validamos la información antes de mostrar tu empresa a los comercios." },
  { title: "Configura tu operación", text: "Define tarifas, cobertura y datos operativos desde tu panel." },
];

const capabilities = [
  { icon: Building2, title: "Afiliación controlada", text: "Cada comercio solicita afiliación y la empresa delivery decide si la aprueba." },
  { icon: MapPinned, title: "Cobertura configurable", text: "Define rangos de kilómetros, tarifas y distancia máxima de cobertura." },
  { icon: ClipboardList, title: "Solicitudes organizadas", text: "Consulta comercios afiliados y servicios recibidos desde el panel." },
];

export function TransportLanding({ transportAgencies = [] }: { transportAgencies?: PublicTransportAgencyLogo[] }) {
  return <main className="somos-page">
    <PublicHeader primaryHref="/transporte/registro" primaryLabel="Registrar empresa delivery" accessHref="/transporte/panel" accessLabel="Entrar al panel" />

    <section className="overflow-hidden bg-[var(--somos-teal)] text-white">
      <div className="vp-container grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
        <div>
          <p className="somos-badge somos-badge-light">Para empresas delivery</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.03] tracking-[-0.04em] sm:text-6xl">Conecta con comercios y organiza tu operación.</h1>
          <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-white/70">Configura tarifas, cobertura y datos operativos para que los comercios puedan solicitar afiliación a tu empresa.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/transporte/registro" variant="light">Registrar empresa delivery <ArrowRight size={17} /></ButtonLink>
            <ButtonLink href="/transporte/panel" variant="secondary" className="border-white/20 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]">Entrar al panel</ButtonLink>
          </div>
        </div>
        <SurfaceCard className="p-5 sm:p-7">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--somos-orange)] text-[var(--somos-navy)]"><Truck size={27} /></span>
          <div className="mt-5 grid gap-3">{steps.map((step, index) => <div key={step.title} className="rounded-2xl bg-[var(--somos-off-white)] p-4"><p className="text-xs font-semibold text-[var(--somos-orange)]">Paso {index + 1}</p><h2 className="mt-1 text-lg font-bold text-[var(--somos-navy)]">{step.title}</h2><p className="somos-muted mt-1 text-sm font-medium leading-6">{step.text}</p></div>)}</div>
        </SurfaceCard>
      </div>
    </section>

    <section className="bg-white py-14 sm:py-20"><div className="vp-container">
      <SectionHeading eyebrow="Operación clara" title="Lo necesario para trabajar con comercios" description="Una configuración sencilla para presentar tu empresa, definir cómo trabajas y organizar las solicitudes de afiliación." />
      <div className="mt-8 grid gap-4 md:grid-cols-3">{capabilities.map((item) => { const Icon = item.icon; return <SurfaceCard key={item.title} className="p-6"><Icon size={23} className="text-[var(--somos-orange)]" /><h3 className="mt-4 text-xl font-bold text-[var(--somos-navy)]">{item.title}</h3><p className="somos-muted mt-2 text-sm font-medium leading-6">{item.text}</p></SurfaceCard>; })}</div>
    </div></section>

    <section className="py-14 sm:py-20"><div className="vp-container">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><SectionHeading eyebrow="Red activa" title="Empresas delivery afiliadas" description="Perfiles activos disponibles para que los comercios conozcan sus datos y soliciten afiliación." /><CheckCircle2 className="hidden text-[var(--somos-teal)] md:block" size={34} /></div>
      <div className="mt-7 overflow-hidden rounded-3xl bg-white p-4 ring-1 ring-[var(--somos-navy)]/8"><AffiliatedDeliveryLogos agencies={transportAgencies} cardClassName="bg-[var(--somos-off-white)]" emptyMessage="Pronto verás aquí las empresas delivery activas de la red Somos." /></div>
    </div></section>

    <section className="bg-[var(--somos-orange)] py-14"><div className="vp-container flex flex-col justify-between gap-6 lg:flex-row lg:items-center"><div><h2 className="text-3xl font-bold tracking-tight text-[var(--somos-navy)]">Prepara el perfil de tu empresa delivery</h2><p className="mt-2 text-base font-medium text-[var(--somos-navy)]/70">Completa el registro para iniciar el proceso de revisión.</p></div><ButtonLink href="/transporte/registro" variant="light">Registrar empresa delivery <ArrowRight size={17} /></ButtonLink></div></section>
    <PublicFooter text="Empresas delivery y comercios conectados con reglas claras de cobertura y tarifas." />
  </main>;
}
