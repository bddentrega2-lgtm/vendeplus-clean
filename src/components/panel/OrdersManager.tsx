"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CircleDollarSign,
  Clipboard,
  SlidersHorizontal,
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
import { getSuggestedPaymentCurrency } from "@/lib/payments";
import {
  getPanelAccessToken,
  getSavedPanelPin,
  hasSavedPanelAuth,
  savePanelPin,
  shouldShowPanelInitialAccessGate,
} from "@/lib/panel/client-auth";
import {
  playNewOrderSound,
  unlockOrderNotificationSound,
} from "@/lib/panel/order-notification-sound";
import {
  NewOrderToast,
  type NewOrderToastData,
} from "@/components/panel/NewOrderToast";
import { PanelAccessGate, PanelModuleSkeleton } from "@/components/panel/PanelLoadingState";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  apiRequest,
  buildPaymentDataText,
  canSendToEntrega2,
  canSendToTransportAgency,
  dateOptions,
  entrega2StatusLabels,
  entrega2StatusStyles,
  formatDate,
  formatOrderAge,
  getCurrentTransportOrder,
  getDeliverySummary,
  getEntrega2Integration,
  getGpsUrl,
  getOrderPaymentStatus,
  getPaymentDetailsLines,
  getPaymentStatusLabel,
  getRouteUrl,
  getStatusOptionsForOrder,
  getTransportAgencyIntegration,
  getWhatsappMessageUrl,
  getWhatsappUrl,
  groupOrderItemOptions,
  hasActiveTransportAgencyHandoff,
  isDeliveryAlreadyDelivered,
  paymentStatusOptions,
  paymentStatusStyles,
  statusOptions,
  transportStatusLabels,
  type OrderRow,
} from "@/components/panel/orders/orders-manager-helpers";
import {
  buildOrdersQueryString,
  useOrderFilters,
  type OrderFilters,
} from "@/components/panel/orders/use-order-filters";

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
  const [paymentCopied, setPaymentCopied] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentDraft, setPaymentDraft] = useState({
    paymentStatus: getOrderPaymentStatus(order),
    paymentReference: order.payment_reference || "",
    paymentCurrency:
      order.payment_currency || getSuggestedPaymentCurrency(order.payment_method) || "VES",
    amountPaid: order.amount_paid ? String(order.amount_paid) : "",
    paymentBank: order.payment_bank || "",
    paymentNotes: order.payment_notes || "",
  });
  const gpsUrl = getGpsUrl(order);
  const routeUrl = getRouteUrl(order);
  const requestReferenceUrl = getWhatsappMessageUrl(
    order.customer_phone,
    `Hola, para confirmar tu pedido ${order.public_code}, por favor envíanos la referencia del pago o captura. Gracias.`
  );
  const currentTransportOrder = getCurrentTransportOrder(order);
  const hasAgencyHandoff = hasActiveTransportAgencyHandoff(order);
  const agencyWhatsappUrl = currentTransportOrder?.agency_whatsapp_snapshot
    ? `https://wa.me/${String(currentTransportOrder.agency_whatsapp_snapshot).replace(/[^0-9]/g, "")}`
    : null;

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

  async function copyPaymentData() {
    await navigator.clipboard.writeText(buildPaymentDataText(order));
    setPaymentCopied(true);
    setTimeout(() => setPaymentCopied(false), 1800);
  }

  async function savePayment(nextStatus?: string) {
    setIsSavingPayment(true);
    setPaymentMessage("");

    const statusToSave = nextStatus || paymentDraft.paymentStatus;

    try {
      await apiRequest(pin, `/api/panel/orders/${order.id}/payment`, {
        method: "PATCH",
        body: JSON.stringify({
          ...paymentDraft,
          paymentStatus: statusToSave,
          amountPaid: paymentDraft.amountPaid ? Number(paymentDraft.amountPaid) : null,
        }),
      });

      setPaymentDraft((current) => ({ ...current, paymentStatus: statusToSave }));
      setPaymentMessage("Control de pago actualizado.");
      onUpdated();
    } catch (error: any) {
      setPaymentMessage(error.message || "No se pudo actualizar el pago.");
    } finally {
      setIsSavingPayment(false);
    }
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
                      {item.order_item_options?.length ? (
                        <div className="mt-2 space-y-1 rounded-2xl bg-[#F8F3E8] p-3">
                          {groupOrderItemOptions(item).map((group) => (
                            <p
                              key={group.groupName}
                              className="text-xs font-black text-[#746f69]"
                            >
                              {group.groupName}:{" "}
                              {group.options
                                .map((option) =>
                                  option.price > 0
                                    ? `${option.name} (+${formatUsd(option.price)})`
                                    : option.name
                                )
                                .join(", ")}
                            </p>
                          ))}
                        </div>
                      ) : null}
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
                <p>Modalidad: {getDeliverySummary(order)}</p>
              </div>
            </section>

            {currentTransportOrder ? (
              <section className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black">Estado con empresa delivery</h3>
                    <p className="mt-1 text-sm font-bold text-[#746f69]">
                      {currentTransportOrder.agency_name_snapshot || order.transport_agency_name || "Empresa delivery"}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black text-[#2E3A79]">
                    {transportStatusLabels[currentTransportOrder.status] || currentTransportOrder.status}
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm font-bold text-[#746f69]">
                  <p>Tarifa: {formatUsd(Number(currentTransportOrder.delivery_fee_usd || order.delivery_usd || 0))}</p>
                  {currentTransportOrder.updated_at ? (
                    <p>Ultima actualizacion: {formatDate(currentTransportOrder.updated_at)}</p>
                  ) : null}
                  {currentTransportOrder.agency_status_note || currentTransportOrder.rejection_reason ? (
                    <p className="rounded-2xl bg-[#F8F3E8] p-3">
                      {currentTransportOrder.agency_status_note || currentTransportOrder.rejection_reason}
                    </p>
                  ) : null}
                </div>
                {currentTransportOrder.transport_order_events?.length ? (
                  <div className="mt-4 border-t border-[#25262B]/10 pt-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                      Historial
                    </p>
                    <div className="mt-2 space-y-1">
                      {currentTransportOrder.transport_order_events.slice(0, 5).map((event) => (
                        <p key={event.id} className="text-xs font-bold text-[#746f69]">
                          {transportStatusLabels[event.status_to || ""] || event.status_to || event.event_type} · {event.actor_name || event.actor_type}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {agencyWhatsappUrl ? (
                  <a
                    href={agencyWhatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-100 px-4 py-3 text-sm font-black text-green-700"
                  >
                    <Send size={16} />
                    Contactar empresa
                  </a>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06]">
              <h3 className="text-xl font-black">Totales</h3>
              <div className="mt-4 space-y-2 text-sm font-bold">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatUsd(Number(order.subtotal_usd || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery</span>
                  <span>{formatUsd(Number(order.delivery_usd || 0))}</span>
                </div>
                {order.delivery_notes ? (
                  <p className="rounded-2xl bg-[#F8F3E8] p-3 text-xs font-bold leading-relaxed text-[#746f69]">
                    Regla de tarifa: {order.delivery_notes}
                  </p>
                ) : null}
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black">Control de pago</h3>
                  <p className="mt-1 text-xs font-bold text-[#746f69]">
                    {getPaymentStatusLabel(paymentDraft.paymentStatus)}
                  </p>
                </div>
                <span
                  className={[
                    "rounded-full px-3 py-1 text-xs font-black",
                    paymentStatusStyles[paymentDraft.paymentStatus] ||
                      "bg-[#F8F3E8] text-[#746f69]",
                  ].join(" ")}
                >
                  {getPaymentStatusLabel(paymentDraft.paymentStatus)}
                </span>
              </div>

              <div className="mt-4 grid gap-2">
                <p className="rounded-2xl bg-[#F8F3E8] p-3 text-xs font-bold leading-relaxed text-[#746f69]">
                  El comercio confirma el pago por WhatsApp. Cuando reciba el dinero,
                  marca el pedido como pagado para control interno.
                </p>

                {order.payment_verified_at ? (
                  <p className="text-xs font-bold text-[#746f69]">
                    Marcado pagado: {formatDate(order.payment_verified_at)}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => savePayment("verified")}
                    disabled={isSavingPayment}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-green-100 px-4 py-3 text-sm font-black text-green-700 disabled:opacity-60"
                  >
                    {isSavingPayment ? <Loader2 size={16} className="animate-spin" /> : <CircleDollarSign size={16} />}
                    Marcar como pagado
                  </button>
                )}

                <button
                  type="button"
                  onClick={copyPaymentData}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F8F3E8] px-4 py-3 text-sm font-black text-[#2E3A79]"
                >
                  <Clipboard size={16} />
                  {paymentCopied ? "Datos copiados" : "Copiar datos de pago"}
                </button>

                {requestReferenceUrl && !order.payment_verified_at ? (
                  <a
                    href={requestReferenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-green-700"
                  >
                    <Send size={16} />
                    Pedir referencia por WhatsApp
                  </a>
                ) : null}

                {paymentMessage && (
                  <p className="text-xs font-black text-[#2E3A79]">{paymentMessage}</p>
                )}
              </div>
            </section>

            <section className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06]">
              <h3 className="text-xl font-black">Estado</h3>

              <select
                value={status}
                onChange={(event) => updateStatus(event.target.value)}
                disabled={hasAgencyHandoff || isSaving}
                className="mt-4 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none"
              >
                {getStatusOptionsForOrder(order).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
              </select>

              {hasAgencyHandoff ? (
                <p className="mt-2 rounded-2xl bg-indigo-50 p-3 text-xs font-black text-indigo-700">
                  La empresa delivery ya recibió este pedido. Desde ahora el estado operativo lo actualiza la empresa delivery.
                </p>
              ) : null}

              {isDeliveryAlreadyDelivered(order) ? (
                <p className="mt-2 rounded-2xl bg-green-50 p-3 text-xs font-black text-green-700">
                  Este pedido ya fue entregado por la empresa delivery. No se puede cancelar.
                </p>
              ) : null}

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
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("all");
  const [selectedDate, setSelectedDate] = useState("today");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("all");
  const [selectedDeliveryType, setSelectedDeliveryType] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => shouldShowPanelInitialAccessGate());
  const [isLoading, setIsLoading] = useState(() => hasSavedPanelAuth());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreOrders, setHasMoreOrders] = useState(false);
  const [nextOrdersOffset, setNextOrdersOffset] = useState(0);
  const [savingPaymentId, setSavingPaymentId] = useState<string | null>(null);
  const [sendingDeliveryId, setSendingDeliveryId] = useState<string | null>(null);
  const [savingStatusOrderId, setSavingStatusOrderId] = useState<string | null>(null);
  const [loadingDetailOrderId, setLoadingDetailOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [newOrderToast, setNewOrderToast] = useState<NewOrderToastData | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [realtimeStoreIds, setRealtimeStoreIds] = useState<string[]>([]);
  const requestCacheRef = useRef(new Map<string, { expiresAt: number; data: any }>());
  const inflightRequestsRef = useRef(new Map<string, Promise<any>>());
  const authScopeRef = useRef("");
  const latestRequestIdRef = useRef(0);
  const hasLoadedOrdersRef = useRef(false);

  const { currentFilters, filterSignature } = useOrderFilters({
    status: selectedStatus,
    paymentStatus: selectedPaymentStatus,
    date: selectedDate,
    paymentMethod: selectedPaymentMethod,
    deliveryType: selectedDeliveryType,
    search: debouncedSearch,
  });

  const loadOrders = useCallback(async (
    currentPin: string,
    filters: OrderFilters = currentFilters,
    options: { force?: boolean; append?: boolean; offset?: number; notifyNew?: boolean } = {}
  ) => {
    const requestId = ++latestRequestIdRef.current;
    const append = Boolean(options.append);
    const offset = Math.max(0, Number(options.offset || 0));
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    setError("");

    try {
      const accessToken = await getPanelAccessToken();
      const authScope = accessToken || `legacy:${currentPin}`;
      if (authScopeRef.current !== authScope) {
        authScopeRef.current = authScope;
        requestCacheRef.current.clear();
        inflightRequestsRef.current.clear();
      }

      const queryString = buildOrdersQueryString(filters, {
        compact: true,
        limit: 40,
        offset,
      });
      const cacheKey = queryString;
      const now = Date.now();
      const cached = requestCacheRef.current.get(cacheKey);
      let data: any;

      if (!options.force && cached && cached.expiresAt > now) {
        data = cached.data;
      } else {
        let request = inflightRequestsRef.current.get(cacheKey);
        if (!request) {
          request = apiRequest(
            currentPin,
            `/api/panel/orders${queryString}`,
            options.force ? { cache: "no-store" } : undefined
          );
          inflightRequestsRef.current.set(cacheKey, request);
        }
        try {
          data = await request;
          if (authScopeRef.current === authScope) {
            requestCacheRef.current.set(cacheKey, { data, expiresAt: Date.now() + 10_000 });
          }
        } finally {
          if (inflightRequestsRef.current.get(cacheKey) === request) {
            inflightRequestsRef.current.delete(cacheKey);
          }
        }
      }

      if (requestId !== latestRequestIdRef.current) return;

      const nextOrders = Array.isArray(data.orders) ? data.orders : [];
      setOrders((current) => {
        if (!append) {
          if (options.notifyNew && hasLoadedOrdersRef.current) {
            const currentIds = new Set(current.map((order) => order.id));
            const newOrder = nextOrders.find((order: OrderRow) => order?.id && !currentIds.has(order.id));
            if (newOrder) {
              void playNewOrderSound();
              setNewOrderToast({
                id: `${newOrder.id}-${Date.now()}`,
                title: newOrder.public_code || newOrder.id?.slice(0, 8) || "Pedido recibido",
                subtitle: [
                  newOrder.customer_name || "Cliente",
                  newOrder.customer_phone || "",
                ].filter(Boolean).join(" · "),
              });
            }
          }

          return nextOrders;
        }

        const seen = new Set(current.map((order) => order.id));
        return [...current, ...nextOrders.filter((order: OrderRow) => !seen.has(order.id))];
      });
      if (!append) hasLoadedOrdersRef.current = true;
      setHasMoreOrders(Boolean(data.page?.hasMore));
      setNextOrdersOffset(Number(data.page?.nextOffset || offset + nextOrders.length));
      setRealtimeStoreIds(
        Array.isArray(data.auth?.storeIds)
          ? data.auth.storeIds.filter((storeId: unknown): storeId is string => typeof storeId === "string")
          : []
      );
      setIsUnlocked(true);
      savePanelPin(currentPin);
    } catch (error: any) {
      if (requestId !== latestRequestIdRef.current) return;
      requestCacheRef.current.clear();
      setError(error.message || "No se pudieron cargar los pedidos.");
      setIsUnlocked(false);
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
        setIsCheckingAccess(false);
      }
    }
  }, [currentFilters]);

  const invalidateOrderCache = useCallback(() => {
    requestCacheRef.current.clear();
  }, []);

  const loadMoreOrders = useCallback(() => {
    if (isLoadingMore || isLoading || !hasMoreOrders) return;
    void loadOrders(pin, currentFilters, {
      append: true,
      offset: nextOrdersOffset,
    });
  }, [currentFilters, hasMoreOrders, isLoading, isLoadingMore, loadOrders, nextOrdersOffset, pin]);

  const openOrderDetail = useCallback(async (order: OrderRow) => {
    setLoadingDetailOrderId(order.id);
    setError("");

    try {
      const data = await apiRequest(
        pin,
        `/api/panel/orders?orderId=${encodeURIComponent(order.id)}`
      );
      setSelectedOrder(data.order || order);
    } catch (error: any) {
      setError(error.message || "No se pudo cargar el detalle del pedido.");
      setSelectedOrder(order);
    } finally {
      setLoadingDetailOrderId(null);
    }
  }, [pin]);

  const visibleOrders = orders;

  const paymentMethodOptions = useMemo(() => {
    const values = Array.from(
      new Set(orders.map((order) => order.payment_method).filter(Boolean))
    );

    return [
      { value: "all", label: "Todos los pagos" },
      ...values.map((value) => ({ value, label: value })),
    ];
  }, [orders]);

  const sendOrderToDelivery = useCallback(async (orderId: string) => {
    setSendingDeliveryId(orderId);
    setError("");

    try {
      const result = await apiRequest(pin, `/api/panel/orders/${orderId}/send-delivery`, {
        method: "POST",
      });

      if (result?.whatsappUrl) {
        window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
      }

      invalidateOrderCache();
      await loadOrders(pin, currentFilters, { force: true });
    } catch (error: any) {
      setError(error.message || "No se pudo enviar el pedido a delivery.");
    } finally {
      setSendingDeliveryId(null);
    }
  }, [currentFilters, invalidateOrderCache, loadOrders, pin]);

  const changeOrderStatus = useCallback(async (order: OrderRow, nextStatus: string) => {
    setSavingStatusOrderId(order.id);
    setError("");

    try {
      await apiRequest(pin, "/api/panel/orders", {
        method: "PATCH",
        body: JSON.stringify({
          id: order.id,
          status: nextStatus,
        }),
      });

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === order.id ? { ...currentOrder, status: nextStatus } : currentOrder
        )
      );
      setSelectedOrder((currentOrder) =>
        currentOrder?.id === order.id ? { ...currentOrder, status: nextStatus } : currentOrder
      );
      invalidateOrderCache();
    } catch (error: any) {
      setError(error.message || "No se pudo actualizar el estado.");
    } finally {
      setSavingStatusOrderId(null);
    }
  }, [invalidateOrderCache, pin]);

  const markPaymentVerified = useCallback(async (order: OrderRow) => {
    setSavingPaymentId(order.id);
    setError("");

    try {
      const paymentCurrency =
        order.payment_currency || getSuggestedPaymentCurrency(order.payment_method) || "VES";

      await apiRequest(pin, `/api/panel/orders/${order.id}/payment`, {
        method: "PATCH",
        body: JSON.stringify({
          paymentStatus: "verified",
          paymentReference: order.payment_reference || "",
          paymentCurrency,
          amountPaid: order.amount_paid ?? null,
          paymentBank: order.payment_bank || "",
          paymentNotes:
            order.payment_notes || "Pago marcado como verificado desde el panel de pedidos.",
        }),
      });

      const verifiedAt = new Date().toISOString();
      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === order.id
            ? {
                ...currentOrder,
                payment_status: "verified",
                payment_currency: paymentCurrency,
                payment_verified_at: verifiedAt,
              }
            : currentOrder
        )
      );
      setSelectedOrder((currentOrder) =>
        currentOrder?.id === order.id
          ? {
              ...currentOrder,
              payment_status: "verified",
              payment_currency: paymentCurrency,
              payment_verified_at: verifiedAt,
            }
          : currentOrder
      );
      invalidateOrderCache();
    } catch (error: any) {
      setError(error.message || "No se pudo marcar el pago como verificado.");
    } finally {
      setSavingPaymentId(null);
    }
  }, [invalidateOrderCache, pin]);

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

  useEffect(() => {
    const unlock = () => void unlockOrderNotificationSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!isUnlocked) return;
    invalidateOrderCache();
    void loadOrders(pin, currentFilters, { force: true });
  }, [isUnlocked, pin, filterSignature, currentFilters, loadOrders, invalidateOrderCache]);

  useEffect(() => {
    if (!isUnlocked) return;

    const refresh = () => {
      if (document.visibilityState === "visible") void loadOrders(pin, currentFilters, { force: true, notifyNew: true });
    };
    document.addEventListener("visibilitychange", refresh);

    return () => {
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [isUnlocked, pin, loadOrders, filterSignature, currentFilters]);

  useEffect(() => {
    if (!isUnlocked) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      invalidateOrderCache();
      void loadOrders(pin, currentFilters, { force: true, notifyNew: true });
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [isUnlocked, pin, currentFilters, loadOrders, invalidateOrderCache]);

  useEffect(() => {
    if (!newOrderToast) return;
    const timer = window.setTimeout(() => setNewOrderToast(null), 8000);
    return () => window.clearTimeout(timer);
  }, [newOrderToast]);

  useEffect(() => {
    if (!isUnlocked || !realtimeStoreIds.length) return;

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;
    let refreshTimer: number | null = null;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    const refreshOrders = () => {
      if (!active || document.visibilityState !== "visible") return;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        invalidateOrderCache();
        void loadOrders(pin, currentFilters, { force: true, notifyNew: true });
      }, 120);
    };

    void (async () => {
      const accessToken = await getPanelAccessToken();
      if (!active || !accessToken) return;

      await supabase.realtime.setAuth(accessToken);

      for (const storeId of realtimeStoreIds) {
        const channel = supabase
          .channel(`store:${storeId}:orders`, { config: { private: true } })
          .on("broadcast", { event: "order_changed" }, refreshOrders)
          .on("broadcast", { event: "transport_order_changed" }, refreshOrders)
          .subscribe();
        channels.push(channel);
      }
    })();

    return () => {
      active = false;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      for (const channel of channels) void supabase.removeChannel(channel);
    };
    // The API remains the source of truth; Broadcast only invalidates the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, pin, realtimeStoreIds.join(","), loadOrders, filterSignature, currentFilters, invalidateOrderCache]);

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
      <NewOrderToast notification={newOrderToast} onClose={() => setNewOrderToast(null)} />
      <section className="rounded-2xl bg-white p-4 shadow-lg shadow-[#2E3A79]/[0.05] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <h2 className="text-xl font-black">Pedidos operativos</h2>
            <p className="text-sm font-bold text-[#746f69]">
              {selectedDate === "today" ? "Hoy" : "Filtro activo"} · {visibleOrders.length} visibles
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/panel/pedidos/nuevo"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
            >
              <Plus size={16} />
              Pedido manual
            </Link>
            <button
              type="button"
              onClick={() => {
                invalidateOrderCache();
                void loadOrders(pin, currentFilters, { force: true });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white"
            >
              <RefreshCcw size={16} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((current) => !current)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F8F3E8] px-5 py-3 text-sm font-black text-[#2E3A79]"
            >
              <SlidersHorizontal size={16} />
              Filtros
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_170px]">
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
            value={selectedDate}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedDate(value);
            }}
            className="rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
          >
            {dateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {showAdvancedFilters && (
        <div className="mt-3 grid gap-3 xl:grid-cols-4">
          <select
            value={selectedStatus}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedStatus(value);
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
            value={selectedPaymentStatus}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedPaymentStatus(value);
            }}
            className="rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
          >
            {paymentStatusOptions.map((option) => (
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
            }}
            className="rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
          >
            <option value="all">Todas las modalidades</option>
            <option value="delivery">Solo Delivery</option>
            <option value="pickup">Solo Retiro (pick up)</option>
            <option value="table">Solo Mesa</option>
            <option value="bar">Solo Barra</option>
            <option value="national_shipping">Solo Envio nacional</option>
          </select>
        </div>
        )}
      </section>

      <section className="grid gap-2">
        {isLoading && (
          <div className="rounded-[32px] bg-white p-5 text-sm font-black text-[#746f69]">
            Cargando pedidos...
          </div>
        )}

        {!isLoading && visibleOrders.length === 0 && (
          <div className="rounded-[32px] bg-white p-6 text-sm font-bold text-[#746f69] shadow-xl shadow-[#2E3A79]/[0.07]">
            Todavía no hay pedidos en este período.
          </div>
        )}

        {visibleOrders.map((order) => {
          const whatsappUrl = getWhatsappUrl(order.customer_phone);
          const entrega2Integration = getEntrega2Integration(order);
          const transportAgencyIntegration = getTransportAgencyIntegration(order);
          const currentTransportOrder = getCurrentTransportOrder(order);
          const entrega2Status = entrega2Integration?.status || "";
          const transportAgencyStatus =
            currentTransportOrder?.status ||
            transportAgencyIntegration?.status ||
            "";
          const hasAgencyHandoff = hasActiveTransportAgencyHandoff(order);
          const showEntrega2Button = canSendToEntrega2(order);
          const showTransportAgencyButton = canSendToTransportAgency(order);
          const showTransportAgencySent = Boolean(
            order.delivery_type === "delivery" &&
              order.delivery_provider === "transport_agency" &&
              (currentTransportOrder || transportAgencyIntegration) &&
              !showTransportAgencyButton
          );
          const shouldShowTransportAgencyStatus = Boolean(
            (currentTransportOrder || transportAgencyIntegration) &&
              transportAgencyStatus &&
              !["pending", "pending_agency"].includes(transportAgencyStatus)
          );
          const isSendingDelivery = sendingDeliveryId === order.id;
          const isSavingPayment = savingPaymentId === order.id;
          const isSavingStatus = savingStatusOrderId === order.id;
          const isLoadingDetail = loadingDetailOrderId === order.id;
          const isNewOrder = order.status === "received";
          const paymentStatus = getOrderPaymentStatus(order);

          return (
            <article
              key={order.id}
              className={[
                "rounded-xl bg-white px-3 py-2 shadow-sm ring-1",
                isNewOrder
                  ? "ring-2 ring-[#FFB547]"
                  : "ring-[#25262B]/[0.06]",
              ].join(" ")}
            >
              <div className="grid gap-2 lg:grid-cols-[92px_1fr_86px_150px_180px_auto] lg:items-center">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black">{order.public_code}</h3>
                  {isNewOrder ? (
                    <p className="text-[10px] font-black text-[#2E3A79]">
                      Nuevo
                    </p>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{order.customer_name}</p>
                  <p className="truncate text-[11px] font-bold text-[#746f69]">
                    {formatDate(order.created_at)} · {formatOrderAge(order.created_at, now)} · {getDeliverySummary(order)}
                  </p>
                  {order.delivery_notes ? (
                    <p className="truncate text-[11px] font-bold text-[#2E3A79]">
                      Tarifa: {order.delivery_notes}
                    </p>
                  ) : null}
                </div>

                <p className="text-sm font-black">{formatUsd(Number(order.total_usd || 0))}</p>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-[11px] font-black",
                      paymentStatusStyles[paymentStatus] || "bg-[#F8F3E8] text-[#746f69]",
                    ].join(" ")}
                  >
                    {getPaymentStatusLabel(paymentStatus)}
                  </span>
                  {paymentStatus !== "verified" ? (
                    <button
                      type="button"
                      onClick={() => markPaymentVerified(order)}
                      disabled={isSavingPayment}
                      className="inline-flex h-7 items-center justify-center gap-1 rounded-full bg-green-100 px-2.5 text-[10px] font-black text-green-700 disabled:opacity-60"
                    >
                      {isSavingPayment ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <CircleDollarSign size={13} />
                      )}
                      Pagado
                    </button>
                  ) : null}
                </div>

                <div className="rounded-2xl bg-[#F8F3E8] p-2">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#746f69]">
                    Estado
                  </p>
                  {hasAgencyHandoff ? (
                    <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-black text-indigo-700">
                      {transportStatusLabels[transportAgencyStatus] || "Empresa delivery"}
                    </div>
                  ) : (
                    <select
                      value={order.status}
                      onChange={(event) => changeOrderStatus(order, event.target.value)}
                      disabled={isSavingStatus}
                      className="w-full rounded-xl border border-[#25262B]/10 bg-white px-3 py-2 text-[11px] font-black outline-none focus:border-[#2E3A79] disabled:opacity-60"
                      aria-label={`Cambiar estado de ${order.public_code}`}
                    >
                      {getStatusOptionsForOrder(order).map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">

                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-green-100 px-2.5 text-[11px] font-black text-green-700"
                      aria-label="Abrir WhatsApp"
                    >
                      <Send size={14} />
                      WA
                    </a>
                  )}

                  {order.delivery_type === "delivery" && (
                    <>
                      {entrega2Integration && (
                        <span
                          title={entrega2Integration.last_error || undefined}
                          className={[
                            "inline-flex h-8 items-center rounded-full px-2.5 text-[11px] font-black",
                            entrega2StatusStyles[entrega2Status] ||
                              "bg-[#F8F3E8] text-[#746f69]",
                          ].join(" ")}
                        >
                          Entrega2 App:{" "}
                          {entrega2StatusLabels[entrega2Status] ||
                            entrega2Status ||
                            "Registrado"}
                        </span>
                      )}

                      {showEntrega2Button && (
                        <button
                          type="button"
                          onClick={() => sendOrderToDelivery(order.id)}
                          disabled={isSendingDelivery}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-[#2E3A79] px-2.5 text-[11px] font-black text-white disabled:opacity-60"
                        >
                          {isSendingDelivery ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Truck size={16} />
                          )}
                          {entrega2Integration ? "Reintentar Entrega2 App" : "Enviar a Entrega2 App"}
                        </button>
                      )}

                      {shouldShowTransportAgencyStatus ? (
                        <span
                          title={currentTransportOrder?.agency_status_note || transportAgencyIntegration?.last_error || undefined}
                          className={[
                            "inline-flex h-8 items-center rounded-full px-2.5 text-[11px] font-black",
                            transportAgencyStatus === "sent" ||
                            transportAgencyStatus === "sent_to_agency" ||
                            transportAgencyStatus === "agency_received"
                              ? "bg-indigo-100 text-indigo-700"
                              : transportAgencyStatus === "agency_accepted" ||
                                  transportAgencyStatus === "picked_up" ||
                                  transportAgencyStatus === "on_the_way"
                                ? "bg-purple-100 text-purple-700"
                              : transportAgencyStatus === "delivered"
                                ? "bg-green-100 text-green-700"
                              : transportAgencyStatus === "error" ||
                                  transportAgencyStatus === "failed" ||
                                  transportAgencyStatus === "agency_rejected" ||
                                  transportAgencyStatus === "cancelled"
                                ? "bg-red-100 text-red-700"
                                : "bg-[#F8F3E8] text-[#746f69]",
                          ].join(" ")}
                        >
                          Empresa delivery:{" "}
                          {transportStatusLabels[transportAgencyStatus] ||
                            (transportAgencyStatus === "sent" ? "Enviado" : transportAgencyStatus) ||
                            "Pendiente"}
                        </span>
                      ) : null}

                      {showTransportAgencySent ? (
                        <button
                          type="button"
                          disabled
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-green-100 px-2.5 text-[11px] font-black text-green-700 ring-1 ring-green-200"
                          title="Pedido ya solicitado a la empresa delivery"
                        >
                          <Truck size={16} />
                          Delivery
                        </button>
                      ) : null}

                      {showTransportAgencyButton && (
                        <button
                          type="button"
                          onClick={() => sendOrderToDelivery(order.id)}
                          disabled={isSendingDelivery}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-[#2E3A79] px-2.5 text-[11px] font-black text-white disabled:opacity-60"
                        >
                          {isSendingDelivery ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Truck size={16} />
                          )}
                          Delivery
                        </button>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => void openOrderDetail(order)}
                    disabled={isLoadingDetail}
                    className="rounded-full bg-[#FFB547] px-3 py-1.5 text-[11px] font-black text-[#25262B]"
                  >
                    {isLoadingDetail ? "..." : "Ver"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {hasMoreOrders ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMoreOrders}
            disabled={isLoadingMore || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25262B] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#25262B]/10 disabled:opacity-60"
          >
            {isLoadingMore ? <Loader2 size={17} className="animate-spin" /> : null}
            {isLoadingMore ? "Cargando más pedidos..." : "Cargar más pedidos"}
          </button>
        </div>
      ) : null}

      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          pin={pin}
          onClose={() => setSelectedOrder(null)}
          onUpdated={() => {
            invalidateOrderCache();
            void loadOrders(pin, currentFilters, { force: true });
          }}
        />
      )}
    </div>
  );
}


