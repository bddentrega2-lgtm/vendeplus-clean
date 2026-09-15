import Link from "next/link";
import { BrandLogo } from "@/components/public/BrandLogo";
import { PublicShareActions } from "@/components/public/PublicShareActions";

export function PublicFooter({
  text = "Comercios y empresas delivery conectados en una operacion mas clara.",
  shareTitle,
  shareText,
  whatsappMessage,
}: {
  text?: string;
  shareTitle?: string;
  shareText?: string;
  whatsappMessage?: string;
}) {
  return (
    <footer className="bg-[var(--somos-navy)] py-9 text-white">
      <div className="vp-container flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
        <div>
          <BrandLogo variant="white" size="md" />
          <p className="mt-4 max-w-md text-sm font-medium leading-6 text-white/65">{text}</p>
        </div>
        <div className="flex flex-col gap-4 sm:items-end">
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-white/75 sm:justify-end">
            <Link href="/registro">Registrar comercio</Link>
            <Link href="/transporte/registro">Registrar empresa delivery</Link>
            <Link href="/marketplace">Ver comercios</Link>
          </div>
          {shareTitle && shareText ? (
            <PublicShareActions
              shareTitle={shareTitle}
              shareText={shareText}
              whatsappMessage={whatsappMessage}
              className="sm:justify-end"
            />
          ) : null}
        </div>
      </div>
    </footer>
  );
}
