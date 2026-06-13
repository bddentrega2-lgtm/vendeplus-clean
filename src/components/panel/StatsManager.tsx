"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bike,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  Loader2,
  Lock,
  RefreshCcw,
  ShoppingBag,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { formatUsd } from "@/lib/currency";
import { PanelAccessGate, PanelModuleSkeleton } from "@/components/panel/PanelLoadingState";
import {
  getPanelAccessToken,
  getPanelAuthHeaders,
  getSavedPanelPin,
  hasSavedPanelAuth,
  savePanelPin,
  shouldShowPanelInitialAccessGate,
} from "@/lib/panel/client-auth";

type ChartItem = { label: string; value: number };
type StoreRow = { id: string; slug: string; name: string };
type TopProduct = {
  product: string;
  quantity: number;
  revenue: number;
  orders: number;
  share: number;
};
type TopCustomer = {
  customer: string;
  phone: string;
  orders: number;
  revenue: number;
  lastOrderAt: string;
};

type StatsData = {
  stores: StoreRow[];
  selectedStoreId: string | null;
  range: { key: string; start: string; end: string; days: number };
  summary: {
    totalOrders: number;
    completedOrders: number;
    inProgressOrders: number;
    cancelledOrders: number;
    totalRevenueUsd: number;
    averageTicketUsd: number;
    averageRevenuePerDayUsd: number;
    operationalConversionRate: number;
    averageDeliveryUsd: number;
    averageDistanceKm: number;
    deliveryRevenueUsd: number;
    pickupRevenueUsd: number;
    deliveryOrders: number;
    pickupOrders: number;
    activeProducts: number;
    inactiveProducts: number;
  };
  topProducts: TopProduct[];
  topCustomers: TopCustomer[];
  salesByDay: ChartItem[];
  ordersByDay: ChartItem[];
  ordersByHour: ChartItem[];
  ordersByWeekday: ChartItem[];
  ordersByStatus: ChartItem[];
  ordersByPaymentMethod: ChartItem[];
  ordersByDeliveryType: ChartItem[];
  revenueByStore: ChartItem[];
  peak: {
    strongestHour: ChartItem | null;
    strongestWeekday: ChartItem | null;
  };
};

