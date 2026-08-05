import Link from "next/link";
import { LogoutButton } from "@/components/panel/LogoutButton";
import { OnboardingTour } from "@/components/panel/OnboardingTour";
import { PanelStoreIdentity } from "@/components/panel/PanelStoreIdentity";
import { PanelStoreSwitcher } from "@/components/panel/PanelStoreSwitcher";
import { PwaInstallButton } from "@/components/pwa/PwaInstallButton";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  ContactRound,
  CreditCard,
  LayoutDashboard,
  ListPlus,
  Settings,
  Sparkles,
  Tags,
  Truck,
} from "lucide-react";

const navItems = [
  { href: "/panel", label: "Inicio", icon: LayoutDashboard },
  { href: "/panel/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/panel/productos", label: "Productos", icon: Boxes },
  { href: "/panel/catalogo", label: "Categorías", icon: Tags },
  { href: "/panel/opciones", label: "Variantes o adicionales", icon: ListPlus },
  { href: "/panel/delivery", label: "Delivery", icon: Truck },
  { href: "/panel/clientes", label: "Clientes", icon: ContactRound },
  { href: "/panel/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/panel/configuracion", label: "Configuración", icon: Settings },
  { href: "/panel/suscripcion", label: "Suscripción", icon: CreditCard },
];

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
  return (
    <main className="min-h-screen bg-[#F8F3E8] text-[#25262B]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px]">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 self-start overflow-y-auto border-r border-[#25262B]/10 bg-white/70 p-5 backdrop-blur-xl lg:block">
          <Link href="/panel" className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547] shadow-lg shadow-[#2E3A79]/20">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-xl font-black leading-none text-[#2E3A79]">
                Somos
              </p>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#746f69]">
                Panel
              </p>
            </div>
          </Link>

          <nav className="mt-8 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center gap-3 rounded-3xl px-4 py-3 text-sm font-black transition",
                    isActive
                      ? "bg-[#2E3A79] text-white shadow-xl shadow-[#2E3A79]/20"
                      : "text-[#746f69] hover:bg-[#F8F3E8] hover:text-[#25262B]",
                  ].join(" ")}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <PanelStoreIdentity />
          <div className="mt-4 rounded-[26px] bg-[#25262B] p-3 text-white">
            <PanelStoreSwitcher compact />
          </div>

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
                <div className="w-full min-w-56 lg:hidden">
                  <PanelStoreSwitcher />
                </div>
                <div className="md:hidden">
                  <PwaInstallButton compact label="Descargar app" />
                </div>
              </div>
            </div>
          </header>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "group flex items-center gap-3 rounded-[24px] p-4 text-sm font-black shadow-lg shadow-[#2E3A79]/[0.05] ring-1 ring-[#25262B]/[0.06] transition hover:-translate-y-0.5",
                    isActive
                      ? "bg-[#2E3A79] text-white"
                      : "bg-white text-[#746f69] hover:text-[#25262B]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition",
                      isActive
                        ? "bg-white/15 text-[#FFB547]"
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


