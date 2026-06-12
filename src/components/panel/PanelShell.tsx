import Link from "next/link";
import { LogoutButton } from "@/components/panel/LogoutButton";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Home,
  LayoutDashboard,
  PlusCircle,
  Settings,
  Sparkles,
  Tags,
} from "lucide-react";

const navItems = [
  { href: "/panel", label: "Inicio", icon: LayoutDashboard },
  { href: "/panel/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/panel/pedidos/nuevo", label: "Crear pedido", icon: PlusCircle },
  { href: "/panel/productos", label: "Productos", icon: Boxes },
  { href: "/panel/catalogo", label: "Catálogo", icon: Tags },
  { href: "/panel/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/panel/configuracion", label: "Configuración", icon: Settings },
];

export function PanelShell({
  children,
  title,
  subtitle,
  active,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  active: string;
}) {
  return (
    <main className="min-h-screen bg-[#F8F3E8] text-[#25262B]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px]">
        <aside className="hidden w-72 shrink-0 border-r border-[#25262B]/10 bg-white/70 p-5 backdrop-blur-xl lg:block">
          <Link href="/panel" className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547] shadow-lg shadow-[#2E3A79]/20">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-xl font-black leading-none text-[#2E3A79]">
                Vende+
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

          <div className="mt-8 rounded-[32px] bg-[#25262B] p-5 text-white">
            <p className="text-sm font-black text-[#FFB547]">Panel de ventas</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-white/75">
              Gestiona productos, pedidos, ventas y configuración de tu negocio en un solo lugar.
            </p>
          </div>

          <Link
            href="/"
            className="mt-4 flex items-center gap-2 rounded-3xl bg-[#F8F3E8] px-4 py-3 text-sm font-black text-[#2E3A79]"
          >
            <Home size={17} />
            Ver catálogo público
          </Link>
                  <div className="mt-4"><LogoutButton /></div>
        </aside>

        <section className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <header className="rounded-[36px] bg-[#2E3A79] p-6 text-white shadow-2xl shadow-[#2E3A79]/20">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
                  Vende+ Panel de ventas
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                  {title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-white/75 sm:text-base">
                  {subtitle}
                </p>
              </div>

              <div className="rounded-3xl bg-white/10 px-4 py-3 text-sm font-black backdrop-blur">
                Datos guardados automáticamente
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
                    "flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-black",
                    isActive
                      ? "bg-[#2E3A79] text-white"
                      : "bg-white text-[#746f69]",
                  ].join(" ")}
                >
                  <Icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-4 lg:hidden"><LogoutButton /></div>
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}


