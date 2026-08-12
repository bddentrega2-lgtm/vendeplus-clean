"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  PauseCircle,
  Pencil,
  PlusCircle,
  RefreshCcw,
  Search,
} from "lucide-react";
import {
  getPanelAuthHeaders,
  getSavedPanelToken,
  hasSavedPanelAuth,
} from "@/lib/panel/client-auth";
import { buildClientPublicUrl } from "@/lib/public-url";
import { getPlan } from "@/lib/plans";

type StoreRow = {
  id: string;
  slug: string;
  name: string;
  business_type: string | null;
  whatsapp: string | null;
  is_active: boolean;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  plan_type?: string | null;
  service_fee_payer?: string | null;
  subscription_status?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  subscription_started_at?: string | null;
  subscription_ends_at?: string | null;
  next_payment_due_at?: string | null;
  monthly_price_usd?: number | null;
  billing_notes?: string | null;
  last_payment_at?: string | null;
  created_at?: string | null;
  product_count: number;
  active_product_count: number;
  order_count: number;
  order_count_30d: number;
  user_count: number;
  somos_billed_usd: number;
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getSomosBillingLabel(store: StoreRow) {
  if (["trial", "founder"].includes(String(store.plan_type || ""))) return "Sin cobro";
  return formatUsd(store.somos_billed_usd);
}

async function apiRequest(pin: string, path = "/api/admin/stores", options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getPanelAuthHeaders(pin)),
      ...(options?.headers || {}),
    },
  });
  const data = await response.json();

  if (!response.ok) throw new Error(data.error || "Error cargando comercios.");

  return data;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function getTodayDateOnly() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getStoreCutoff(store: StoreRow) {
  return store.next_payment_due_at || store.subscription_ends_at || store.trial_ends_at || null;
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function dateInputToDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getCutoffStatus(value?: string | null) {
  if (!value) {
    return {
      label: "Sin fecha",
      daysLabel: "Configurar",
      daysRemaining: null,
      className: "bg-amber-50 text-amber-700 ring-amber-200",
      isUrgent: true,
    };
  }

  const daysRemaining = Math.round((dateInputToDate(toDateInput(value)).getTime() - getTodayDateOnly().getTime()) / DAY_MS);

  if (daysRemaining < 0) {
    return {
      label: "Vencido",
      daysLabel: `${Math.abs(daysRemaining)} días vencido`,
      daysRemaining,
      className: "bg-red-50 text-red-700 ring-red-200",
      isUrgent: true,
    };
  }

  if (daysRemaining === 0) {
    return {
      label: "Activo",
      daysLabel: "Vence hoy",
      daysRemaining,
      className: "bg-red-50 text-red-700 ring-red-200",
      isUrgent: true,
    };
  }

  if (daysRemaining < 3) {
    return {
      label: "Activo",
      daysLabel: `${daysRemaining} días`,
      daysRemaining,
      className: "bg-red-50 text-red-700 ring-red-200",
      isUrgent: true,
    };
  }

  return {
    label: "Activo",
    daysLabel: `${daysRemaining} días`,
    daysRemaining,
    className: "bg-green-50 text-green-700 ring-green-200",
    isUrgent: false,
  };
}

export function AdminStoresManager() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => hasSavedPanelAuth());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recentThresholdMs, setRecentThresholdMs] = useState(0);
  const [cutoffDrafts, setCutoffDrafts] = useState<Record<string, string>>({});
  const [savingCutoffId, setSavingCutoffId] = useState("");

  const filteredStores = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return stores.filter((store) => {
      const matchesQuery =
        !needle ||
        [store.name, store.slug, store.business_type, store.whatsapp]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && store.is_active) ||
        (filter === "paused" && !store.is_active) ||
        (filter === "trial" && (store.plan_type === "trial" || store.subscription_status === "trial")) ||
        (filter === "expired" && ["expired", "past_due"].includes(String(store.subscription_status))) ||
        (filter === "delivery" && store.accepts_delivery) ||
        (filter === "no_products" && !store.active_product_count) ||
        (filter === "recent" &&
          store.created_at &&
          new Date(store.created_at).getTime() >= recentThresholdMs) ||
        filter === store.plan_type;

      return matchesQuery && matchesFilter;
    });
  }, [filter, query, recentThresholdMs, stores]);

  async function loadStores() {
    setIsLoading(true);
    setError("");

    try {
      const data = await apiRequest("");
      const loadedStores = data.stores || [];
      setStores(loadedStores);
      setCutoffDrafts(
        Object.fromEntries(
          loadedStores.map((store: StoreRow) => [store.id, toDateInput(getStoreCutoff(store))])
        )
      );
      setIsUnlocked(true);
    } catch (error: any) {
      setError(error.message || "No se pudo cargar comercios.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }

  async function toggleStore(store: StoreRow) {
    setMessage("");
    setError("");

    try {
      const action = store.is_active ? "pause" : "activate";
      const data = await apiRequest("", `/api/admin/stores/${store.id}/${action}`, {
        method: "POST",
      });
      setMessage(data.message || "Comercio actualizado.");
      await loadStores();
    } catch (error: any) {
      setError(error.message || "No se pudo actualizar el comercio.");
    }
  }

  async function copyStoreLink(store: StoreRow) {
    await navigator.clipboard.writeText(buildClientPublicUrl(`/${store.slug}`));
    setMessage(`Link copiado: /${store.slug}`);
  }

  async function saveCutoffDate(store: StoreRow) {
    const cutoffDate = cutoffDrafts[store.id];
    setMessage("");
    setError("");

    if (!cutoffDate) {
      setError("Elige una fecha de corte para guardar.");
      return;
    }

    setSavingCutoffId(store.id);

    try {
      const status = dateInputToDate(cutoffDate).getTime() < getTodayDateOnly().getTime() ? "past_due" : "active";
      const planType = store.plan_type || "monthly";
      const data = await apiRequest("", `/api/admin/stores/${store.id}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({
          plan_type: planType,
          service_fee_payer: store.service_fee_payer || "merchant",
          subscription_status: status,
          trial_started_at: store.trial_started_at || null,
          trial_ends_at: cutoffDate,
          subscription_started_at: store.subscription_started_at || new Date().toISOString().slice(0, 10),
          subscription_ends_at: cutoffDate,
          next_payment_due_at: cutoffDate,
          monthly_price_usd: store.monthly_price_usd ?? 0,
          billing_notes: store.billing_notes || null,
          last_payment_at: store.last_payment_at || null,
        }),
      });

      setStores((current) =>
        current.map((entry) =>
          entry.id === store.id
            ? {
                ...entry,
                ...data.store,
                product_count: entry.product_count,
                active_product_count: entry.active_product_count,
                order_count: entry.order_count,
                order_count_30d: entry.order_count_30d,
                user_count: entry.user_count,
              }
            : entry
        )
      );
      setCutoffDrafts((current) => ({ ...current, [store.id]: cutoffDate }));
      setMessage(
        status === "past_due"
          ? `${store.name} quedó vencido con corte ${formatDate(cutoffDate)}.`
          : `${store.name} quedó activo hasta ${formatDate(cutoffDate)}.`
      );
    } catch (error: any) {
      setError(error.message || "No se pudo guardar la fecha de corte.");
    } finally {
      setSavingCutoffId("");
    }
  }

  useEffect(() => {
    setRecentThresholdMs(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const savedToken = getSavedPanelToken();

    if (savedToken) {
      loadStores();
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

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#25262B] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso fundador</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesion con un email fundador para administrar comercios.
        </p>
        <a
          href="/panel/login"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
        >
          <CheckCircle2 size={18} />
          Iniciar sesion
        </a>
        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>
    );
  }

  const filters = [
    ["all", "Todos"],
    ["active", "Activos"],
    ["paused", "Pausados"],
    ["trial", "Trial"],
    ["expired", "Vencidos"],
    ["monthly", "Mensual"],
    ["per_service", "Por servicio"],
    ["delivery", "Con delivery"],
    ["no_products", "Sin productos"],
    ["recent", "Recientes"],
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
              Directorio comercial
            </p>
            <h2 className="mt-1 text-3xl font-black">
              {filteredStores.length} de {stores.length} comercios
            </h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex items-center gap-2 rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3">
              <Search size={17} className="text-[#746f69]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nombre, slug, rubro o WhatsApp"
                className="w-full bg-transparent text-sm font-bold outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => loadStores()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F8F3E8] px-4 py-3 text-sm font-black text-[#2E3A79]"
            >
              <RefreshCcw size={16} />
              Actualizar
            </button>
            <Link
              href="/admin/comercios/nuevo"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B]"
            >
              <PlusCircle size={16} />
              Nuevo
            </Link>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={[
                "shrink-0 rounded-full px-4 py-2 text-xs font-black",
                filter === value ? "bg-[#25262B] text-white" : "bg-[#F8F3E8] text-[#746f69]",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        {message ? <p className="mt-3 text-sm font-black text-green-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm font-black text-red-600">{error}</p> : null}
      </section>

      <section className="overflow-hidden rounded-[24px] bg-white shadow-xl shadow-[#2E3A79]/[0.06] ring-1 ring-[#25262B]/[0.06]">
        <div className="hidden grid-cols-[minmax(220px,1fr)_110px_92px_130px_135px_170px_270px] gap-3 border-b border-[#25262B]/10 bg-[#F8F3E8] px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69] xl:grid">
          <span>Comercio</span>
          <span>Plan</span>
          <span>Total pedidos</span>
          <span>Estado</span>
          <span>Facturado Somos</span>
          <span>Fecha de corte</span>
          <span className="text-right">Acciones</span>
        </div>

        {filteredStores.map((store) => {
          const cutoff = getStoreCutoff(store);
          const status = getCutoffStatus(cutoff);
          const draftDate = cutoffDrafts[store.id] ?? toDateInput(cutoff);
          const isSaving = savingCutoffId === store.id;
          const isDraftDirty = draftDate !== toDateInput(cutoff);

          return (
            <article
              key={store.id}
              className="grid gap-3 border-b border-[#25262B]/10 px-4 py-3 last:border-b-0 xl:min-h-[78px] xl:grid-cols-[minmax(220px,1fr)_110px_92px_130px_135px_170px_270px] xl:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-black">{store.name}</h3>
                  {!store.is_active && (
                    <span className="rounded-full bg-red-100 px-2 py-1 text-[11px] font-black text-red-700">
                      Pausado
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs font-bold text-[#746f69]">
                  /{store.slug} · {store.business_type || "general"} · {store.whatsapp || "sin WhatsApp"}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69] xl:hidden">Plan</p>
                <p className="text-sm font-black text-[#2E3A79]">{getPlan(store.plan_type).name}</p>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69] xl:hidden">
                  Total pedidos
                </p>
                <p className="text-base font-black text-[#25262B]">{store.order_count}</p>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69] xl:hidden">
                  Estado
                </p>
                <p className={["text-sm font-black leading-tight", status.isUrgent ? "text-red-700" : "text-green-700"].join(" ")}>
                  {status.daysLabel}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69] xl:hidden">Facturado Somos</p>
                <p className="text-sm font-black text-[#25262B]">{getSomosBillingLabel(store)}</p>
                {store.plan_type === "per_service" ? (
                  <p className="text-[11px] font-bold text-[#746f69]">Corte actual</p>
                ) : null}
              </div>

              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69] xl:hidden">
                  Fecha de corte
                </span>
                <input
                  type="date"
                  value={draftDate}
                  onChange={(event) =>
                    setCutoffDrafts((current) => ({ ...current, [store.id]: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-[#25262B]/10 bg-white px-3 py-2 text-sm font-black text-[#25262B] outline-none focus:border-[#2E3A79]"
                />
              </label>

              <div className="flex flex-wrap justify-start gap-1.5 xl:flex-nowrap xl:justify-end">
                <button
                  type="button"
                  onClick={() => saveCutoffDate(store)}
                  disabled={isSaving || !draftDate}
                  className={[
                    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-black",
                    isDraftDirty
                      ? "bg-[#FFB547] text-[#25262B]"
                      : "bg-[#F8F3E8] text-[#2E3A79]",
                    isSaving || !draftDate ? "cursor-not-allowed opacity-60" : "",
                  ].join(" ")}
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Guardar
                </button>
                <Link
                  href={`/admin/comercios/${store.id}`}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#25262B] px-3 text-xs font-black text-white"
                >
                  <Pencil size={14} />
                  Ver
                </Link>
                <button
                  type="button"
                  onClick={() => toggleStore(store)}
                  title={store.is_active ? "Pausar comercio" : "Activar comercio"}
                  aria-label={store.is_active ? "Pausar comercio" : "Activar comercio"}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#F8F3E8] text-[#2E3A79]"
                >
                  {store.is_active ? <PauseCircle size={14} /> : <CheckCircle2 size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => copyStoreLink(store)}
                  title="Copiar link"
                  aria-label="Copiar link"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#2E3A79] ring-1 ring-[#25262B]/10"
                >
                  <Copy size={14} />
                </button>
                <a
                  href={`/${store.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir catálogo"
                  aria-label="Abrir catálogo"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#2E3A79] text-white"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </article>
          );
        })}

        {filteredStores.length === 0 && (
          <section className="rounded-[28px] bg-white p-6 text-sm font-bold text-[#746f69] shadow-xl shadow-[#2E3A79]/[0.06]">
            No hay comercios que coincidan con la busqueda.
          </section>
        )}
      </section>
    </div>
  );
}
