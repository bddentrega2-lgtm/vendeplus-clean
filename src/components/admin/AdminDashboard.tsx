"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Loader2,
  Lock,
  Package,
  PlusCircle,
  RefreshCcw,
  TrendingUp,
  UserRoundPlus,
  XCircle,
} from "lucide-react";
import {
  getPanelAuthHeaders,
  getSavedPanelToken,
  hasSavedPanelAuth,
} from "@/lib/panel/client-auth";

type Summary = {
  totalStores: number;
  activeStores: number;
  inactiveStores: number;
  trialStores: number;
  expiredStores: number;
  totalOrders: number;
  ordersToday: number;
  ordersLast7Days: number;
  totalProducts: number;
  totalAssignments: number;
  totalCustomers: number;
  estimatedMrrUsd: number;
  revenueUsd: number;
  approvedPaymentsUsd: number;
  pendingServiceFeesUsd: number;
  attentionStores: number;
};

type MonthlyGrowthPoint = {
  label: string;
  orders: number;
  salesUsd: number;
  averageTicketUsd: number;
};

type GrowthMetrics = {
  timezone: string;
  historical: {
    orders: number;
    salesUsd: number;
    averageTicketUsd: number;
    cancelledOrders: number;
  };
  currentMonth: {
    label: string;
    orders: number;
    salesUsd: number;
    averageTicketUsd: number;
    cancelledOrders: number;
    cancellationRate: number;
  };
  comparison: {
    previousLabel: string;
    previousOrders: number;
    previousSalesUsd: number;
    ordersGrowthPct: number | null;
    salesGrowthPct: number | null;
  };
  monthly: MonthlyGrowthPoint[];
  channels: Array<{ channel: string; orders: number; salesUsd: number }>;
  ranking: Array<{
    storeId: string;
    storeName: string;
    orders: number;
    salesUsd: number;
    averageTicketUsd: number;
  }>;
};

type RecentStore = {
  id: string;
  slug: string;
  name: string;
  business_type: string | null;
  whatsapp: string | null;
  is_active: boolean;
  plan_type?: string | null;
  trial_ends_at?: string | null;
  subscription_status?: string | null;
};

type AdminAlert = {
  type: string;
  storeId: string;
  storeName: string;
  message: string;
};

type AuthCheck = {
  authenticated: boolean;
  userEmail: string | null;
  founderEmailsConfigured: boolean;
  founderEmailCount: number;
  matchesFounderEmail: boolean;
  reason: string;
};

async function adminRequest(path: string, pin: string, options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getPanelAuthHeaders(pin)),
      ...(options?.headers || {}),
    },
  });
  const data = await response.json();

  if (!response.ok) throw new Error(data.error || "Error cargando admin.");

  return data;
}

async function getAdminAuthCheck(): Promise<AuthCheck | null> {
  try {
    const response = await fetch("/api/admin/auth-check", {
      headers: await getPanelAuthHeaders(""),
    });

    if (!response.ok) return null;

    const data = await response.json();

    return data as AuthCheck;
  } catch {
    return null;
  }
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-VE").format(Number(value || 0));
}

function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("es-VE", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(" de ", " ");
}

