"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  Navigation,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Truck,
  X,
} from "lucide-react";
import { formatBs, formatUsd } from "@/lib/currency";
import {
  getPanelAuthHeaders,
  getPanelAccessToken,
  getSavedPanelPin,
  hasSavedPanelAuth,
  savePanelPin,
  shouldShowPanelInitialAccessGate,
} from "@/lib/panel/client-auth";
import { PanelAccessGate, PanelModuleSkeleton } from "@/components/panel/PanelLoadingState";

type OrderItem = {
  id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price_usd: number | string;
  total_usd: number | string;
  notes: string | null;
};

type OrderRow = {
  id: string;
  public_code: string;
  customer_name: string;
  customer_phone: string;
  delivery_type: "delivery" | "pickup";
  payment_method: string;
  subtotal_usd: number | string;
  delivery_usd: number | string;
  total_usd: number | string;
  total_bs: number | string;
  distance_km: number | string | null;
  delivery_lat: number | string | null;
  delivery_lng: number | string | null;
  delivery_reference: string | null;
  order_details: string | null;
  notes: string | null;
  status: string;
  whatsapp_message: string | null;
  created_at: string;
  stores?: {
    name?: string;
    latitude?: number | string | null;
    longitude?: number | string | null;
  } | null;
  order_items?: OrderItem[];
  order_integrations?: OrderIntegration[];
};

type OrderIntegration = {
  provider: string;
  external_id: string | null;
  status: string;
  last_error: string | null;
  updated_at: string | null;
};

const statusOptions = [
  { value: "all", label: "Todos" },
  { value: "received", label: "Nuevos" },
  { value: "accepted", label: "Aceptados" },
  { value: "preparing", label: "Preparando" },
  { value: "ready", label: "Listos" },
  { value: "delivering", label: "En camino" },
  { value: "completed", label: "Completados" },
  { value: "cancelled", label: "Cancelados" },
];

const statusLabels: Record<string, string> = {
  received: "Nuevo",
  accepted: "Aceptado",
  preparing: "Preparando",
  ready: "Listo",
  delivering: "En camino",
  completed: "Completado",
  cancelled: "Cancelado",
};

