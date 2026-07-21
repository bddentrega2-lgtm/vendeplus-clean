"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
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
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  next_payment_due_at?: string | null;
  created_at?: string | null;
  product_count: number;
  active_product_count: number;
  order_count: number;
  order_count_30d: number;
  user_count: number;
};

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
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusBadge(store: StoreRow) {
  if (!store.is_active) return { label: "Pausado", className: "bg-red-100 text-red-700" };
  if (store.subscription_status === "expired" || store.subscription_status === "past_due") {
    return { label: "Vencido", className: "bg-amber-100 text-amber-700" };
  }
  if (store.plan_type === "trial" || store.subscription_status === "trial") {
    return { label: "Trial", className: "bg-blue-100 text-blue-700" };
  }
  return { label: "Activo", className: "bg-green-100 text-green-700" };
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
      setStores(data.stores || []);
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

      <section className="grid gap-3">
        {filteredStores.map((store) => {
          const badge = statusBadge(store);

          return (
            <article
              key={store.id}
              className="rounded-[26px] bg-white p-4 shadow-xl shadow-[#2E3A79]/[0.06] ring-1 ring-[#25262B]/[0.06]"
            >
              <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_auto] xl:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 size={19} className="text-[#2E3A79]" />
                    <h3 className="text-xl font-black">{store.name}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${badge.className}`}>
                      {badge.label}
                    </span>
                    <span className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black text-[#2E3A79]">
                      {store.plan_type || "trial"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-[#746f69]">
                    /{store.slug} - {store.business_type || "general"} - {store.whatsapp || "sin WhatsApp"}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#746f69]">
                    Vence/cobra: {formatDate(store.next_payment_due_at || store.trial_ends_at)} - Creado: {formatDate(store.created_at)}
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-2xl bg-[#F8F3E8] px-3 py-2">
                    <p className="text-lg font-black">{store.active_product_count}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#746f69]">Productos</p>
                  </div>
                  <div className="rounded-2xl bg-[#F8F3E8] px-3 py-2">
                    <p className="text-lg font-black">{store.order_count}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#746f69]">Pedidos</p>
                  </div>
                  <div className="rounded-2xl bg-[#F8F3E8] px-3 py-2">
                    <p className="text-lg font-black">{store.order_count_30d}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#746f69]">30 dias</p>
                  </div>
                  <div className="rounded-2xl bg-[#F8F3E8] px-3 py-2">
                    <p className="text-lg font-black">{store.user_count}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#746f69]">Usuarios</p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                  <Link
                    href={`/admin/comercios/${store.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25262B] px-4 py-3 text-sm font-black text-white"
                  >
                    <Pencil size={16} />
                    Ver
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleStore(store)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F8F3E8] px-4 py-3 text-sm font-black text-[#2E3A79]"
                  >
                    {store.is_active ? <PauseCircle size={16} /> : <CheckCircle2 size={16} />}
                    {store.is_active ? "Pausar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyStoreLink(store)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-[#2E3A79] ring-1 ring-[#25262B]/10"
                  >
                    <Copy size={16} />
                    Copiar
                  </button>
                  <a
                    href={`/${store.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-4 py-3 text-sm font-black text-white"
                  >
                    <ExternalLink size={16} />
                    Catalogo
                  </a>
                </div>
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