function GrowthValue({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-[#746f69]">Sin base anterior</span>;
  }

  const positive = value >= 0;
  return (
    <span className={positive ? "text-emerald-700" : "text-red-600"}>
      {positive ? "+" : ""}{value.toFixed(1)}% vs. mismo periodo anterior
    </span>
  );
}

function MonthlyBars({
  title,
  data,
  value,
  formatValue,
  color,
}: {
  title: string;
  data: MonthlyGrowthPoint[];
  value: "orders" | "salesUsd";
  formatValue: (value: number) => string;
  color: string;
}) {
  const maximum = Math.max(1, ...data.map((item) => Number(item[value] || 0)));

  return (
    <div className="rounded-[28px] bg-[#F8F3E8] p-4">
      <p className="text-sm font-black">{title}</p>
      <div className="mt-5 overflow-x-auto pb-2">
        <div className="flex h-52 min-w-[620px] items-end gap-2">
          {data.map((item) => {
            const metric = Number(item[value] || 0);
            const height = metric > 0 ? Math.max(8, Math.round(metric / maximum * 150)) : 3;
            return (
              <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                <span className="mb-1 text-[10px] font-black text-[#746f69]">{formatValue(metric)}</span>
                <div
                  className={`w-full max-w-9 rounded-t-xl ${color}`}
                  style={{ height }}
                  title={`${formatMonth(item.label)}: ${formatValue(metric)}`}
                />
                <span className="mt-2 whitespace-nowrap text-[10px] font-bold capitalize text-[#746f69]">
                  {formatMonth(item.label)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const channelLabels: Record<string, string> = {
  delivery: "Delivery",
  pickup: "Retiro",
  table: "Mesa",
  bar: "Barra",
  national_shipping: "Envio nacional",
  other: "Otros",
};

function AccessBox({
  error,
  authCheck,
  isLoading,
  onSubmit,
}: {
  error: string;
  authCheck: AuthCheck | null;
  isLoading: boolean;
  onSubmit: () => void;
}) {
  return (
    <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#25262B] text-[#FFB547]">
        <Lock size={26} />
      </div>
      <h2 className="mt-5 text-3xl font-black">Acceso fundador</h2>
      <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
        Inicia sesion con un email incluido en FOUNDER_EMAILS para entrar al admin.
      </p>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60"
      >
        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
        Validar sesion
      </button>

      <Link href="/panel/login" className="mt-3 inline-flex text-sm font-black text-[#2E3A79]">
        Iniciar sesion con email
      </Link>

      {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}

      {authCheck && (
        <div className="mt-4 rounded-2xl bg-[#F8F3E8] p-4 text-left text-sm font-bold text-[#25262B]">
          <p className="font-black text-[#2E3A79]">Diagnostico</p>
          <p className="mt-2">Sesion: {authCheck.authenticated ? "activa" : "no detectada"}</p>
          <p>Email detectado: {authCheck.userEmail || "ninguno"}</p>
          <p>
            FOUNDER_EMAILS:{" "}
            {authCheck.founderEmailsConfigured
              ? `${authCheck.founderEmailCount} configurado(s)`
              : "no configurado en produccion"}
          </p>
          <p>Coincide: {authCheck.matchesFounderEmail ? "si" : "no"}</p>
          <p className="mt-2 text-[#746f69]">{authCheck.reason}</p>
        </div>
      )}
    </section>
  );
}

export function AdminDashboard() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => hasSavedPanelAuth());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [authCheck, setAuthCheck] = useState<AuthCheck | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentStores, setRecentStores] = useState<RecentStore[]>([]);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [growth, setGrowth] = useState<GrowthMetrics | null>(null);

  async function loadSummary() {
    setIsLoading(true);
    setError("");

    try {
      const data = await adminRequest("/api/admin/summary", "");
      setSummary(data.summary);
      setRecentStores(data.recentStores || []);
      setAlerts(data.alerts || []);
      setGrowth(data.growth || null);
      setIsUnlocked(true);
      setAuthCheck(null);
    } catch (error: any) {
      setError(error.message || "No se pudo cargar admin.");
      setAuthCheck(await getAdminAuthCheck());
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }

  useEffect(() => {
    const savedToken = getSavedPanelToken();

    if (savedToken) {
      loadSummary();
    } else {
      setIsCheckingAccess(false);
    }
  }, []);

  if (isCheckingAccess) {
    return (
      <section className="rounded-[34px] bg-white p-6 text-center shadow-xl shadow-[#2E3A79]/[0.07]">
        <Loader2 size={22} className="mx-auto animate-spin text-[#25262B]" />
        <p className="mt-3 text-sm font-black text-[#746f69]">Validando acceso...</p>
      </section>
    );
  }

  if (!isUnlocked || !summary) {
    return (
      <AccessBox
        error={error}
        authCheck={authCheck}
        isLoading={isLoading}
        onSubmit={() => loadSummary()}
      />
    );
  }

  const cards = [
    { label: "Comercios", value: summary.totalStores, icon: Building2 },
    { label: "Activos", value: summary.activeStores, icon: CheckCircle2 },
    { label: "Pausados", value: summary.inactiveStores, icon: Lock },
    { label: "Trial", value: summary.trialStores, icon: PlusCircle },
    { label: "Vencidos", value: summary.expiredStores, icon: RefreshCcw },
    { label: "Pedidos historicos", value: growth ? formatNumber(growth.historical.orders) : summary.totalOrders, icon: ClipboardList },
    { label: "Pedidos este mes", value: growth ? formatNumber(growth.currentMonth.orders) : summary.ordersLast7Days, icon: TrendingUp },
    { label: "Productos", value: summary.totalProducts, icon: Package },
    { label: "Clientes", value: summary.totalCustomers, icon: UserRoundPlus },
    { label: "Usuarios", value: summary.totalAssignments, icon: UserRoundPlus },
    { label: "Pagos aprobados", value: formatUsd(summary.approvedPaymentsUsd), icon: CheckCircle2 },
    { label: "Fees pendientes", value: formatUsd(summary.pendingServiceFeesUsd), icon: CreditCard },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.label}
              className="rounded-[28px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06] ring-1 ring-[#25262B]/[0.06]"
            >
              <Icon size={21} className="text-[#2E3A79]" />
              <p className="mt-4 text-3xl font-black">{card.value}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                {card.label}
              </p>
            </article>
          );
        })}
      </section>

      {growth ? (
        <section className="space-y-4 rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">Crecimiento global</p>
              <h2 className="mt-1 text-3xl font-black">Ventas y pedidos</h2>
              <p className="mt-1 text-sm font-bold text-[#746f69]">Sin comercios de prueba · ventas sin pedidos cancelados · hora de Venezuela</p>
            </div>
            <p className="text-sm font-black capitalize text-[#2E3A79]">Mes actual: {formatMonth(growth.currentMonth.label)}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-[26px] bg-[#25262B] p-5 text-white">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/60">Ventas historicas</p>
              <p className="mt-2 text-3xl font-black">{formatUsd(growth.historical.salesUsd)}</p>
              <p className="mt-2 text-xs font-bold text-white/70">{formatNumber(growth.historical.orders)} pedidos validos</p>
            </article>
            <article className="rounded-[26px] bg-[#FFF0C9] p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Ventas del mes</p>
              <p className="mt-2 text-3xl font-black">{formatUsd(growth.currentMonth.salesUsd)}</p>
              <p className="mt-2 text-xs font-black"><GrowthValue value={growth.comparison.salesGrowthPct} /></p>
            </article>
            <article className="rounded-[26px] bg-[#DDF7E8] p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Ticket promedio</p>
              <p className="mt-2 text-3xl font-black">{formatUsd(growth.currentMonth.averageTicketUsd)}</p>
              <p className="mt-2 text-xs font-bold text-[#746f69]">Promedio por pedido este mes</p>
            </article>
            <article className="rounded-[26px] bg-[#FCE5E2] p-5">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#746f69]"><XCircle size={15} /> Cancelaciones</p>
              <p className="mt-2 text-3xl font-black">{formatNumber(growth.currentMonth.cancelledOrders)}</p>
              <p className="mt-2 text-xs font-bold text-[#746f69]">{Number(growth.currentMonth.cancellationRate || 0).toFixed(1)}% de pedidos del mes</p>
            </article>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <MonthlyBars title="Pedidos mes a mes" data={growth.monthly} value="orders" formatValue={formatNumber} color="bg-[#0F6B63]" />
            <MonthlyBars title="Ventas mes a mes" data={growth.monthly} value="salesUsd" formatValue={(amount) => `$${Math.round(amount)}`} color="bg-[#FF7133]" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
            <div className="rounded-[28px] bg-[#F8F3E8] p-5">
              <p className="text-sm font-black">Pedidos por modalidad este mes</p>
              <div className="mt-4 space-y-2">
                {growth.channels.map((channel) => (
                  <div key={channel.channel} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                    <span className="text-sm font-black">{channelLabels[channel.channel] || channel.channel}</span>
                    <span className="text-right text-sm font-black">{formatNumber(channel.orders)}<small className="ml-2 block text-[10px] text-[#746f69] sm:inline">{formatUsd(channel.salesUsd)}</small></span>
                  </div>
                ))}
                {!growth.channels.length ? <p className="text-sm font-bold text-[#746f69]">Todavia no hay pedidos este mes.</p> : null}
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] ring-1 ring-[#25262B]/[0.08]">
              <div className="bg-[#25262B] px-5 py-4 text-white">
                <p className="text-sm font-black">Ranking de comercios este mes</p>
                <p className="mt-1 text-xs font-bold text-white/65">Ordenado por ventas procesadas</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-[#F8F3E8] text-xs uppercase tracking-[0.12em] text-[#746f69]">
                    <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Comercio</th><th className="px-4 py-3 text-right">Pedidos</th><th className="px-4 py-3 text-right">Ventas</th><th className="px-4 py-3 text-right">Ticket</th></tr>
                  </thead>
                  <tbody>
                    {growth.ranking.map((store, index) => (
                      <tr key={store.storeId} className="border-t border-[#25262B]/[0.06]">
                        <td className="px-4 py-3 font-black text-[#FF7133]">{index + 1}</td>
                        <td className="px-4 py-3 font-black">{store.storeName}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatNumber(store.orders)}</td>
                        <td className="px-4 py-3 text-right font-black">{formatUsd(store.salesUsd)}</td>
                        <td className="px-4 py-3 text-right font-bold text-[#746f69]">{formatUsd(store.averageTicketUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!growth.ranking.length ? <p className="p-5 text-sm font-bold text-[#746f69]">Sin ventas para ordenar este mes.</p> : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
                Operacion comercial
              </p>
              <h2 className="mt-1 text-3xl font-black">{formatUsd(summary.estimatedMrrUsd)} MRR</h2>
              <p className="mt-1 text-sm font-bold text-[#746f69]">
                Ventas historicas: {formatUsd(summary.revenueUsd)} - {summary.attentionStores} comercios requieren atencion
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadSummary()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F8F3E8] px-4 py-3 text-sm font-black text-[#2E3A79]"
            >
              <RefreshCcw size={16} />
              Actualizar
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Link
              href="/admin/comercios/nuevo"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FFB547] px-4 py-4 text-sm font-black text-[#25262B]"
            >
              <PlusCircle size={17} />
              Crear comercio
            </Link>
            <Link
              href="/admin/comercios"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25262B] px-4 py-4 text-sm font-black text-white"
            >
              <Building2 size={17} />
              Ver comercios
            </Link>
            <Link
              href="/admin/usuarios"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2E3A79] px-4 py-4 text-sm font-black text-white"
            >
              <UserRoundPlus size={17} />
              Usuarios
            </Link>
          </div>
        </div>

        <div className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
            Comercios recientes
          </p>
          <div className="mt-4 space-y-3">
            {recentStores.map((store) => (
              <Link
                key={store.id}
                href={`/admin/comercios/${store.id}`}
                className="block rounded-2xl bg-[#F8F3E8] p-4 transition hover:bg-[#efe5d2]"
              >
                <p className="font-black">{store.name}</p>
                <p className="mt-1 text-xs font-bold text-[#746f69]">
                  /{store.slug} - {store.is_active ? "Activo" : "Pausado"} - {store.plan_type || "trial"}
                </p>
              </Link>
            ))}
            {recentStores.length === 0 && (
              <p className="text-sm font-bold text-[#746f69]">Todavia no hay comercios.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
              Alertas operativas
            </p>
            <h2 className="mt-1 text-3xl font-black">{alerts.length} prioridades</h2>
          </div>
          <Link
            href="/admin/comercios"
            className="inline-flex items-center justify-center rounded-full bg-[#25262B] px-4 py-3 text-sm font-black text-white"
          >
            Revisar comercios
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {alerts.map((alert) => (
            <Link
              key={`${alert.type}-${alert.storeId}`}
              href={`/admin/comercios/${alert.storeId}`}
              className="rounded-2xl bg-[#F8F3E8] p-4 transition hover:bg-[#efe5d2]"
            >
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#2E3A79]">
                {alert.type}
              </p>
              <p className="mt-1 font-black">{alert.storeName}</p>
              <p className="mt-1 text-sm font-bold text-[#746f69]">{alert.message}</p>
            </Link>
          ))}
          {alerts.length === 0 ? (
            <p className="rounded-2xl bg-[#F8F3E8] p-4 text-sm font-bold text-[#746f69]">
              Sin alertas criticas por ahora.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
