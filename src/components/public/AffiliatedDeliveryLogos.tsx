import Link from "next/link";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import type { PublicTransportAgencyLogo } from "@/lib/transport";

type AffiliatedDeliveryLogosProps = {
  agencies?: PublicTransportAgencyLogo[];
  className?: string;
  cardClassName?: string;
  label?: string;
  emptyMessage?: string;
};

export function AffiliatedDeliveryLogos({
  agencies = [],
  className = "",
  cardClassName = "bg-[#F6F4EF]",
  label = "Empresas delivery afiliadas",
  emptyMessage,
}: AffiliatedDeliveryLogosProps) {
  if (!agencies.length) {
    if (!emptyMessage) return null;

    return (
      <div className={className}>
        <p className="px-2 text-xs font-black uppercase tracking-[0.16em] text-[#5F635E]">
          {label}
        </p>
        <div className="mt-3 rounded-2xl bg-white/80 p-4 text-sm font-bold text-[#5F635E] ring-1 ring-[#25262B]/[0.06]">
          {emptyMessage}
        </div>
      </div>
    );
  }

  const marqueeAgencies = agencies.length > 1 ? [...agencies, ...agencies] : agencies;

  return (
    <div className={className}>
      <p className="px-2 text-xs font-black uppercase tracking-[0.16em] text-[#5F635E]">
        {label}
      </p>
      <div className="vp-logo-marquee mt-3">
        <div className="vp-logo-marquee-track">
          {marqueeAgencies.map((agency, index) => (
            <Link
              key={`${agency.id}-${index}`}
              href={`/transporte/${agency.slug}/marketplace`}
              className={`flex min-w-[190px] items-center gap-3 rounded-2xl p-3 ring-1 ring-[#25262B]/[0.06] ${cardClassName}`}
            >
              <OptimizedImage
                src={agency.logoUrl}
                alt={`${agency.name} logo`}
                width={44}
                height={44}
                sizes="44px"
                className="h-11 w-11 shrink-0 rounded-2xl bg-white object-cover ring-1 ring-[#25262B]/10"
                fallback={
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2E3A79] text-sm font-black text-[#FFB547]">
                    {agency.initials}
                  </span>
                }
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{agency.name}</span>
                <span className="block truncate text-[11px] font-black text-[#5F635E]">
                  {agency.city || agency.state || "Delivery afiliado"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
