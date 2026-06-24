import Link from "next/link";
import { Clock, MapPin, ShoppingBag, Star } from "lucide-react";
import type { Store } from "@/types";
import { BrandLogo } from "@/components/public/BrandLogo";

export function StoreHeader({ store }: { store: Store }) {
  const isOpen = store.openState?.isOpen !== false;

  return (
    <header className="relative overflow-hidden rounded-b-[38px] bg-[#2E3A79] text-white shadow-2xl shadow-[#2E3A79]/20">
      <div className="absolute inset-0">
        <img src={store.heroImageUrl} alt={store.name} className="h-full w-full object-cover opacity-22" decoding="async" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#151B4F]/70 via-[#2E3A79]/88 to-[#2E3A79]" />
      </div>

      <div className="relative vp-container py-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="rounded-full bg-white/12 px-3 py-2 text-xs font-black text-white backdrop-blur">Cambiar tienda</Link>
          <BrandLogo compact />
        </div>

        <div className="mt-8 max-w-2xl pb-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-2 text-xs font-black backdrop-blur">
            <Star size={14} className="text-[#FFB547]" /> {store.badge}
          </div>
          <div className={isOpen ? "mb-3 inline-flex rounded-full bg-green-100 px-3 py-2 text-xs font-black text-green-700" : "mb-3 inline-flex rounded-full bg-red-100 px-3 py-2 text-xs font-black text-red-700"}>
            {isOpen ? "Abierto ahora" : store.openState?.label || "Cerrado"}
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{store.name}</h1>
          <p className="mt-3 max-w-xl text-base font-semibold leading-relaxed text-white/82">{store.description}</p>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
              <Clock size={18} className="mb-1 text-[#FFB547]" />
              <p className="text-xs font-bold text-white/65">Horario</p>
              <p className="text-sm font-black">{store.openState?.label || store.openingHours}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
              <MapPin size={18} className="mb-1 text-[#FFB547]" />
              <p className="text-xs font-bold text-white/65">Delivery</p>
              <p className="text-sm font-black">{store.deliveryEstimate}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
              <ShoppingBag size={18} className="mb-1 text-[#FFB547]" />
              <p className="text-xs font-bold text-white/65">Retiro (pick up)</p>
              <p className="text-sm font-black">Disponible</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
