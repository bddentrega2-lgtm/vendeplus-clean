import Link from "next/link";
import { TransportRegistrationForm } from "@/components/transport/TransportRegistrationForm";

export const dynamic = "force-dynamic";

export default function TransporteRegistroPage() {
  return (
    <main className="min-h-screen bg-[#F8F3E8] px-4 py-8 text-[#25262B]">
      <div className="mx-auto max-w-4xl">
        <Link href="/transporte" className="text-sm font-black text-[#2E3A79]">
          VendeMas Transporte
        </Link>
        <header className="mt-8 mb-5">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2E3A79]">
            Registro de empresa delivery
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Postula tu empresa delivery</h1>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-relaxed text-[#746f69]">
            VendeMas revisa cada empresa delivery antes de mostrarla a los comercios afiliados.
          </p>
        </header>
        <TransportRegistrationForm />
      </div>
    </main>
  );
}