const rangeOptions = [
  { value: "today", label: "Hoy" },
  { value: "last_7_days", label: "Últimos 7 días" },
  { value: "last_30_days", label: "Últimos 30 días" },
  { value: "this_month", label: "Este mes" },
  { value: "previous_month", label: "Mes anterior" },
  { value: "custom", label: "Personalizado" },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-VE").format(Number(value || 0));
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatKm(value: number) {
  if (!value) return "Sin dato";
  return `${Number(value).toFixed(2)} km`;
}

function formatPercent(value: number) {
  return `${Math.round(Number(value || 0))}%`;
}

function buildStatsUrl(filters: {
  storeId: string;
  range: string;
  startDate: string;
  endDate: string;
}) {
  const params = new URLSearchParams();
  if (filters.storeId) params.set("storeId", filters.storeId);
  params.set("range", filters.range);
  if (filters.range === "custom") {
    if (filters.startDate) params.set("start", filters.startDate);
    if (filters.endDate) params.set("end", filters.endDate);
  }
  return `/api/panel/stats?${params.toString()}`;
}

async function apiRequest(
  pin: string,
  filters: { storeId: string; range: string; startDate: string; endDate: string }
) {
  const response = await fetch(buildStatsUrl(filters), {
    headers: await getPanelAuthHeaders(pin),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Error cargando estadísticas.");
  return data as StatsData;
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
    <article className="rounded-3xl bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06] ring-1 ring-[#25262B]/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[#746f69]">{label}</p>
          <p className="mt-3 text-3xl font-black text-[#25262B]">{value}</p>
          <p className="mt-1 text-xs font-bold text-[#746f69]">{detail}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F8F3E8] text-[#2E3A79]">
          <Icon size={21} />
        </div>
      </div>
    </article>
  );
}

function BarList({
  title,
  subtitle,
  items,
  valueFormatter = formatNumber,
}: {
  title: string;
  subtitle?: string;
  items: ChartItem[];
  valueFormatter?: (value: number) => string;
}) {
  const max = Math.max(...items.map((item) => Number(item.value || 0)), 1);

  return (
    <section className="rounded-3xl bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06] ring-1 ring-[#25262B]/[0.06]">
      <h2 className="text-xl font-black">{title}</h2>
      {subtitle && <p className="mt-1 text-sm font-bold text-[#746f69]">{subtitle}</p>}
      <div className="mt-5 space-y-4">
        {items.length === 0 ? (
          <p className="rounded-2xl bg-[#F8F3E8] p-4 text-sm font-bold text-[#746f69]">
            Todavía no hay data suficiente en este período.
          </p>
        ) : (
          items.map((item) => {
            const width = Math.max(5, (Number(item.value || 0) / max) * 100);
            return (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm font-black">
                  <span className="truncate">{item.label}</span>
                  <span>{valueFormatter(Number(item.value || 0))}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#F8F3E8]">
                  <div className="h-full rounded-full bg-[#2E3A79]" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export function StatsManager() {
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [range, setRange] = useState("last_30_days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => shouldShowPanelInitialAccessGate());
  const [isLoading, setIsLoading] = useState(() => hasSavedPanelAuth());
  const [error, setError] = useState("");

  async function loadStats(currentPin: string, overrides?: Partial<{
    storeId: string;
    range: string;
    startDate: string;
    endDate: string;
  }>) {
    setIsLoading(true);
    setError("");

    const filters = {
      storeId: overrides?.storeId ?? selectedStoreId,
      range: overrides?.range ?? range,
      startDate: overrides?.startDate ?? startDate,
      endDate: overrides?.endDate ?? endDate,
    };

    try {
      const data = await apiRequest(currentPin, filters);
      setStats(data);
      setIsUnlocked(true);
      if (!filters.storeId && data.stores.length === 1) setSelectedStoreId(data.stores[0].id);
      savePanelPin(currentPin);
    } catch (error: any) {
      setError(error.message || "No se pudieron cargar las estadísticas.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootPanel() {
      const savedPin = getSavedPanelPin();
      const savedToken = await getPanelAccessToken();

      if (!active) return;

      if (savedPin || savedToken) {
        setPin(savedPin);
        loadStats(savedPin);
      } else {
        setIsCheckingAccess(false);
        setIsLoading(false);
      }
    }

    bootPanel();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insights = useMemo(() => {
    if (!stats) return [];
    const topProduct = stats.topProducts[0];
    const repeatCustomers = stats.topCustomers.filter((customer) => customer.orders > 1).length;
    const preferredMode =
      stats.summary.deliveryOrders >= stats.summary.pickupOrders ? "entrega" : "retiro";
    const bestDay = stats.peak.strongestWeekday?.label || "sin suficiente data";
    const bestHour = stats.peak.strongestHour?.label || "sin suficiente data";

    return [
      topProduct
        ? `Tu producto más vendido fue ${topProduct.product}.`
        : "Aún no hay productos vendidos en este período.",
      `El ticket promedio fue de ${formatUsd(stats.summary.averageTicketUsd)}.`,
      `La mayoría de tus pedidos fueron por ${preferredMode}.`,
      `Tu día con más pedidos fue ${bestDay} y la hora más fuerte fue ${bestHour}.`,
      `Tienes ${repeatCustomers} clientes que compraron más de una vez.`,
    ];
  }, [stats]);

  if (isCheckingAccess) {
    return <PanelAccessGate />;
  }

  if ((!isUnlocked || !stats) && isLoading) {
    return <PanelModuleSkeleton label="Cargando estadísticas..." />;
  }

  if (!isUnlocked || !stats) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso a estadísticas</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesión con tu usuario autorizado para continuar.
        </p>

        <a
          href="/panel/login"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
        >
          <BarChart3 size={18} />
          Iniciar sesión
        </a>
        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>
    );
  }

  const cards = [
    {
      label: "Ventas totales",
      value: formatUsd(stats.summary.totalRevenueUsd),
      detail: `${stats.range.days} días analizados`,
      icon: DollarSign,
    },
    {
      label: "Cantidad de pedidos",
      value: formatNumber(stats.summary.totalOrders),
      detail: "Pedidos dentro del rango",
      icon: ShoppingBag,
    },
    {
      label: "Ticket promedio",
      value: formatUsd(stats.summary.averageTicketUsd),
      detail: "Ingreso promedio por pedido",
      icon: TrendingUp,
    },
    {
      label: "Ingreso diario",
      value: formatUsd(stats.summary.averageRevenuePerDayUsd),
      detail: "Promedio por día del rango",
      icon: CalendarDays,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <h2 className="text-2xl font-black">Dashboard comercial</h2>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Datos del {formatDate(stats.range.start)} al {formatDate(stats.range.end)}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadStats(pin)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Actualizar
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px_160px_160px]">
          <select
            value={selectedStoreId}
            onChange={(event) => {
              const storeId = event.target.value;
              setSelectedStoreId(storeId);
              loadStats(pin, { storeId });
            }}
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
          >
            {stats.stores.length > 1 && <option value="">Todos mis comercios</option>}
            {stats.stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
          <select
            value={range}
            onChange={(event) => {
              const nextRange = event.target.value;
              setRange(nextRange);
              if (nextRange !== "custom") loadStats(pin, { range: nextRange });
            }}
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
          >
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={startDate}
            disabled={range !== "custom"}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none disabled:bg-[#F8F3E8] disabled:text-[#746f69]"
          />
          <input
            type="date"
            value={endDate}
            disabled={range !== "custom"}
            onChange={(event) => setEndDate(event.target.value)}
            onBlur={() => range === "custom" && loadStats(pin)}
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none disabled:bg-[#F8F3E8] disabled:text-[#746f69]"
          />
        </div>
        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <section className="rounded-3xl bg-[#25262B] p-5 text-white shadow-xl shadow-[#25262B]/20">
        <h2 className="text-2xl font-black">Lectura rápida del negocio</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {insights.map((insight) => (
            <p key={insight} className="rounded-2xl bg-white/10 p-4 text-sm font-bold leading-relaxed">
              {insight}
            </p>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <BarList title="Ventas por día" subtitle="Total vendido por fecha" items={stats.salesByDay} valueFormatter={formatUsd} />
        <BarList title="Pedidos por día" subtitle="Volumen diario dentro del rango" items={stats.ordersByDay} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-3xl bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06] ring-1 ring-[#25262B]/[0.06]">
          <h2 className="text-xl font-black">Top 3 productos</h2>
          <div className="mt-5 space-y-3">
            {stats.topProducts.length === 0 ? (
              <p className="rounded-2xl bg-[#F8F3E8] p-4 text-sm font-bold text-[#746f69]">
                Todavía no hay productos vendidos en este período.
              </p>
            ) : (
              stats.topProducts.slice(0, 3).map((product, index) => (
                <div key={product.product} className="grid gap-3 rounded-2xl bg-[#F8F3E8] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="font-black">#{index + 1} {product.product}</p>
                    <p className="text-xs font-bold text-[#746f69]">
                      {formatNumber(product.quantity)} unidades · {formatPercent(product.share)} de ventas
                    </p>
                  </div>
                  <p className="font-black">{formatUsd(product.revenue)}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06] ring-1 ring-[#25262B]/[0.06]">
          <h2 className="text-xl font-black">Clientes frecuentes</h2>
          <div className="mt-5 space-y-3">
            {stats.topCustomers.length === 0 ? (
              <p className="rounded-2xl bg-[#F8F3E8] p-4 text-sm font-bold text-[#746f69]">
                Todavía no hay clientes registrados.
              </p>
            ) : (
              stats.topCustomers.slice(0, 8).map((customer) => (
                <div key={customer.phone} className="grid gap-3 rounded-2xl bg-[#F8F3E8] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="font-black">{customer.customer}</p>
                    <p className="text-xs font-bold text-[#746f69]">
                      {customer.phone} · {customer.orders} pedidos · último {formatDate(customer.lastOrderAt)}
                    </p>
                  </div>
                  <p className="font-black">{formatUsd(customer.revenue)}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <BarList title="Horas pico" subtitle="Pedidos por hora" items={stats.ordersByHour} />
        <BarList title="Días pico" subtitle="Pedidos por día de semana" items={stats.ordersByWeekday} />
      </section>
    </div>
  );
}
