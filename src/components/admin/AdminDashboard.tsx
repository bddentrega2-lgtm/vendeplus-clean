"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Building2, CheckCircle2, ClipboardList, CreditCard,
  Lock, Package, PlusCircle, RefreshCcw, ShoppingBag, TrendingUp, UserRoundCheck,
  UserRoundPlus, Users, XCircle,
} from "lucide-react";
import { getPanelAuthHeaders, getSavedPanelToken, hasSavedPanelAuth } from "@/lib/panel/client-auth";
import { getSummaryPeriod, moveSummaryAnchor, type PeriodMode } from "@/lib/admin/summary-period";

type RankingEntry = { storeId: string; storeName: string; value: number };
type Summary = {
  overview: {
    totalStores: number;
    activeStores: number;
    inactiveStores: number;
    trialStores: number;
    expiredStores: number;
    historicalOrders: number;
    ordersThisMonth: number;
    totalProducts: number;
    totalCustomers: number;
    totalAssignments: number;
    approvedPaymentsUsd: number;
    pendingFeeUsd: number;
    attentionStores: number;
  };
  period: ReturnType<typeof getSummaryPeriod>;
  orders: number;
  cancelledOrders: number;
  feeGeneratedUsd: number;
  feeCollectedUsd: number;
  uniqueCustomers: number;
  frequentCustomers: number;
  series: Array<{ label: string; orders: number; feeGeneratedUsd: number }>;
  ordersRanking: RankingEntry[];
  feeRanking: RankingEntry[];
};
type RecentStore = { id: string; slug: string; name: string; is_active: boolean };
type AdminAlert = { type: string; storeId: string; storeName: string; message: string };

const modes: Array<{ value: PeriodMode; label: string }> = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];
const numberFormat = new Intl.NumberFormat("es-VE");
const usdFormat = new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" });

function caracasToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric",
  }).format(new Date(value + "T00:00:00Z"));
}

function periodTitle(period: Summary["period"]) {
  if (period.mode === "day") return formatDay(period.startDate);
  const last = new Date(new Date(period.endDate + "T00:00:00Z").getTime() - 86400000);
  return formatDay(period.startDate) + " - " + formatDay(last.toISOString().slice(0, 10));
}

