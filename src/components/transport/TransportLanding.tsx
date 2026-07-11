import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, ClipboardList, Truck } from "lucide-react";

const steps = [
  { title: "Afiliate gratis", text: "Registra datos, cobertura, modalidad y tarifa base sin costo inicial." },
  { title: "VendeMas revisa", text: "Validamos la informacion antes de mostrar tu empresa a comercios." },
  { title: "Gana por referir", text: "Obtén beneficios por referir comercios a VendeMas." },
];

export function TransportLanding() {
  return (
    <main className="min-h-screen bg-[#F8F3E8] text-[#25262B]">
      <section className="mx-auto grid min-h-[88vh] w-full max-w-6xl content-center gap-8 px-4 py-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div>
          <Link href="/" className="text-sm font-black text-[#2E3A79]">
            VendeMas
          </Link>
          <p className="mt-10 text-sm font-black uppercase tracking-[0.18em] text-[#2E3A79]">
            Red de empresas delivery
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
            Transporte afiliado para comercios que venden por WhatsApp
          </h1>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-[#746f69]">
            Conecta tu empresa delivery con restaurantes, tiendas y emprendimientos que necesitan delivery
            claro, tarifas visibles y pedidos organizados desde VendeMas.
          </p>
          <p className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#2E3A79] ring-1 ring-[#25262B]/10">
            Afiliate gratis y obtén beneficios por referir comercios.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/transporte/registro"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
            >
              Afiliar empresa gratis
              <ArrowRight size={17} />
            </Link>
            <Link
              href="/transporte/panel"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-4 text-sm font-black text-[#2E3A79] ring-1 ring-[#25262B]/10"
            >
              Panel de empresa delivery
            </Link>
          </div>
        </div>

        <div className="rounded-[36px] bg-white p-5 shadow-2xl shadow-[#25262B]/10 ring-1 ring-[#25262B]/10">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
            <Truck size={28} />
          </div>
          <div className="mt-5 grid gap-3">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-3xl bg-[#F8F3E8] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                  Paso {index + 1}
                </p>
                <h2 className="mt-1 text-lg font-black">{step.title}</h2>
                <p className="mt-1 text-sm font-bold text-[#746f69]">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#25262B]/10 bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 md:grid-cols-3">
          {[
            { icon: Building2, title: "Afiliacion controlada", text: "Cada comercio solicita y la empresa delivery aprueba." },
            { icon: ClipboardList, title: "Control total de cada pedido", text: "Cada entrega queda organizada con comercio, cliente, tarifa y estado." },
            { icon: CheckCircle2, title: "Operacion bajo control", text: "Tu empresa puede organizar solicitudes, comercios afiliados y servicios recibidos." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-3xl bg-[#F8F3E8] p-5">
                <Icon size={22} className="text-[#2E3A79]" />
                <h3 className="mt-3 text-lg font-black">{item.title}</h3>
                <p className="mt-1 text-sm font-bold text-[#746f69]">{item.text}</p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
