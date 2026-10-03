import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useNativeApp, useNativeBackLayer } from "@/hooks/use-native-app";
import { writeMobile } from "@/lib/mobile/state";
import { LogoutButton } from "@/components/panel/LogoutButton";
import { getPanelAuthHeaders } from "@/lib/panel/client-auth";
import { fetchPanelJson } from "@/lib/panel/client-fetch-cache";
import { OnboardingTour } from "@/components/panel/OnboardingTour";
import { PanelStoreIdentity } from "@/components/panel/PanelStoreIdentity";
import { PanelStoreSelector } from "@/components/panel/PanelStoreSelector";
import { PanelNotifications } from "@/components/panel/PanelNotifications";
import { usePanelAuth } from "@/components/panel/PanelAuthProvider";
import { PwaInstallButton } from "@/components/pwa/PwaInstallButton";
import { BrandLogo } from "@/components/public/BrandLogo";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  ContactRound,
  CreditCard,
  LayoutDashboard,
  Menu,
  KeyRound,
  ListPlus,
  Printer,
  Settings,
  Sparkles,
  Trophy,
  Tags,
  Trash2,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";

const navItems = [
  { href: "/panel", label: "Inicio", icon: LayoutDashboard },
  { href: "/panel/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/panel/mesas", label: "Mesa / Barra", icon: UtensilsCrossed, premiumFeature: "table_orders" },
  { href: "/panel/logros", label: "Logros", icon: Trophy, featured: true },
  { href: "/panel/productos", label: "Productos", icon: Boxes },
  { href: "/panel/catalogo", label: "Categorías", icon: Tags },
  { href: "/panel/opciones", label: "Variantes o adicionales", icon: ListPlus },
  { href: "/panel/delivery", label: "Delivery", icon: Truck },
  { href: "/panel/clientes", label: "Clientes", icon: ContactRound },
  { href: "/panel/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/panel/impresion", label: "Impresión", icon: Printer, nativeOnly: true },
  { href: "/panel/configuracion", label: "Configuración", icon: Settings },
  { href: "/panel/suscripcion", label: "Suscripción", icon: CreditCard },
];

const routeDataUrls: Record<string, string> = {
  "/panel/pedidos": "/api/panel/orders?date=today&compact=true&limit=40",
  "/panel/clientes": "/api/panel/customers?limit=80&offset=0",
  "/panel/estadisticas": "/api/panel/stats?range=last_7_days",
};

async function prefetchRouteData(href: string) {
  const url = routeDataUrls[href];
  if (!url) return;

  try {
    await fetchPanelJson(url, { headers: await getPanelAuthHeaders() }, 30_000);
  } catch {
    // La pantalla manejará cualquier error cuando haga su solicitud normal.
  }
}

