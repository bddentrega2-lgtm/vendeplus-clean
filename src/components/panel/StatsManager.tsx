"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bike,
  CreditCard,
  DollarSign,
  Loader2,
  Lock,
  Package,
  RefreshCcw,
  ShoppingBag,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatUsd } from "@/lib/currency";

type ChartItem = {
  label: string;
  value: number;
};

type TopProduct = {
  product: string;
  quantity: number;
  revenue: number;
  orders: number;
};

type TopCustomer = {
  customer: string;
  phone: string;
  orders: number;
  revenue: number;
};

type StatsData = {
  summary: {
    totalOrders: number;
    todayOrders: number;
    monthOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    totalRevenueUsd: number;
    todayRevenueUsd: number;
    monthRevenueUsd: number;
    averageTicketUsd: number;
    averageDeliveryUsd: number;
    averageDistanceKm: number;
    deliveryOrders: number;
    pickupOrders: number;
    activeProducts: number;
    inactiveProducts: number;
  };
  topProducts: TopProduct[];
  topCustomers: TopCustomer[];
  salesByDay: ChartItem[];
  ordersByDay: ChartItem[];
  salesByWeek: ChartItem[];
  salesByMonth: ChartItem[];
  ordersByHour: ChartItem[];
  ordersByStatus: ChartItem[];
  ordersByPaymentMethod: ChartItem[];
  ordersByDeliveryType: ChartItem[];
  revenueByStore: ChartItem[];
  recentOrders: any[];
};

function getSavedPin() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("vendeplus_panel_pin") || "";
}

