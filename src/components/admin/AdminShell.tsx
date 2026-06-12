import Link from "next/link";
import { LogoutButton } from "@/components/panel/LogoutButton";
import {
  Building2,
  Home,
  LayoutDashboard,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/comercios", label: "Comercios", icon: Building2 },
  { href: "/admin/comercios/nuevo", label: "Crear comercio", icon: PlusCircle },
  { href: "/admin/asignaciones", label: "Asignaciones", icon: UserRoundPlus },
];

export function AdminShell({
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
        <aside className="hidden w-72 shrink-0 border-r border-[#25262B]/10 bg-white/75 p-5 backdrop-blur-xl lg:block">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-3xl bg-[#25262B] text-[#FFB547] shadow-lg shadow-[#25262B]/20">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-xl font-black leading-none text-[#25262B]">
                Vende+
              </p>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#746f69]">
                Admin
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
                      ? "bg-[#25262B] text-white shadow-xl shadow-[#25262B]/20"
                      : "text-[#746f69] hover:bg-[#F8F3E8] hover:text-[#25262B]",
                  ].join(" ")}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-[32px] bg-[#2E3A79] p-5 text-white">
            <p className="flex items-center gap-2 text-sm font-black text-[#FFB547]">
              <Sparkles size={16} />
              Zona fundador
            </p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-white/75">
              Alta de comercios, control de usuarios asignados y preparación de clientes sin tocar herramientas técnicas.
            </p>
          </div>

          <Link
            href="/"
            className="mt-4 flex items-center gap-2 rounded-3xl bg-[#F8F3E8] px-4 py-3 text-sm font-black text-[#2E3A79]"
          >
            <Home size={17} />
            Ver catálogo público
          </Link>

          <div className="mt-4">
            <LogoutButton />
          </div>
        </aside>

        <section className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <header className="rounded-[36px] bg-[#25262B] p-6 text-white shadow-2xl shadow-[#25262B]/20">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
                  Admin Global
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                  {title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-white/75 sm:text-base">
                  {subtitle}
                </p>
              </div>

              <Link
                href="/panel"
                className="inline-flex items-center justify-center rounded-3xl bg-white/10 px-4 py-3 text-sm font-black backdrop-blur transition hover:bg-white/15"
              >
                Ir al panel
              </Link>
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
                    isActive ? "bg-[#25262B] text-white" : "bg-white text-[#746f69]",
                  ].join(" ")}
                >
                  <Icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-4 lg:hidden">
            <LogoutButton />
          </div>

          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
