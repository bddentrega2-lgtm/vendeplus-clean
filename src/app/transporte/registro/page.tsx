import { PublicHeader } from "@/components/public/PublicHeader";
import { TransportRegistrationForm } from "@/components/transport/TransportRegistrationForm";

export default function TransporteRegistroPage() {
  return (
    <main className="somos-page">
      <PublicHeader primaryHref="/transporte" primaryLabel="Conocer transporte" accessHref="/transporte/panel" accessLabel="Entrar al panel" showNavigation={false} />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <header className="mb-7">
          <p className="somos-badge">
            Registro de empresa delivery
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-[var(--somos-navy)] sm:text-5xl">Postula tu empresa delivery</h1>
          <p className="somos-muted mt-3 max-w-2xl text-base font-medium leading-7">
            Somos revisa cada empresa delivery antes de mostrarla a los comercios afiliados.
          </p>
        </header>
        <TransportRegistrationForm />
      </div>
    </main>
  );
}