async function apiRequest(pin: string) {
  const response = await fetch("/api/panel/stats", {
    headers: {
      "x-panel-pin": pin,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error cargando estadisticas.");
  }

  return data as StatsData;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-VE").format(Number(value || 0));
}

function formatKm(value: number) {
  return `${Number(value || 0).toFixed(2)} km`;
}

function percent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
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
    <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
      <div>
        <h2 className="text-2xl font-black">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-sm font-bold text-[#746f69]">{subtitle}</p>
        )}
      </div>

      <div className="mt-5 space-y-4">
        {items.length === 0 ? (
          <p className="rounded-3xl bg-[#F8F3E8] p-4 text-sm font-bold text-[#746f69]">
            Todavia no hay data suficiente.
          </p>
        ) : (
          items.map((item) => {
            const width = Math.max(6, (Number(item.value || 0) / max) * 100);

            return (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm font-black">
                  <span className="truncate">{item.label}</span>
                  <span>{valueFormatter(Number(item.value || 0))}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#F8F3E8]">
                  <div
                    className="h-full rounded-full bg-[#FFB547]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
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

export function StatsManager() {
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadStats(currentPin: string) {
    setIsLoading(true);
    setError("");

    try {
      const data = await apiRequest(currentPin);

      setStats(data);
      setIsUnlocked(true);
      sessionStorage.setItem("vendeplus_panel_pin", currentPin);
    } catch (error: any) {
      setError(error.message || "No se pudieron cargar las estadisticas.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const savedPin = getSavedPin();

    if (savedPin) {
      setPin(savedPin);
      loadStats(savedPin);
    }
  }, []);

  const insights = useMemo(() => {
    if (!stats) return [];

    const total = stats.summary.totalOrders;
    const deliveryShare = percent(stats.summary.deliveryOrders, total);
    const completedShare = percent(stats.summary.completedOrders, total);
    const cancelledShare = percent(stats.summary.cancelledOrders, total);

    return [
      `Delivery representa ${deliveryShare} de los pedidos.`,
      `Pedidos completados: ${completedShare}. Cancelados: ${cancelledShare}.`,
      `Ticket promedio: ${formatUsd(stats.summary.averageTicketUsd)}.`,
      `Distancia promedio de delivery: ${formatKm(stats.summary.averageDistanceKm)}.`,
    ];
  }, [stats]);

  if (!isUnlocked || !stats) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso a estadisticas</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Ingresa el PIN del panel para ver indicadores comerciales.
        </p>

        <input
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="PIN de acceso"
          type="password"
          className="mt-5 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-center text-lg font-black outline-none focus:border-[#2E3A79]"
        />

        <button
          type="button"
          onClick={() => loadStats(pin)}
          disabled={isLoading}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <BarChart3 size={18} />
          )}
          Entrar a estadisticas
        </button>

        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>
    );
  }

  const cards = [
    {
      label: "Ventas hoy",
      value: formatUsd(stats.summary.todayRevenueUsd),
      detail: `${stats.summary.todayOrders} pedidos hoy`,
      icon: DollarSign,
    },
    {
      label: "Ventas del mes",
      value: formatUsd(stats.summary.monthRevenueUsd),
      detail: `${stats.summary.monthOrders} pedidos este mes`,
      icon: TrendingUp,
    },
    {
      label: "Ventas historicas",
      value: formatUsd(stats.summary.totalRevenueUsd),
      detail: `${stats.summary.totalOrders} pedidos registrados`,
      icon: Activity,
    },
    {
      label: "Ticket promedio",
      value: formatUsd(stats.summary.averageTicketUsd),
      detail: "Promedio por pedido",
      icon: ShoppingBag,
    },
    {
      label: "Delivery",
      value: String(stats.summary.deliveryOrders),
      detail: `${formatKm(stats.summary.averageDistanceKm)} promedio`,
      icon: Bike,
    },
    {
      label: "Pickup",
      value: String(stats.summary.pickupOrders),
      detail: `${percent(stats.summary.pickupOrders, stats.summary.totalOrders)} del total`,
      icon: Package,
    },
    {
      label: "Productos activos",
      value: String(stats.summary.activeProducts),
      detail: `${stats.summary.inactiveProducts} inactivos`,
      icon: Star,
    },
    {
      label: "Clientes unicos",
      value: String(stats.topCustomers.length),
      detail: "Top compradores identificados",
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[34px] bg-[#25262B] p-5 text-white shadow-xl shadow-[#25262B]/20">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
              Inteligencia comercial
            </p>
            <h2 className="mt-2 text-3xl font-black">Resumen ejecutivo</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-white/70">
              Estas metricas convierten los pedidos en decisiones: que se vende,
              quien compra, como paga, cuanto deja cada pedido y como se comporta
              el delivery.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadStats(pin)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
          >
            <RefreshCcw size={16} />
            Actualizar
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {insights.map((insight) => (
            <div key={insight} className="rounded-3xl bg-white/10 p-4 text-sm font-bold">
              {insight}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <BarList
          title="Ventas por dia"
          subtitle="Ultimos 14 dias con pedidos"
          items={stats.salesByDay}
          valueFormatter={formatUsd}
        />
        <BarList
          title="Pedidos por dia"
          subtitle="Volumen de pedidos diarios"
          items={stats.ordersByDay}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <BarList
          title="Ventas por semana"
          subtitle="Ultimas 8 semanas"
          items={stats.salesByWeek}
          valueFormatter={formatUsd}
        />
        <BarList
          title="Ventas por mes"
          subtitle="Ultimos 6 meses"
          items={stats.salesByMonth}
          valueFormatter={formatUsd}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <BarList
          title="Estados de pedidos"
          subtitle="Operacion y cumplimiento"
          items={stats.ordersByStatus}
        />
        <BarList
          title="Metodos de pago"
          subtitle="Preferencias de cobro"
          items={stats.ordersByPaymentMethod}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <BarList
          title="Delivery vs Pickup"
          subtitle="Comportamiento logistico"
          items={stats.ordersByDeliveryType}
        />
        <BarList
          title="Ventas por comercio"
          subtitle="Ingresos por aliado"
          items={stats.revenueByStore}
          valueFormatter={formatUsd}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <h2 className="text-2xl font-black">Productos mas vendidos</h2>
          <p className="mt-1 text-sm font-bold text-[#746f69]">
            Ranking por cantidad vendida.
          </p>

          <div className="mt-5 space-y-3">
            {stats.topProducts.length === 0 ? (
              <p className="rounded-3xl bg-[#F8F3E8] p-4 text-sm font-bold text-[#746f69]">
                Todavia no hay productos vendidos.
              </p>
            ) : (
              stats.topProducts.map((product, index) => (
                <div key={product.product} className="flex items-center justify-between gap-4 rounded-3xl bg-[#F8F3E8] p-4">
                  <div>
                    <p className="font-black">
                      #{index + 1} {product.product}
                    </p>
                    <p className="text-xs font-bold text-[#746f69]">
                      {product.quantity} unidades · {product.orders} pedidos
                    </p>
                  </div>
                  <p className="font-black">{formatUsd(product.revenue)}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <h2 className="text-2xl font-black">Clientes de mayor valor</h2>
          <p className="mt-1 text-sm font-bold text-[#746f69]">
            Clientes ordenados por ingresos.
          </p>

          <div className="mt-5 space-y-3">
            {stats.topCustomers.length === 0 ? (
              <p className="rounded-3xl bg-[#F8F3E8] p-4 text-sm font-bold text-[#746f69]">
                Todavia no hay clientes registrados.
              </p>
            ) : (
              stats.topCustomers.map((customer, index) => (
                <div key={customer.phone} className="flex items-center justify-between gap-4 rounded-3xl bg-[#F8F3E8] p-4">
                  <div>
                    <p className="font-black">
                      #{index + 1} {customer.customer}
                    </p>
                    <p className="text-xs font-bold text-[#746f69]">
                      {customer.phone} · {customer.orders} pedidos
                    </p>
                  </div>
                  <p className="font-black">{formatUsd(customer.revenue)}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </section>

      <BarList
        title="Pedidos por hora"
        subtitle="Ayuda a detectar horas pico operativas"
        items={stats.ordersByHour}
      />
    </div>
  );
}
