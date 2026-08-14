import Link from "next/link";
import { BrandLogo } from "@/components/public/BrandLogo";
import { ButtonLink } from "@/components/public/ButtonLink";

export function PublicHeader({
  primaryHref = "/registro",
  primaryLabel = "Registrar comercio",
  primaryMobileLabel = "Registrar",
  accessHref = "/panel/login",
  accessLabel = "Iniciar sesión",
  showNavigation = true,
}: {
  primaryHref?: string;
  primaryLabel?: string;
  primaryMobileLabel?: string;
  accessHref?: string;
  accessLabel?: string;
  showNavigation?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--somos-navy)]/8 bg-[var(--somos-off-white)]/95 backdrop-blur-xl">
      <nav className="vp-container flex min-h-16 items-center justify-between gap-3 py-2.5">
        <Link href="/" aria-label="Ir al inicio de Somos" className="shrink-0">
          <BrandLogo size="sm" priority />
        </Link>
        {showNavigation ? (
          <div className="hidden items-center gap-6 text-sm font-semibold text-[var(--somos-teal)] lg:flex">
            <Link href="/#soluciones">Soluciones</Link>
            <Link href="/transporte">Empresas delivery</Link>
            <Link href="/marketplace">Marketplace</Link>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Link href={accessHref} className="inline-flex whitespace-nowrap rounded-full px-2 py-2.5 text-xs font-semibold text-[var(--somos-teal)] sm:px-3 sm:text-sm">
            {accessLabel}
          </Link>
          <ButtonLink href={primaryHref} className="px-4 py-2.5 text-xs sm:text-sm">
            <span className="sm:hidden">{primaryMobileLabel}</span>
            <span className="hidden sm:inline">{primaryLabel}</span>
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}