export function PanelShell({
  children,
  title,
  subtitle,
  active,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  active: string;
}) {
  const { accountId, selectedStoreId, selectedStore, stores } = usePanelAuth();
  const isNativeApp = useNativeApp();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const sheetTouchStartY = useRef<number | null>(null);
  useNativeBackLayer(isMoreOpen, () => setIsMoreOpen(false));
  useEffect(() => {
    if (!isMoreOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMoreOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMoreOpen]);
  const visibleNavItems = navItems.filter(
    (item) =>
      (!item.nativeOnly || isNativeApp) &&
      (!item.premiumFeature || selectedStore?.table_orders_access_enabled === true)
  );

  return (
    <main className="min-h-screen bg-[#F8F3E8] text-[#25262B]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px]">
        <aside className={`sticky top-0 hidden h-screen w-72 shrink-0 self-start overflow-y-auto border-r border-[#25262B]/10 bg-white/70 p-5 backdrop-blur-xl ${isNativeApp ? "" : "lg:block"}`}>
          <Link href="/panel" className="flex items-center gap-3">
            <div>
              <BrandLogo size="sm" priority />
              <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.18em] text-[#746f69]">
                Panel
              </p>
            </div>
          </Link>

          <nav className="mt-8 space-y-2">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.href;
              const isFeatured = Boolean(item.featured);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onPointerEnter={() => void prefetchRouteData(item.href)}
                  onTouchStart={() => void prefetchRouteData(item.href)}
                  className={[
                    "flex items-center gap-3 rounded-3xl px-4 py-3 text-sm font-black transition",
                    isActive
                      ? "bg-[#2E3A79] text-white shadow-xl shadow-[#2E3A79]/20"
                      : isFeatured
                        ? "relative overflow-hidden bg-gradient-to-r from-[#FFF0C9] to-[#FFB547] text-[#2E3A79] shadow-lg shadow-[#FFB547]/30 ring-1 ring-[#FFB547] hover:-translate-y-0.5"
                        : "text-[#746f69] hover:bg-[#F8F3E8] hover:text-[#25262B]",
                  ].join(" ")}
                >
                  <Icon size={18} />
                  {item.label}
                  {isFeatured && !isActive ? <Sparkles size={15} className="ml-auto animate-pulse" aria-hidden="true" /> : null}
                </Link>
              );
            })}
          </nav>

          <PanelStoreIdentity />

          <div className="mt-4 rounded-[26px] bg-[#F8F3E8] p-3 ring-1 ring-[#25262B]/[0.06]">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
              Acceso rápido
            </p>
            <PwaInstallButton compact label="Descargar app" />
          </div>

          <div className="mt-4">
            <LogoutButton />
          </div>
          <Link href="/eliminar-cuenta" className="mt-3 flex min-h-10 items-center gap-2 px-2 text-xs font-bold text-[#9B2132]"><Trash2 size={16} />Gestionar eliminacion de cuenta</Link>
        </aside>

        <section className={`flex-1 px-4 py-5 sm:px-6 lg:px-8 ${isNativeApp ? "native-panel-workspace min-w-0 px-0 pb-28 pt-0" : ""}`}>
          <header className={isNativeApp ? "sticky top-0 z-30 border-b border-white/10 bg-[#1F464C] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] text-white shadow-md" : "rounded-[36px] bg-[#2E3A79] p-6 text-white shadow-2xl shadow-[#2E3A79]/20"}>
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div className="min-w-0">
                <h1 className={isNativeApp ? "text-xl font-black" : "text-3xl font-black tracking-tight sm:text-5xl"}>
                  {title}
                </h1>
                {subtitle && !isNativeApp ? (
                  <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-white/75 sm:text-base">
                    {subtitle}
                  </p>
                ) : null}
                </div>
                <PanelNotifications key={`${accountId}:${selectedStoreId}`} />
              </div>

              <div className={`flex flex-col gap-3 sm:flex-row md:items-center ${isNativeApp ? "hidden" : ""}`}>
                <Link
                  href="/panel/update-password"
                  aria-label="Cambiar contraseña"
                  title="Cambiar contraseña"
                  className={[
                    "grid h-11 w-11 shrink-0 place-items-center self-end rounded-2xl transition sm:self-auto",
                    active === "/panel/update-password"
                      ? "bg-[#FFB547] text-[#25262B]"
                      : "bg-white/10 text-white hover:bg-white/20",
                  ].join(" ")}
                >
                  <KeyRound size={18} />
                </Link>
                <PanelStoreSelector />
                <div className="md:hidden">
                  <PwaInstallButton compact label="Descargar app" />
                </div>
              </div>
            </div>
          </header>
          {isNativeApp ? <div className="native-business-context"><div>{stores.length > 1 ? <PanelStoreSelector /> : <span>{selectedStore?.name || "Mi negocio"}</span>}</div><Link href="/marketplace" onClick={() => writeMobile("space", "buy")}>Comprar</Link>{selectedStore?.table_orders_access_enabled ? <Link href="/panel/mesas" title="Mesa / Barra" aria-label="Mesa / Barra"><UtensilsCrossed size={18} /></Link> : null}</div> : null}

          <div className={`mt-5 grid grid-cols-2 gap-3 lg:hidden ${isNativeApp ? "hidden" : ""}`}>
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.href;
              const isFeatured = Boolean(item.featured);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onPointerEnter={() => void prefetchRouteData(item.href)}
                  onTouchStart={() => void prefetchRouteData(item.href)}
                  className={[
                    "group flex items-center gap-3 rounded-[24px] p-4 text-sm font-black shadow-lg shadow-[#2E3A79]/[0.05] ring-1 ring-[#25262B]/[0.06] transition hover:-translate-y-0.5",
                    isActive
                      ? "bg-[#2E3A79] text-white"
                      : isFeatured
                        ? "bg-gradient-to-br from-[#FFF0C9] to-[#FFB547] text-[#2E3A79] ring-[#FFB547] shadow-[#FFB547]/25"
                        : "bg-white text-[#746f69] hover:text-[#25262B]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition",
                      isActive
                        ? "bg-white/15 text-[#FFB547]"
                        : isFeatured
                          ? "bg-white/70 text-[#2E3A79]"
                          : "bg-[#F8F3E8] text-[#2E3A79] group-hover:bg-[#FFB547] group-hover:text-[#25262B]",
                    ].join(" ")}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 break-words leading-tight [overflow-wrap:anywhere]">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className={`mt-4 lg:hidden ${isNativeApp ? "hidden" : ""}`}><LogoutButton /></div>
          <div className={isNativeApp ? "native-panel-content mt-0" : "mt-6"}>{children}</div>
        </section>
      </div>
      {isNativeApp ? (
        <>
          {isMoreOpen ? (
            <div className="fixed inset-0 z-[60] bg-black/45" onClick={() => setIsMoreOpen(false)} role="presentation">
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Mas opciones"
                className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="relative mb-3 flex min-h-10 items-center justify-center" onTouchStart={(event) => { sheetTouchStartY.current = event.touches[0]?.clientY ?? null; }} onTouchEnd={(event) => { const start = sheetTouchStartY.current; sheetTouchStartY.current = null; if (start !== null && (event.changedTouches[0]?.clientY ?? start) - start > 70) setIsMoreOpen(false); }}>
                  <div className="h-1 w-10 rounded-full bg-[#25262B]/20" aria-hidden="true" />
                  <button type="button" onClick={() => setIsMoreOpen(false)} aria-label="Cerrar menu" className="absolute right-0 grid h-10 w-10 place-items-center rounded-full bg-[#F1F4F3] text-[#1F464C] active:scale-90"><X size={20} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {visibleNavItems.filter((item) => !["/panel", "/panel/pedidos", "/panel/productos"].includes(item.href)).map((item) => {
                    const Icon = item.icon;
                    return <Link key={item.href} href={item.href} onClick={() => setIsMoreOpen(false)} className="flex min-h-14 items-center gap-3 rounded-lg bg-[#F5F7F7] px-3 text-sm font-black text-[#1F464C]"><Icon size={19} />{item.label}</Link>;
                  })}
                </div>
                <Link href="/panel/update-password" onClick={() => setIsMoreOpen(false)} className="mt-3 flex min-h-12 items-center gap-3 text-sm font-bold"><KeyRound size={19} />Cambiar contraseña</Link>
                <Link href="/eliminar-cuenta" onClick={() => setIsMoreOpen(false)} className="flex min-h-12 items-center gap-3 text-sm font-bold text-[#9B2132]"><Trash2 size={19} />Eliminar cuenta</Link>
                <div className="mt-3"><LogoutButton /></div>
              </div>
            </div>
          ) : null}
          <nav aria-label="Mi negocio" className="native-business-nav fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-[#25262B]/10 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
            {[
              { href: "/panel/pedidos", label: "Pedidos", icon: ClipboardList },
              { href: "/panel/productos", label: "Productos", icon: Boxes },
              { href: "/panel", label: "Resumen", icon: LayoutDashboard },
            ].map((item) => {
              const Icon = item.icon;
              const selected = active === item.href;
              return <Link key={item.href} href={item.href} aria-current={selected ? "page" : undefined} className={`flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-black ${selected ? "text-[#E95F32]" : "text-[#667575]"}`}><Icon size={21} strokeWidth={selected ? 2.8 : 2} />{item.label}</Link>;
            })}
            <button type="button" aria-expanded={isMoreOpen} onClick={() => setIsMoreOpen((open) => !open)} className="flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-black text-[#667575]"><Menu size={21} />Negocio</button>
          </nav>
        </>
      ) : null}
      <OnboardingTour />
    </main>
  );
}


