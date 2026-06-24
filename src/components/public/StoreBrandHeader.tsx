import { Clock, MessageCircle, ShoppingBag } from "lucide-react";
import type { Store } from "@/types";

type BrandedStore = Store & {
  logoUrl?: string;
  coverImageUrl?: string;
  heroImageUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  buttonTextColor?: string;
  openingHours?: string;
  category?: string;
  acceptsDelivery?: boolean;
  acceptsPickup?: boolean;
};

export function StoreBrandHeader({ store }: { store: BrandedStore }) {
  const coverImage =
    store.coverImageUrl ||
    store.heroImageUrl ||
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=1600&auto=format&fit=crop";

  const primaryColor = store.primaryColor || "#2E3A79";
  const accentColor = store.accentColor || "#FFB547";
  const whatsappUrl = store.whatsappPhone
    ? `https://wa.me/${store.whatsappPhone}`
    : "";

  return (
    <section className="mx-auto mb-5 max-w-6xl px-4 pt-4">
      <div className="relative overflow-hidden rounded-[36px] bg-[#25262B] shadow-2xl shadow-[#2E3A79]/20">
        <img
          src={coverImage}
          alt={store.name}
          className="h-64 w-full object-cover md:h-72"
          decoding="async"
          fetchPriority="high"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/40 to-black/10" />

        <div className="absolute bottom-0 left-0 right-0 p-5 text-white md:p-7">
          <div className="flex items-end gap-4">
            {store.logoUrl ? (
              <img
                src={store.logoUrl}
                alt={`${store.name} logo`}
                className="h-20 w-20 rounded-3xl border-4 border-white bg-white object-cover shadow-xl"
                decoding="async"
              />
            ) : (
              <div
                className="grid h-20 w-20 place-items-center rounded-3xl border-4 border-white text-3xl font-black shadow-xl"
                style={{
                  backgroundColor: primaryColor,
                  color: accentColor,
                }}
              >
                {store.name.slice(0, 1)}
              </div>
            )}

            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">
                {store.category || "Comercio aliado"}
              </p>
              <h1 className="mt-1 text-3xl font-black leading-tight md:text-5xl">
                {store.name}
              </h1>
              <p className="mt-1 text-sm font-bold text-white/80">
                {store.openingHours || "Disponible hoy"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-2 text-xs font-black backdrop-blur">
              <ShoppingBag size={15} className="text-[#FFB547]" />
              Delivery {store.deliveryEstimate || "disponible"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-2 text-xs font-black backdrop-blur">
              <Clock size={15} className="text-[#FFB547]" />
              Retiro (pick up) disponible
            </span>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#FFB547] px-3 py-2 text-xs font-black text-[#25262B]"
              >
                <MessageCircle size={15} />
                Consultar por WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
