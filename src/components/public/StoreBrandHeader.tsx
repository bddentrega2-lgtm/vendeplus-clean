import type { Store } from "@/types";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

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

  const primaryColor = store.primaryColor || "#1F464C";
  const accentColor = store.accentColor || "#F27533";
  const logoFallback = (
    <div
      className="grid h-20 w-20 place-items-center rounded-3xl border-4 border-white text-3xl font-black shadow-xl"
      style={{
        backgroundColor: primaryColor,
        color: accentColor,
      }}
    >
      {store.name.slice(0, 1)}
    </div>
  );

  return (
    <section className="mx-auto mb-5 max-w-6xl px-4 pt-4">
      <div className="relative h-64 overflow-hidden rounded-[36px] bg-[#25262B] shadow-2xl shadow-[#2E3A79]/20 md:h-72">
        <OptimizedImage
          src={coverImage}
          alt={store.name}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1152px"
          className="object-cover"
          fallback={<div className="h-full w-full bg-[#25262B]" />}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/40 to-black/10" />

        <div className="absolute bottom-0 left-0 right-0 p-5 text-white md:p-7">
          <div className="flex items-end gap-4">
            {store.logoUrl ? (
              <OptimizedImage
                src={store.logoUrl}
                alt={`${store.name} logo`}
                width={80}
                height={80}
                sizes="80px"
                className="h-20 w-20 rounded-3xl border-4 border-white bg-white object-cover shadow-xl"
                fallback={logoFallback}
              />
            ) : (
              logoFallback
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

        </div>
      </div>
    </section>
  );
}