async function adminRequest(path: string) {
  const response = await fetch(path, {
    headers: { ...(await getPanelAuthHeaders("")) },
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No se pudo cargar el resumen.");
  return data;
}

function Stat({ label, value, icon: Icon, note }: {
  label: string;
  value: string;
  icon: typeof ShoppingBag;
  note?: string;
}) {
  return (
    <div className="min-w-0 border-b border-[#25262B]/10 p-4 sm:border-b-0 sm:border-r">
      <div className="flex items-center gap-2 text-[#746f69]">
        <Icon size={16} aria-hidden="true" />
        <span className="text-xs font-bold uppercase">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-black text-[#25262B]">{value}</p>
      {note ? <p className="mt-1 text-xs text-[#746f69]">{note}</p> : null}
    </div>
  );
}

function Ranking({ title, rows, money }: { title: string; rows: RankingEntry[]; money: boolean }) {
  return (
    <section className="min-w-0">
      <h2 className="mb-3 text-base font-black">{title}</h2>
      <div className="overflow-hidden border border-[#25262B]/10">
        {rows.map((row, index) => (
          <div key={row.storeId} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#25262B]/10 px-3 py-3 text-sm last:border-b-0">
            <span className="font-bold text-[#746f69]">{index + 1}</span>
            <Link href={"/admin/comercios/" + row.storeId} className="min-w-0 truncate font-semibold hover:underline" title={row.storeName}>
              {row.storeName}
            </Link>
            <span className="font-black tabular-nums">{money ? usdFormat.format(row.value) : numberFormat.format(row.value)}</span>
          </div>
        ))}
        {!rows.length ? <p className="p-4 text-sm text-[#746f69]">Sin datos en este período.</p> : null}
      </div>
    </section>
  );
}

function OrderSeries({ summary }: { summary: Summary }) {
  const max = Math.max(1, ...summary.series.map((point) => point.orders));
  return (
    <section className="min-w-0">
      <h2 className="mb-3 text-base font-black">Pedidos por {summary.period.mode === "day" ? "hora" : "día"}</h2>
      <div className="overflow-x-auto border border-[#25262B]/10 p-4">
        <div className="flex h-44 min-w-[640px] items-end gap-1">
          {summary.series.map((point) => (
            <div key={point.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[10px] font-bold tabular-nums text-[#746f69]">{point.orders || ""}</span>
              <div
                className="w-full max-w-9 bg-[#0F6B63]"
                style={{ height: Math.max(2, Math.round(point.orders / max * 116)) }}
                title={point.label + ": " + point.orders + " pedidos · " + usdFormat.format(point.feeGeneratedUsd) + " de fee"}
              />
              <span className="mt-2 text-[10px] tabular-nums text-[#746f69]">
                {summary.period.mode === "day" ? point.label : point.label.slice(8)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AdminDashboard() {
  const [mode, setMode] = useState<PeriodMode>("month");
  const [anchor, setAnchor] = useState(caracasToday);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => hasSavedPanelAuth());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentStores, setRecentStores] = useState<RecentStore[]>([]);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const requestId = useRef(0);

  async function loadSummary(nextMode = mode, nextAnchor = anchor) {
    const currentRequest = ++requestId.current;
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ period: nextMode, anchor: nextAnchor });
      const data = await adminRequest("/api/admin/summary?" + params);
      if (currentRequest !== requestId.current) return;
      setSummary(data.summary);
      setRecentStores(data.recentStores || []);
      setAlerts(data.alerts || []);
    } catch (cause) {
      if (currentRequest === requestId.current) {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar el resumen.");
      }
    } finally {
      if (currentRequest === requestId.current) {
        setIsLoading(false);
        setIsCheckingAccess(false);
      }
    }
  }

  useEffect(() => {
    if (getSavedPanelToken()) void loadSummary(mode, anchor);
    else setIsCheckingAccess(false);
  }, [mode, anchor]);

  if (isCheckingAccess) {
    return <div className="p-6 text-sm font-semibold text-[#746f69]">Cargando resumen...</div>;
  }

  if (!summary) {
    return (
      <section className="mx-auto max-w-md space-y-4 py-12 text-center">
        <Lock size={26} className="mx-auto text-[#746f69]" />
        <h1 className="text-xl font-black">Acceso fundador</h1>
        <p className="text-sm text-[#746f69]">{error || "Inicia sesión para ver el resumen."}</p>
        <button type="button" onClick={() => void loadSummary()} disabled={isLoading}
          className="inline-flex items-center gap-2 bg-[#FFB547] px-4 py-2 text-sm font-bold disabled:opacity-50">
          <CheckCircle2 size={16} /> Validar sesión
        </button>
        <p><Link href="/panel/login" className="text-sm font-bold text-[#0F6B63] underline">Iniciar sesión</Link></p>
      </section>
    );
  }

  const overviewCards = [
    { label: "Comercios", value: numberFormat.format(summary.overview.totalStores), icon: Building2 },
    { label: "Activos", value: numberFormat.format(summary.overview.activeStores), icon: CheckCircle2, note: "No pausados; incluye trial" },
    { label: "Pausados", value: numberFormat.format(summary.overview.inactiveStores), icon: Lock },
    { label: "Trial", value: numberFormat.format(summary.overview.trialStores), icon: PlusCircle, note: "Plan o estado trial" },
    { label: "Vencidos", value: numberFormat.format(summary.overview.expiredStores), icon: RefreshCcw, note: "Estado o fecha vencida" },
    { label: "Pedidos históricos", value: numberFormat.format(summary.overview.historicalOrders), icon: ClipboardList },
    { label: "Pedidos este mes", value: numberFormat.format(summary.overview.ordersThisMonth), icon: TrendingUp },
    { label: "Productos", value: numberFormat.format(summary.overview.totalProducts), icon: Package },
    { label: "Clientes", value: numberFormat.format(summary.overview.totalCustomers), icon: UserRoundPlus, note: "Registros por comercio" },
    { label: "Usuarios", value: numberFormat.format(summary.overview.totalAssignments), icon: UserRoundPlus, note: "Asignaciones a comercios" },
    { label: "Pagos aprobados", value: usdFormat.format(summary.overview.approvedPaymentsUsd), icon: CheckCircle2, note: "Todos los planes; histórico" },
    { label: "Fees pendientes", value: usdFormat.format(summary.overview.pendingFeeUsd), icon: CreditCard, note: "Cortes por pedido abiertos" },
  ];
  const periodCards = [
    { label: "Pedidos", value: numberFormat.format(summary.orders), icon: ShoppingBag },
    { label: "Cancelados", value: numberFormat.format(summary.cancelledOrders), icon: XCircle, note: "Incluidos en pedidos" },
    { label: "Fee generado", value: usdFormat.format(summary.feeGeneratedUsd), icon: CreditCard, note: "Pedidos del período" },
    { label: "Fee cobrado", value: usdFormat.format(summary.feeCollectedUsd), icon: CheckCircle2, note: "Pagos aprobados en el período" },
    { label: "Clientes únicos", value: numberFormat.format(summary.uniqueCustomers), icon: Users },
    { label: "Frecuentes", value: numberFormat.format(summary.frequentCustomers), icon: UserRoundCheck, note: "3+ pedidos en el período" },
  ];

  return (
    <div className="space-y-6 text-[#25262B]">
      <div>
        <h1 className="text-2xl font-black">Resumen SOMOS</h1>
        <p className="text-sm text-[#746f69]">{numberFormat.format(summary.overview.attentionStores)} comercios requieren atención</p>
      </div>
      <section className="grid grid-cols-2 border border-[#25262B]/10 bg-white sm:grid-cols-3 xl:grid-cols-6">
        {overviewCards.map((card) => <Stat key={card.label} {...card} />)}
      </section>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Actividad por período</h2>
          <p className="text-sm text-[#746f69]" aria-live="polite">
            {periodTitle(summary.period)}{isLoading ? " · Actualizando..." : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex border border-[#25262B]/20" role="group" aria-label="Período">
            {modes.map((item) => (
              <button key={item.value} type="button" onClick={() => setMode(item.value)}
                aria-pressed={mode === item.value}
                className={"px-3 py-2 text-sm font-bold " + (mode === item.value ? "bg-[#25262B] text-white" : "bg-white")}>
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setAnchor(moveSummaryAnchor(mode, anchor, -1))}
            className="grid size-9 place-items-center border border-[#25262B]/20" title="Período anterior" aria-label="Período anterior"><ArrowLeft size={16} /></button>
          <input type="date" value={anchor} onChange={(event) => event.target.value && setAnchor(event.target.value)}
            className="h-9 border border-[#25262B]/20 px-2 text-sm" aria-label="Seleccionar fecha" />
          <button type="button" onClick={() => setAnchor(moveSummaryAnchor(mode, anchor, 1))}
            className="grid size-9 place-items-center border border-[#25262B]/20" title="Período siguiente" aria-label="Período siguiente"><ArrowRight size={16} /></button>
          <button type="button" onClick={() => void loadSummary()} disabled={isLoading}
            className="grid size-9 place-items-center border border-[#25262B]/20 disabled:opacity-50" title="Actualizar" aria-label="Actualizar"><RefreshCcw size={16} /></button>
        </div>
      </header>

      {error ? <p role="alert" className="border-l-4 border-red-600 bg-red-50 p-3 text-sm">{error}</p> : null}
      <section className="grid border border-[#25262B]/10 bg-white sm:grid-cols-3 xl:grid-cols-6">
        {periodCards.map((card) => <Stat key={card.label} {...card} />)}
      </section>

      <OrderSeries summary={summary} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Ranking title="Comercios por pedidos (incl. cancelados)" rows={summary.ordersRanking} money={false} />
        <Ranking title="Comercios por fee cobrado" rows={summary.feeRanking} money />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-base font-black">Alertas operativas</h2>
          <div className="divide-y divide-[#25262B]/10 border border-[#25262B]/10">
            {alerts.map((alert) => (
              <Link key={alert.type + alert.storeId} href={"/admin/comercios/" + alert.storeId}
                className="block p-3 text-sm hover:bg-[#F8F3E8]">
                <strong>{alert.storeName}</strong><span className="ml-2 text-[#746f69]">{alert.message}</span>
              </Link>
            ))}
            {!alerts.length ? <p className="p-3 text-sm text-[#746f69]">Sin alertas.</p> : null}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-base font-black">Comercios recientes</h2>
          <div className="divide-y divide-[#25262B]/10 border border-[#25262B]/10">
            {recentStores.map((store) => (
              <Link key={store.id} href={"/admin/comercios/" + store.id}
                className="flex items-center gap-2 p-3 text-sm hover:bg-[#F8F3E8]">
                <Building2 size={15} className="shrink-0 text-[#746f69]" />
                <span className="min-w-0 truncate font-semibold">{store.name}</span>
              </Link>
            ))}
            {!recentStores.length ? <p className="p-3 text-sm text-[#746f69]">Sin comercios.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
