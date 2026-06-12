import Link from "next/link";
import { ArrowRight, MapPin, MessageCircle, Navigation, ShoppingCart } from "lucide-react";
import type { Store } from "@/types";
import { BrandLogo } from "@/components/public/BrandLogo";

export function HomeClient({ stores }: { stores: Store[] }) {
  return (
    <main className="vp-container py-8">
      <section className="relative overflow-hidden rounded-[40px] bg-[#2E3A79] p-6 text-white shadow-2xl shadow-[#2E3A79]/20 sm:p-10">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[#FFB547]/25 blur-2xl" />
        <div className="absolute -bottom-14 -left-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <BrandLogo />
          <h1 className="mt-8 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">Vende más. Cobra mejor. Gestiona tus entregas.</h1>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-white/76">
            Catálogos inteligentes para comercios: productos, carrito, checkout, ubicación GPS, cálculo de entrega y pedido directo a WhatsApp.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-white/10 p-4 backdrop-blur"><ShoppingCart className="text-[#FFB547]" /><p className="mt-2 font-black">Compra fácil</p></div>
            <div className="rounded-3xl bg-white/10 p-4 backdrop-blur"><Navigation className="text-[#FFB547]" /><p className="mt-2 font-black">GPS + mapa</p></div>
            <div className="rounded-3xl bg-white/10 p-4 backdrop-blur"><MessageCircle className="text-[#FFB547]" /><p className="mt-2 font-black">WhatsApp listo</p></div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">Comercios activos</p>
            <h2 className="text-3xl font-black text-[#25262B]">Elige una tienda</h2>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {stores.map((store) => (
            <Link key={store.id} href={`/${store.slug}`} className="group overflow-hidden rounded-[34px] bg-white shadow-xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.07] transition hover:-translate-y-1">
              <div className="relative h-48 overflow-hidden">
                <img src={store.heroImageUrl} alt={store.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#25262B]/70 via-transparent to-transparent" />
                <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-2 text-xs font-black text-[#2E3A79]">{store.badge}</span>
              </div>
              <div className="p-5">
                <h3 className="text-2xl font-black text-[#25262B]">{store.name}</h3>
                <p className="mt-2 line-clamp-2 text-sm font-bold leading-relaxed text-[#746f69]">{store.description}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1 text-xs font-black text-[#746f69]"><MapPin size={14} /> {store.deliveryEstimate}</span>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#FFB547] text-[#25262B]"><ArrowRight size={18} /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
