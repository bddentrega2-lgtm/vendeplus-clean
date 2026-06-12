"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Boxes,
  ClipboardList,
  DollarSign,
  Loader2,
  Lock,
  RefreshCcw,
  ShoppingBag,
  Store,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { formatUsd } from "@/lib/currency";
import {
  getPanelAuthHeaders,
  getSavedPanelPin,
  getSavedPanelToken,
  hasSavedPanelAuth,
  savePanelPin,
} from "@/lib/panel/client-auth";

async function apiRequest(pin: string) {
  const response = await fetch("/api/panel/stats", {
    headers: await getPanelAuthHeaders(pin),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error cargando dashboard.");
  }

  return data;
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: any;
}) {
  return (
    <article className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[#746f69]">{label}</p>
          <p className="mt-3 text-3xl font-black text-[#25262B]">{value}</p>
          <p className="mt-1 text-xs font-bold text-[#746f69]">{detail}</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-3xl bg-[#FFB547]/20 text-[#2E3A79]">
          <Icon size={22} />
        </div>
      </div>
    </article>
  );
}

export function DashboardManager() {
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => hasSavedPanelAuth());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard(currentPin: string) {
    setIsLoading(true);
    setError("");

    try {
      const data = await apiRequest(currentPin);
      setStats(data);
      setIsUnlocked(true);

      if (currentPin) {
        savePanelPin(currentPin);
      }
    } catch (error: any) {
      setError(error.message || "No se pudo cargar el dashboard.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }

  useEffect(() => {
    const savedPin = getSavedPanelPin();
    const savedToken = getSavedPanelToken();

    if (savedPin || savedToken) {
      setPin(savedPin);
      loadDashboard(savedPin);
    } else {
      setIsCheckingAccess(false);
    }
  }, []);

  if (isCheckingAccess) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <Loader2 size={22} className="mx-auto animate-spin text-[#2E3A79]" />
        <p className="mt-3 text-sm font-black text-[#746f69]">
          Validando acceso...
        </p>
      </section>
    );
  }

  if (!isUnlocked || !stats) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso al dashboard</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesión para ver el resumen de tus comercios asignados.
        </p>

        <a
          href="/panel/login"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
        >
          <Activity size={18} />
          Iniciar sesión
        </a>

        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>
    );
  }

  const summary = stats.summary || {};

  const cards = [
    {
      label: "Ventas del período",
      value: formatUsd(summary.totalRevenueUsd),
      detail: `${summary.totalOrders || 0} pedidos registrados`,
      icon: DollarSign,
    },
    {
      label: "Ingreso diario",
      value: formatUsd(summary.averageRevenuePerDayUsd),
      detail: `${stats.range?.days || 1} días analizados`,
      icon: TrendingUp,
    },
    {
      label: "Pedidos registrados",
      value: String(summary.totalOrders || 0),
      detail: `${summary.completedOrders || 0} completados · ${summary.cancelledOrders || 0} cancelados`,
      icon: ClipboardList,
    },
    {
      label: "Ticket promedio",
      value: formatUsd(summary.averageTicketUsd),
      detail: "Promedio por pedido",
      icon: ShoppingBag,
    },
    {
      label: "Productos activos",
      value: String(summary.activeProducts || 0),
      detail: `${summary.inactiveProducts || 0} productos inactivos`,
      icon: Boxes,
    },
    {
      label: "Entregas",
      value: String(summary.deliveryOrders || 0),
      detail: `${Number(summary.averageDistanceKm || 0).toFixed(2)} km promedio`,
      icon: Store,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[34px] bg-[#25262B] p-5 text-white shadow-xl shadow-[#25262B]/20">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
              Dashboard filtrado por comercio
            </p>
            <h2 className="mt-2 text-3xl font-black">Resumen operativo</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-white/70">
              Esta vista ahora respeta los comercios asignados al usuario conectado.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadDashboard(pin)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
          >
            <RefreshCcw size={16} />
            Actualizar
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <h2 className="text-2xl font-black">Productos más vendidos</h2>
          <div className="mt-5 space-y-3">
            {(stats.topProducts || []).slice(0, 5).map((product: any, index: number) => (
              <div key={product.product} className="flex items-center justify-between rounded-3xl bg-[#F8F3E8] p-4">
                <div>
                  <p className="font-black">#{index + 1} {product.product}</p>
                  <p className="text-xs font-bold text-[#746f69]">{product.quantity} unidades</p>
                </div>
                <p className="font-black">{formatUsd(product.revenue)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <h2 className="text-2xl font-black">Accesos rápidos</h2>
          <div className="mt-5 grid gap-3">
            <Link href="/panel/productos" className="rounded-full bg-[#2E3A79] px-5 py-3 text-center text-sm font-black text-white">
              Gestionar productos
            </Link>
            <Link href="/panel/pedidos" className="rounded-full bg-[#FFB547] px-5 py-3 text-center text-sm font-black text-[#25262B]">
              Ver pedidos
            </Link>
            <Link href="/panel/estadisticas" className="rounded-full bg-[#F8F3E8] px-5 py-3 text-center text-sm font-black text-[#2E3A79]">
              Estadísticas completas
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
