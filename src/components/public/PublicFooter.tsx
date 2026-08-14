import Link from "next/link";
import { BrandLogo } from "@/components/public/BrandLogo";

export function PublicFooter({
  text = "Comercios y empresas delivery conectados en una operación más clara.",
}: {
  text?: string;
}) {
  return (
    <footer className="bg-[var(--somos-navy)] py-9 text-white">
      <div className="vp-container flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
        <div>
          <BrandLogo variant="white" size="md" />
          <p className="mt-4 max-w-md text-sm font-medium leading-6 text-white/65">{text}</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-white/75">
          <Link href="/registro">Registrar comercio</Link>
          <Link href="/transporte/registro">Registrar empresa delivery</Link>
          <Link href="/marketplace">Ver comercios</Link>
        </div>
      </div>
    </footer>
  );
}
