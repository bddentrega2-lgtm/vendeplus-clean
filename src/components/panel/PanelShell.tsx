import Link from "next/link";
import { LogoutButton } from "@/components/panel/LogoutButton";
import { getPanelAuthHeaders } from "@/lib/panel/client-auth";
import { fetchPanelJson } from "@/lib/panel/client-fetch-cache";
import { OnboardingTour } from "@/components/panel/OnboardingTour";
import { PanelStoreIdentity } from "@/components/panel/PanelStoreIdentity";
import { PanelStoreSelector } from "@/components/panel/PanelStoreSelector";
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
  KeyRound,
  ListPlus,
  Settings,
  Sparkles,
  Trophy,
  Tags,
  Truck,
  UtensilsCrossed,
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
  { href: "/panel/configuracion", label: "Configuración", icon: Settings },
  { href: "/panel/update-password", label: "Contraseña", icon: KeyRound },
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
  const { selectedStore } = usePanelAuth();
  const visibleNavItems = navItems.filter(
    (item) => !item.premiumFeature || selectedStore?.table_orders_access_enabled === true
  );

  return (
    <main className="min-h-screen bg-[#F8F3E8] text-[#25262B]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px]">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 self-start overflow-y-auto border-r border-[#25262B]/10 bg-white/70 p-5 backdrop-blur-xl lg:block">
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
        </aside>

        <section className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <header className="rounded-[36px] bg-[#2E3A79] p-6 text-white shadow-2xl shadow-[#2E3A79]/20">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-white/75 sm:text-base">
                    {subtitle}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row md:items-center">
                <PanelStoreSelector />
                <div className="md:hidden">
                  <PwaInstallButton compact label="Descargar app" />
                </div>
              </div>
            </div>
          </header>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:hidden">
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
                  <span className="leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 lg:hidden"><LogoutButton /></div>
          <div className="mt-6">{children}</div>
        </section>
      </div>
      <OnboardingTour />
    </main>
  );
}


