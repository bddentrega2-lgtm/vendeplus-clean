"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Loader2,
  Lock,
  MessageCircle,
  RefreshCcw,
  Search,
  Star,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { formatUsd } from "@/lib/currency";
import { daysSince } from "@/lib/customers/customer-segments";
import { PanelAccessGate, PanelModuleSkeleton } from "@/components/panel/PanelLoadingState";
import {
  getPanelAccessToken,
  getPanelAuthHeaders,
  getSavedPanelPin,
  hasSavedPanelAuth,
  savePanelPin,
  shouldShowPanelInitialAccessGate,
} from "@/lib/panel/client-auth";

type CustomerRow = {
  id: string;
  store_id: string;
  name: string;
  phone: string;
  phone_normalized: string;
  notes: string | null;
  tags: string[];
  orders_count: number | string;
  total_spent_usd: number | string;
  average_ticket_usd: number | string;
  last_order_id: string | null;
  last_order_at: string | null;
  favorite_products: Array<{ name: string; quantity: number; orders: number }>;
  frequent_address: string | null;
  preferred_payment_method: string | null;
  preferred_fulfillment: string | null;
  pending_payments_count?: number;
  badges?: Array<{ key: string; label: string }>;
  stores?: { name?: string; slug?: string } | null;
  last_order?: {
    id: string;
    public_code: string;
    total_usd: number | string;
    created_at: string;
    items: any[];
  } | null;
  repeat_message?: string;
  repeat_whatsapp_url?: string;
  contact_message?: string;
  contact_whatsapp_url?: string;
};

type CustomerOrder = {
  id: string;
  public_code: string;
  status: string;
  payment_status?: string | null;
  payment_method: string;
  delivery_type: string;
  delivery_reference: string | null;
  total_usd: number | string;
  created_at: string;
  order_items?: Array<{
    id: string;
    product_name: string;
    variant_name: string | null;
    quantity: number;
    total_usd: number | string;
  }>;
};

const segmentOptions = [
  { value: "all", label: "Todos" },
  { value: "new", label: "Nuevos" },
  { value: "frequent", label: "Frecuentes" },
  { value: "vip", label: "VIP" },
  { value: "contact", label: "Por contactar" },
  { value: "pending_payment", label: "Pago pendiente" },
  { value: "delivery", label: "Delivery frecuente" },
  { value: "pickup", label: "Retiro frecuente" },
];