const statusStyles: Record<string, string> = {
  received: "bg-[#FFB547] text-[#25262B]",
  accepted: "bg-indigo-100 text-indigo-700",
  preparing: "bg-yellow-100 text-yellow-800",
  ready: "bg-orange-100 text-orange-700",
  delivering: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const entrega2StatusLabels: Record<string, string> = {
  sending: "Enviando",
  sent: "Enviado",
  accepted: "Aceptado",
  assigned: "Asignado",
  delivering: "En camino",
  delivered: "Entregado",
  completed: "Completado",
  error: "Error",
  failed: "Error",
};

const entrega2StatusStyles: Record<string, string> = {
  sending: "bg-blue-100 text-blue-700",
  sent: "bg-indigo-100 text-indigo-700",
  accepted: "bg-indigo-100 text-indigo-700",
  assigned: "bg-indigo-100 text-indigo-700",
  delivering: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
};

const dateOptions = [
  { value: "all", label: "Todas las fechas" },
  { value: "today", label: "Hoy" },
  { value: "last_7_days", label: "Últimos 7 días" },
  { value: "last_30_days", label: "Últimos 30 días" },
];

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getGpsUrl(order: OrderRow) {
  if (!order.delivery_lat || !order.delivery_lng) return null;
  return `https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`;
}

function getRouteUrl(order: OrderRow) {
  if (
    !order.delivery_lat ||
    !order.delivery_lng ||
    !order.stores?.latitude ||
    !order.stores?.longitude
  ) {
    return null;
  }

  return `https://www.google.com/maps/dir/?api=1&origin=${order.stores.latitude},${order.stores.longitude}&destination=${order.delivery_lat},${order.delivery_lng}&travelmode=driving`;
}

function getWhatsappUrl(phone: string) {
  const cleanPhone = String(phone || "").replace(/[^0-9]/g, "");
  if (!cleanPhone) return null;
  return `https://wa.me/${cleanPhone}`;
}

function getEntrega2Integration(order: OrderRow) {
  return (order.order_integrations || []).find(
    (integration) => integration.provider === "entrega2"
  );
}

function canSendToEntrega2(order: OrderRow) {
  const integration = getEntrega2Integration(order);

  if (order.delivery_type !== "delivery") return false;
  if (!integration) return true;

  return ["error", "failed"].includes(integration.status);
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

function OrderDetail({
  order,
  pin,
  onClose,
  onUpdated,
}: {
  order: OrderRow;
  pin: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState(order.status);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const gpsUrl = getGpsUrl(order);
  const routeUrl = getRouteUrl(order);

  async function updateStatus(nextStatus: string) {
    setStatus(nextStatus);
    setIsSaving(true);

    try {
      await apiRequest(pin, "/api/panel/orders", {
        method: "PATCH",
        body: JSON.stringify({
          id: order.id,
          status: nextStatus,
        }),
      });

      onUpdated();
    } finally {
      setIsSaving(false);
    }
  }

  async function copyCommand() {
    const text =
      order.whatsapp_message ||
      `${order.public_code}\n${order.customer_name}\n${formatUsd(Number(order.total_usd || 0))}`;

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#25262B]/70 p-4 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl rounded-[36px] bg-[#F8F3E8] p-4 shadow-2xl">
        <div className="rounded-[32px] bg-[#2E3A79] p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
                Detalle del pedido
              </p>
              <h2 className="mt-2 text-3xl font-black">{order.public_code}</h2>
              <p className="mt-2 text-sm font-semibold text-white/75">
                {order.stores?.name || "Comercio"} · {formatDate(order.created_at)}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 place-items-center rounded-full bg-white/10"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06]">
            <h3 className="text-xl font-black">Productos</h3>

            <div className="mt-4 space-y-3">
              {(order.order_items || []).map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-[#25262B]/10 p-4"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-black">
                        {item.quantity}x {item.product_name}
                        {item.variant_name ? ` (${item.variant_name})` : ""}
                      </p>
                      {item.notes && (
                        <p className="mt-1 text-xs font-bold text-[#746f69]">
                          Nota: {item.notes}
                        </p>
                      )}
                    </div>
                    <p className="font-black">{formatUsd(Number(item.total_usd || 0))}</p>
                  </div>
                </div>
              ))}
            </div>

            {order.order_details && (
              <div className="mt-4 rounded-3xl bg-[#F8F3E8] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#746f69]">
                  Detalle adicional
                </p>
                <p className="mt-1 text-sm font-bold">{order.order_details}</p>
              </div>
            )}

            {order.notes && (
              <div className="mt-4 rounded-3xl bg-[#F8F3E8] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#746f69]">
                  Notas
                </p>
                <p className="mt-1 text-sm font-bold">{order.notes}</p>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06]">
              <h3 className="text-xl font-black">Cliente</h3>
              <div className="mt-4 space-y-3 text-sm font-bold">
                <p>Cliente: {order.customer_name}</p>
                <p>Teléfono: {order.customer_phone}</p>
                <p>Pago: {order.payment_method}</p>
                <p>Modalidad: {order.delivery_type === "delivery" ? "Entrega" : "Retiro"}</p>
              </div>
            </section>

            <section className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06]">
              <h3 className="text-xl font-black">Totales</h3>
              <div className="mt-4 space-y-2 text-sm font-bold">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatUsd(Number(order.subtotal_usd || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Entrega</span>
                  <span>{formatUsd(Number(order.delivery_usd || 0))}</span>
                </div>
                <div className="flex justify-between border-t border-[#25262B]/10 pt-3 text-lg font-black">
                  <span>Total</span>
                  <span>{formatUsd(Number(order.total_usd || 0))}</span>
                </div>
                <div className="text-right text-xs font-black text-[#746f69]">
                  {formatBs(Number(order.total_bs || 0))}
                </div>
              </div>
            </section>

            <section className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06]">
              <h3 className="text-xl font-black">Estado</h3>

              <select
                value={status}
                onChange={(event) => updateStatus(event.target.value)}
                className="mt-4 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none"
              >
                {statusOptions
                  .filter((item) => item.value !== "all")
                  .map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
              </select>

              {isSaving && (
                <p className="mt-2 inline-flex items-center gap-2 text-xs font-black text-[#2E3A79]">
                  <Loader2 size={14} className="animate-spin" />
                  Guardando estado...
                </p>
              )}
            </section>

            <section className="rounded-[32px] bg-[#25262B] p-5 text-white shadow-xl shadow-[#25262B]/20">
              <h3 className="text-xl font-black">Acciones</h3>

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={copyCommand}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B]"
                >
                  <Clipboard size={16} />
                  {copied ? "Pedido copiado" : "Copiar pedido"}
                </button>

                {gpsUrl && (
                  <a
                    href={gpsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm font-black"
                  >
                    <MapPin size={16} />
                    Abrir GPS
                  </a>
                )}

                {routeUrl && (
                  <a
                    href={routeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm font-black"
                  >
                    <Navigation size={16} />
                    Abrir ruta
                  </a>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function OrdersManager() {
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedDate, setSelectedDate] = useState("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("all");
  const [selectedDeliveryType, setSelectedDeliveryType] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => shouldShowPanelInitialAccessGate());
  const [isLoading, setIsLoading] = useState(() => hasSavedPanelAuth());
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [sendingDeliveryId, setSendingDeliveryId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadOrders(
    currentPin: string,
    filters = {
      status: selectedStatus,
      date: selectedDate,
      paymentMethod: selectedPaymentMethod,
      deliveryType: selectedDeliveryType,
    }
  ) {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.date !== "all") params.set("date", filters.date);
      if (filters.paymentMethod !== "all") {
        params.set("paymentMethod", filters.paymentMethod);
      }
      if (filters.deliveryType !== "all") {
        params.set("deliveryType", filters.deliveryType);
      }
      const queryString = params.toString() ? `?${params.toString()}` : "";
      const data = await apiRequest(currentPin, `/api/panel/orders${queryString}`);

      setOrders(data.orders || []);
      setIsUnlocked(true);
      savePanelPin(currentPin);
    } catch (error: any) {
      setError(error.message || "No se pudieron cargar los pedidos.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }

  const filteredOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();

    if (!needle) return orders;

    return orders.filter((order) => {
      return [
        order.public_code,
        order.customer_name,
        order.customer_phone,
        order.stores?.name,
        order.payment_method,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [orders, search]);

  const paymentMethodOptions = useMemo(() => {
    const values = Array.from(
      new Set(orders.map((order) => order.payment_method).filter(Boolean))
    );

    return [
      { value: "all", label: "Todos los pagos" },
      ...values.map((value) => ({ value, label: value })),
    ];
  }, [orders]);

  async function updateOrderStatusQuick(orderId: string, nextStatus: string) {
    setSavingStatusId(orderId);
    setError("");

    try {
      await apiRequest(pin, "/api/panel/orders", {
        method: "PATCH",
        body: JSON.stringify({
          id: orderId,
          status: nextStatus,
        }),
      });

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId ? { ...order, status: nextStatus } : order
        )
      );
    } catch (error: any) {
      setError(error.message || "No se pudo actualizar el estado.");
    } finally {
      setSavingStatusId(null);
    }
  }

  async function sendOrderToEntrega2(orderId: string) {
    setSendingDeliveryId(orderId);
    setError("");

    try {
      await apiRequest(pin, `/api/panel/orders/${orderId}/send-delivery`, {
        method: "POST",
      });

      await loadOrders(pin);
    } catch (error: any) {
      setError(error.message || "No se pudo enviar el pedido a Entrega2.");
    } finally {
      setSendingDeliveryId(null);
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
        loadOrders(savedPin);
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

  if (isCheckingAccess) {
    return <PanelAccessGate />;
  }

  if (!isUnlocked && isLoading) {
    return <PanelModuleSkeleton label="Cargando pedidos..." />;
  }

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso de pedidos</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesión con tu usuario autorizado para continuar.
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
      <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <h2 className="text-2xl font-black">Pedidos operativos</h2>
            <p className="text-sm font-bold text-[#746f69]">
              {filteredOrders.length} pedidos visibles · {orders.length} cargados
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/panel/pedidos/nuevo"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
            >
              <Plus size={16} />
              Crear pedido
            </Link>
            <button
              type="button"
              onClick={() => loadOrders(pin)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white"
            >
              <RefreshCcw size={16} />
              Actualizar
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_180px_180px_180px_180px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#746f69]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por código, cliente, teléfono o comercio..."
              className="w-full rounded-2xl border border-[#25262B]/10 bg-white py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedStatus(value);
              loadOrders(pin, { status: value, date: selectedDate, paymentMethod: selectedPaymentMethod, deliveryType: selectedDeliveryType });
            }}
            className="rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
          >
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <select
            value={selectedDate}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedDate(value);
              loadOrders(pin, { status: selectedStatus, date: value, paymentMethod: selectedPaymentMethod, deliveryType: selectedDeliveryType });
            }}
            className="rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
          >
            {dateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={selectedPaymentMethod}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedPaymentMethod(value);
              loadOrders(pin, { status: selectedStatus, date: selectedDate, paymentMethod: value, deliveryType: selectedDeliveryType });
            }}
            className="rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
          >
            {paymentMethodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={selectedDeliveryType}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedDeliveryType(value);
              loadOrders(pin, { status: selectedStatus, date: selectedDate, paymentMethod: selectedPaymentMethod, deliveryType: value });
            }}
            className="rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
          >
            <option value="all">Entrega y retiro</option>
            <option value="delivery">Solo entrega</option>
            <option value="pickup">Solo retiro</option>
          </select>
        </div>
      </section>

      <section className="grid gap-4">
        {isLoading && (
          <div className="rounded-[32px] bg-white p-5 text-sm font-black text-[#746f69]">
            Cargando pedidos...
          </div>
        )}

        {!isLoading && filteredOrders.length === 0 && (
          <div className="rounded-[32px] bg-white p-6 text-sm font-bold text-[#746f69] shadow-xl shadow-[#2E3A79]/[0.07]">
            Todavía no hay pedidos en este período.
          </div>
        )}

        {filteredOrders.map((order) => {
          const gpsUrl = getGpsUrl(order);
          const routeUrl = getRouteUrl(order);
          const whatsappUrl = getWhatsappUrl(order.customer_phone);
          const entrega2Integration = getEntrega2Integration(order);
          const entrega2Status = entrega2Integration?.status || "";
          const showEntrega2Button = canSendToEntrega2(order);
          const isSendingDelivery = sendingDeliveryId === order.id;
          const isNewOrder = order.status === "received";

          return (
            <article
              key={order.id}
              className={[
                "rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1",
                isNewOrder
                  ? "ring-2 ring-[#FFB547]"
                  : "ring-[#25262B]/[0.06]",
              ].join(" ")}
            >
              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.7fr_0.5fr] xl:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-black">{order.public_code}</h3>
                    {isNewOrder && (
                      <span className="rounded-full bg-[#25262B] px-3 py-1 text-xs font-black text-white">
                        Pendiente de atención
                      </span>
                    )}
                    <span
                      className={[
                        "rounded-full px-3 py-1 text-xs font-black",
                        statusStyles[order.status] || "bg-[#F8F3E8] text-[#746f69]",
                      ].join(" ")}
                    >
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-[#746f69]">
                    {order.stores?.name || "Comercio"} · {formatDate(order.created_at)}
                  </p>
                </div>

                <div>
                  <p className="font-black">{order.customer_name}</p>
                  <p className="text-sm font-bold text-[#746f69]">
                    {order.customer_phone}
                  </p>
                </div>

                <div>
                  <p className="font-black">{formatUsd(Number(order.total_usd || 0))}</p>
                  <p className="text-xs font-bold text-[#746f69]">
                    {order.delivery_type === "delivery" ? "Entrega" : "Retiro"} · {order.payment_method}
                  </p>
                  {(order.delivery_reference || order.order_details) && (
                    <p className="mt-1 text-xs font-bold text-[#746f69]">
                      {order.delivery_reference || order.order_details}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  <select
                    aria-label="Cambio rápido de estado"
                    value={order.status}
                    disabled={savingStatusId === order.id}
                    onChange={(event) =>
                      updateOrderStatusQuick(order.id, event.target.value)
                    }
                    className="h-11 rounded-full border border-[#25262B]/10 bg-[#F8F3E8] px-3 text-xs font-black text-[#25262B] outline-none disabled:opacity-60"
                  >
                    {statusOptions
                      .filter((item) => item.value !== "all")
                      .map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                  </select>
                  {gpsUrl && (
                    <a
                      href={gpsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid h-11 w-11 place-items-center rounded-full bg-[#F8F3E8] text-[#2E3A79]"
                    >
                      <ExternalLink size={17} />
                    </a>
                  )}

                  {routeUrl && (
                    <a
                      href={routeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid h-11 w-11 place-items-center rounded-full bg-[#F8F3E8] text-[#2E3A79]"
                      aria-label="Abrir ruta"
                    >
                      <Navigation size={17} />
                    </a>
                  )}

                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-green-100 px-4 text-xs font-black text-green-700"
                      aria-label="Abrir WhatsApp"
                    >
                      <Send size={17} />
                      WhatsApp
                    </a>
                  )}

                  {order.delivery_type === "delivery" && (
                    <>
                      {entrega2Integration && (
                        <span
                          title={entrega2Integration.last_error || undefined}
                          className={[
                            "inline-flex h-11 items-center rounded-full px-3 text-xs font-black",
                            entrega2StatusStyles[entrega2Status] ||
                              "bg-[#F8F3E8] text-[#746f69]",
                          ].join(" ")}
                        >
                          Entrega2:{" "}
                          {entrega2StatusLabels[entrega2Status] ||
                            entrega2Status ||
                            "Registrado"}
                        </span>
                      )}

                      {showEntrega2Button && (
                        <button
                          type="button"
                          onClick={() => sendOrderToEntrega2(order.id)}
                          disabled={isSendingDelivery}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-4 text-xs font-black text-white disabled:opacity-60"
                        >
                          {isSendingDelivery ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Truck size={16} />
                          )}
                          {entrega2Integration ? "Reintentar Entrega2" : "Enviar a Entrega2"}
                        </button>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className="rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
                  >
                    Ver resumen
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          pin={pin}
          onClose={() => setSelectedOrder(null)}
          onUpdated={() => loadOrders(pin)}
        />
      )}
    </div>
  );
}