function formatDate(value?: string | null) {
  if (!value) return "Sin compras";

  try {
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getLastPurchaseText(value?: string | null) {
  const days = daysSince(value);
  if (days === null) return "Sin última compra";
  if (days === 0) return "Última compra hoy";
  if (days === 1) return "Última compra ayer";
  return `Última compra hace ${days} días`;
}

function getBadgeStyle(key: string) {
  if (key === "vip") return "bg-[#FFB547] text-[#25262B]";
  if (key === "frequent") return "bg-green-100 text-green-700";
  if (key === "contact") return "bg-amber-100 text-amber-800";
  if (key === "pending_payment") return "bg-red-100 text-red-700";
  return "bg-[#F8F3E8] text-[#746f69]";
}

async function apiRequest(pin: string, url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getPanelAuthHeaders(pin)),
      ...(options?.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error en la solicitud.");
  }

  return data;
}

function CustomerDetail({
  customer,
  orders,
  pin,
  onClose,
  onSaved,
}: {
  customer: CustomerRow;
  orders: CustomerOrder[];
  pin: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState(customer.notes || "");
  const [tagsText, setTagsText] = useState((customer.tags || []).join(", "));
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function copyText(text?: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setMessage("Texto copiado.");
    window.setTimeout(() => setMessage(""), 1600);
  }

  async function saveCustomer() {
    setIsSaving(true);
    setMessage("");

    try {
      await apiRequest(pin, `/api/panel/customers/${customer.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          notes,
          tags: tagsText
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      setMessage("Cliente actualizado.");
      onSaved();
    } catch (error: any) {
      setMessage(error.message || "No se pudo guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#25262B]/70 p-4 backdrop-blur-sm">
      <section className="mx-auto max-w-5xl rounded-[34px] bg-[#F8F3E8] p-4 shadow-2xl">
        <div className="rounded-[28px] bg-[#2E3A79] p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFB547]">
                Ficha del cliente
              </p>
              <h2 className="mt-2 text-3xl font-black">{customer.name}</h2>
              <p className="mt-1 text-sm font-semibold text-white/75">
                {customer.phone} · {customer.stores?.name || "Comercio"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 place-items-center rounded-full bg-white/10"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <section className="rounded-2xl bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
              <h3 className="text-lg font-black">Resumen</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-[#F8F3E8] p-3">
                  <p className="text-xs font-bold text-[#746f69]">Pedidos</p>
                  <p className="text-2xl font-black">{customer.orders_count || 0}</p>
                </div>
                <div className="rounded-2xl bg-[#F8F3E8] p-3">
                  <p className="text-xs font-bold text-[#746f69]">Total</p>
                  <p className="text-2xl font-black">
                    {formatUsd(Number(customer.total_spent_usd || 0))}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#F8F3E8] p-3">
                  <p className="text-xs font-bold text-[#746f69]">Ticket</p>
                  <p className="text-2xl font-black">
                    {formatUsd(Number(customer.average_ticket_usd || 0))}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#F8F3E8] p-3">
                  <p className="text-xs font-bold text-[#746f69]">Última</p>
                  <p className="text-sm font-black">{formatDate(customer.last_order_at)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
              <h3 className="text-lg font-black">Preferencias</h3>
              <div className="mt-3 space-y-2 text-sm font-bold text-[#746f69]">
                <p>Pago: {customer.preferred_payment_method || "Sin dato"}</p>
                <p>
                  Modalidad:{" "}
                  {customer.preferred_fulfillment === "pickup"
                    ? "Retiro (pick up)"
                    : customer.preferred_fulfillment === "delivery"
                      ? "Delivery"
                      : "Sin dato"}
                </p>
                <p>Dirección frecuente: {customer.frequent_address || "Sin dato"}</p>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
              <h3 className="text-lg font-black">Productos favoritos</h3>
              <div className="mt-3 space-y-2">
                {(customer.favorite_products || []).length ? (
                  customer.favorite_products.map((product) => (
                    <div
                      key={product.name}
                      className="flex justify-between rounded-2xl bg-[#F8F3E8] px-3 py-2 text-sm font-black"
                    >
                      <span>{product.name}</span>
                      <span>{product.quantity}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-bold text-[#746f69]">
                    Aún no hay productos repetidos.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
              <h3 className="text-lg font-black">Notas internas</h3>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                className="mt-3 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none"
                placeholder="Ej: prefiere delivery en la tarde, pedir referencia..."
              />
              <input
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none"
                placeholder="Tags separados por coma"
              />
              <button
                type="button"
                onClick={saveCustomer}
                disabled={isSaving}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#2E3A79] px-4 py-2 text-xs font-black text-white disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                Guardar nota
              </button>
              {message && <p className="mt-2 text-xs font-black text-[#2E3A79]">{message}</p>}
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
              <h3 className="text-lg font-black">Acciones de recompra</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {customer.repeat_whatsapp_url ? (
                  <a
                    href={customer.repeat_whatsapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-xs font-black text-green-700"
                  >
                    <MessageCircle size={15} />
                    Repetir pedido
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => copyText(customer.repeat_message)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#F8F3E8] px-4 py-2 text-xs font-black text-[#2E3A79]"
                >
                  <Clipboard size={15} />
                  Copiar mensaje
                </button>
                <a
                  href={customer.contact_whatsapp_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#FFB547] px-4 py-2 text-xs font-black text-[#25262B]"
                >
                  <MessageCircle size={15} />
                  Escribir
                </a>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
              <h3 className="text-lg font-black">Historial</h3>
              <div className="mt-3 space-y-3">
                {orders.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-2xl border border-[#25262B]/10 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">{order.public_code}</p>
                        <p className="text-xs font-bold text-[#746f69]">
                          {formatDate(order.created_at)} ·{" "}
                          {order.delivery_type === "pickup"
                            ? "Retiro (pick up)"
                            : "Delivery"}{" "}
                          · {order.payment_method}
                        </p>
                      </div>
                      <p className="font-black">{formatUsd(Number(order.total_usd || 0))}</p>
                    </div>
                    <div className="mt-2 space-y-1">
                      {(order.order_items || []).map((item) => (
                        <p key={item.id} className="text-xs font-bold text-[#746f69]">
                          {item.quantity}x {item.product_name}
                          {item.variant_name ? ` (${item.variant_name})` : ""}
                        </p>
                      ))}
                    </div>
                    <Link
                      href={`/panel/pedidos?orderId=${order.id}`}
                      className="mt-3 inline-flex rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black text-[#2E3A79]"
                    >
                      Ver pedido
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}

export function CustomersManager() {
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() =>
    shouldShowPanelInitialAccessGate()
  );
  const [isLoading, setIsLoading] = useState(() => hasSavedPanelAuth());
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [page, setPage] = useState({ limit: 80, offset: 0, hasMore: false });
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("all");
  const [error, setError] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<CustomerOrder[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadCustomers(
    currentPin: string,
    nextSearch = search,
    nextSegment = segment,
    nextOffset = 0
  ) {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      if (nextSegment !== "all") params.set("segment", nextSegment);
      params.set("limit", String(page.limit));
      params.set("offset", String(nextOffset));

      const data = await apiRequest(
        currentPin,
        `/api/panel/customers${params.toString() ? `?${params}` : ""}`
      );

      setCustomers((current) =>
        nextOffset > 0 ? [...current, ...(data.customers || [])] : data.customers || []
      );
      setSummary(data.summary || null);
      setPage(data.page || { limit: page.limit, offset: nextOffset, hasMore: false });
      setIsUnlocked(true);
      savePanelPin(currentPin);

      if (data.needsMigration) {
        setError(data.error || "Aplica la migración de clientes para activar este módulo.");
      }

      const customerId =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("customerId")
          : null;

      if (customerId && !selectedCustomer) {
        void openCustomerById(customerId, currentPin);
      }
    } catch (error: any) {
      setError(error.message || "No se pudieron cargar los clientes.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }

  async function openCustomer(customer: CustomerRow) {
    await openCustomerById(customer.id);
  }

  async function openCustomerById(customerId: string, currentPin = pin) {
    setIsLoadingDetail(true);
    setError("");

    try {
      const data = await apiRequest(currentPin, `/api/panel/customers/${customerId}`);
      setSelectedCustomer(data.customer);
      setSelectedOrders(data.orders || []);
    } catch (error: any) {
      setError(error.message || "No se pudo abrir el cliente.");
    } finally {
      setIsLoadingDetail(false);
    }
  }

  async function copyReorder(customer: CustomerRow) {
    if (!customer.repeat_message) return;
    await navigator.clipboard.writeText(customer.repeat_message);
    setCopiedId(customer.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  async function rebuildCustomers() {
    setIsBackfilling(true);
    setError("");

    try {
      const data = await apiRequest(pin, "/api/panel/customers/backfill", {
        method: "POST",
        body: JSON.stringify({}),
      });

      setError(
        `Histórico procesado: ${data.processed || 0} pedidos. Omitidos: ${data.skipped || 0}.`
      );
      await loadCustomers(pin);
    } catch (error: any) {
      setError(error.message || "No se pudo reconstruir el histórico de clientes.");
    } finally {
      setIsBackfilling(false);
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
        loadCustomers(savedPin);
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

  const summaryCards = useMemo(
    () => [
      { label: "Clientes", value: summary?.total || 0 },
      { label: "Frecuentes", value: summary?.frequent || 0 },
      { label: "Nuevos", value: summary?.newCustomers || 0 },
      { label: "Por contactar", value: summary?.contact || 0 },
      { label: "Pago pendiente", value: summary?.pendingPayment || 0 },
    ],
    [summary]
  );

  if (isCheckingAccess) {
    return <PanelAccessGate />;
  }

  if (!isUnlocked && isLoading) {
    return <PanelModuleSkeleton label="Cargando clientes..." />;
  }

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso de clientes</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesión para consultar historial de compras y recompra.
        </p>
        <a
          href="/panel/login"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
        >
          <CheckCircle2 size={18} />
          Iniciar sesión
        </a>
        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-5">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#25262B]/[0.06]"
          >
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-black">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#25262B]/[0.06]">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
          <label className="flex items-center gap-3 rounded-2xl bg-[#F8F3E8] px-4 py-3">
            <Search size={18} className="text-[#746f69]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") loadCustomers(pin);
              }}
              placeholder="Buscar cliente por nombre o teléfono..."
              className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-[#746f69]/70"
            />
          </label>

          <select
            value={segment}
            onChange={(event) => {
              const value = event.target.value;
              setSegment(value);
              loadCustomers(pin, search, value);
            }}
            className="rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-black outline-none"
          >
            {segmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => loadCustomers(pin)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Buscar
          </button>
        </div>
        <div className="hidden">
          <p className="text-sm font-bold text-[#746f69]">
            Si es la primera vez que abres Clientes, reconstruye el histórico desde pedidos ya recibidos.
          </p>
          <button
            type="button"
            onClick={rebuildCustomers}
            disabled={isBackfilling || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-4 py-2 text-xs font-black text-[#25262B] disabled:opacity-60"
          >
            {isBackfilling ? <Loader2 size={15} className="animate-spin" /> : null}
            Reconstruir histórico
          </button>
        </div>
        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>

      <section className="space-y-3">
        {!isLoading && customers.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm font-bold text-[#746f69] ring-1 ring-[#25262B]/[0.06]">
            Aún no hay clientes con ese filtro.
          </div>
        ) : null}

        {customers.map((customer) => (
          <article
            key={customer.id}
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#25262B]/[0.06]"
          >
            <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr_auto] xl:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-black">{customer.name}</h3>
                  {(customer.badges || []).slice(0, 3).map((badge) => (
                    <span
                      key={badge.key}
                      className={[
                        "rounded-full px-3 py-1 text-[11px] font-black",
                        getBadgeStyle(badge.key),
                      ].join(" ")}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-sm font-bold text-[#746f69]">
                  {customer.phone} · {customer.stores?.name || "Comercio"}
                </p>
                <p className="mt-1 text-xs font-bold text-[#746f69]">
                  {customer.orders_count || 0} pedidos ·{" "}
                  {getLastPurchaseText(customer.last_order_at)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-[#F8F3E8] px-3 py-2">
                  <p className="text-xs font-bold text-[#746f69]">Total</p>
                  <p className="font-black">
                    {formatUsd(Number(customer.total_spent_usd || 0))}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#F8F3E8] px-3 py-2">
                  <p className="text-xs font-bold text-[#746f69]">Ticket</p>
                  <p className="font-black">
                    {formatUsd(Number(customer.average_ticket_usd || 0))}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 xl:justify-end">
                <a
                  href={customer.contact_whatsapp_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-green-100 px-3 text-xs font-black text-green-700"
                >
                  <MessageCircle size={16} />
                  WhatsApp
                </a>
                <a
                  href={customer.repeat_whatsapp_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#FFB547] px-3 text-xs font-black text-[#25262B]"
                >
                  <Star size={16} />
                  Repetir
                </a>
                <button
                  type="button"
                  onClick={() => copyReorder(customer)}
                  className="grid h-10 w-10 place-items-center rounded-full bg-[#F8F3E8] text-[#2E3A79]"
                  aria-label="Copiar mensaje de recompra"
                >
                  {copiedId === customer.id ? <CheckCircle2 size={16} /> : <Clipboard size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => openCustomer(customer)}
                  disabled={isLoadingDetail}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-3 text-xs font-black text-white disabled:opacity-60"
                >
                  <UserRound size={16} />
                  Ver detalle
                </button>
              </div>
            </div>
          </article>
        ))}

        {page.hasMore ? (
          <button
            type="button"
            onClick={() =>
              loadCustomers(pin, search, segment, customers.length)
            }
            disabled={isLoading}
            className="mx-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            Cargar más clientes
          </button>
        ) : null}
      </section>

      {selectedCustomer ? (
        <CustomerDetail
          customer={selectedCustomer}
          orders={selectedOrders}
          pin={pin}
          onClose={() => setSelectedCustomer(null)}
          onSaved={() => loadCustomers(pin)}
        />
      ) : null}
    </div>
  );
}
