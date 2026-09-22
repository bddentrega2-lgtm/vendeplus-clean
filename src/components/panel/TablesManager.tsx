"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import {
  Check,
  Eye,
  BellRing,
  ClipboardList,
  Clock3,
  ChevronDown,
  Download,
  Edit3,
  Loader2,
  Plus,
  QrCode,
  Save,
  Settings2,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePanelAuth } from "@/components/panel/PanelAuthProvider";
import { getPanelAuthHeaders } from "@/lib/panel/client-auth";
import { formatUsd } from "@/lib/currency";
import { TABLE_ASSISTANCE_LABELS, TABLE_ORDERS_CHANGED_EVENT } from "@/lib/table-orders";
import { useTableCancellation } from "@/components/panel/orders/use-table-cancellation";
import { PaymentReviewDialog } from "@/components/panel/orders/PaymentReviewDialog";
import { formatOrderAge, getPaymentStatusLabel, type OrderRow } from "@/components/panel/orders/orders-manager-helpers";
import { applyConfirmedTableOrder, fetchTableSnapshot, getCachedTableSnapshot, requestTableJson, type TableSnapshot, type TableRow, type WaiterCall, type ActiveTableOrder as ActiveOrder } from "@/lib/panel/table-snapshot-client";

const OrderDetail = dynamic(() => import("@/components/panel/OrdersManager").then((module) => module.OrderDetail), { ssr: false });

const statusLabels: Record<string, string> = {
  received: "Enviado",
  accepted: "Aprobado",
  preparing: "En preparación",
  ready: "Listo para entregar",
  delivering: "En entrega",
};

const nextStatusAction: Record<string, { status: string; label: string }> = {
  received: { status: "accepted", label: "Aprobar pedido" },
  accepted: { status: "preparing", label: "Iniciar preparación" },
  preparing: { status: "ready", label: "Marcar listo" },
  ready: { status: "completed", label: "Marcar entregado" },
  delivering: { status: "completed", label: "Marcar entregado" },
};

export function TablesManager() {
  const { selectedStoreId, selectedStore } = usePanelAuth();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [waiterCallsEnabled, setWaiterCallsEnabled] = useState(false);
  const [waiterCallLabel, setWaiterCallLabel] = useState(TABLE_ASSISTANCE_LABELS[0]);
  const [customAssistanceLabel, setCustomAssistanceLabel] = useState(false);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const selectedOrderRef = useRef(selectedOrder);
  selectedOrderRef.current = selectedOrder;
  const [openingOrderId, setOpeningOrderId] = useState("");
  const [paymentOrderId, setPaymentOrderId] = useState("");
  const [now, setNow] = useState(Date.now);
  const { requestCancellation, cancellationDialog } = useTableCancellation();
  const currentStoreRef = useRef(selectedStoreId);
  currentStoreRef.current = selectedStoreId;
  const loadSequence = useRef(0);
  const detailSequence = useRef(0);
  const [enabled, setEnabled] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [fulfillmentMode, setFulfillmentMode] = useState<"table_service" | "counter_pickup">("table_service");
  const [qrToken, setQrToken] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [name, setName] = useState("");
  const [zone, setZone] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [editingZone, setEditingZone] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingOrderIds, setPendingOrderIds] = useState<Set<string>>(new Set());
  const pendingOrdersRef = useRef(new Set<string>());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const setupVisibilityInitialized = useRef(false);

  const hasPremiumAccess = selectedStore?.table_orders_access_enabled === true;
  const qrUrl = useMemo(() => {
    if (!qrToken || !selectedStore?.slug || typeof window === "undefined") return "";
    return `${window.location.origin}/${selectedStore.slug}/mesa/${qrToken}`;
  }, [qrToken, selectedStore?.slug]);

  const load = useCallback(async (background = false) => {
    const sequence = ++loadSequence.current;
    if (!selectedStoreId || !hasPremiumAccess) {
      setIsLoading(false);
      return;
    }

    const cached = !background ? getCachedTableSnapshot(selectedStoreId) : null;
    if (!background) setIsLoading(!cached);
    const applySnapshot = (data: TableSnapshot) => {
      setTables(data.tables || []);
      setActiveOrders(data.activeOrders || []);
      setWaiterCalls(data.waiterCalls || []);
      if (!background) {
      setEnabled(Boolean(data.enabled));
      setQrToken(data.qrToken || "");
      setPaymentMethods(data.paymentMethods || []);
      setSelectedPaymentMethods(data.selectedPaymentMethods || []);
      setFulfillmentMode(data.fulfillmentMode === "counter_pickup" ? "counter_pickup" : "table_service");
      setWaiterCallsEnabled(data.waiterCallsEnabled === true);
      const assistanceLabel = data.waiterCallLabel || TABLE_ASSISTANCE_LABELS[0];
      setWaiterCallLabel(assistanceLabel);
      setCustomAssistanceLabel(!TABLE_ASSISTANCE_LABELS.includes(assistanceLabel));
      }
      if (!setupVisibilityInitialized.current) {
        setIsSetupOpen(!data.enabled);
        setupVisibilityInitialized.current = true;
      }
    };
    if (cached) applySnapshot(cached);
    try {
      const data = await fetchTableSnapshot(selectedStoreId, background);
      if (currentStoreRef.current !== selectedStoreId || sequence !== loadSequence.current) return;
      applySnapshot(data);
    } catch (loadError) {
      if (currentStoreRef.current === selectedStoreId) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las mesas.");
    } finally {
      if (!background && currentStoreRef.current === selectedStoreId) setIsLoading(false);
    }
  }, [hasPremiumAccess, selectedStoreId]);

  useEffect(() => {
    setupVisibilityInitialized.current = false;
    setSelectedOrder(null);
    setPaymentOrderId("");
    setActiveOrders([]);
    setWaiterCalls([]);
    pendingOrdersRef.current = new Set();
    setPendingOrderIds(new Set());
  }, [selectedStoreId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refreshActiveOrders = (event: Event) => {
      const detail = (event as CustomEvent<{ storeId?: string; activeOrders?: ActiveOrder[]; waiterCalls?: WaiterCall[]; tables?: TableRow[] }>).detail;
      if (detail?.storeId !== selectedStoreId) return;
      if (detail.activeOrders) {
        setActiveOrders(detail.activeOrders);
        setWaiterCalls(detail.waiterCalls || []);
        if (detail.tables) setTables(detail.tables);
      } else void load(true);
    };
    window.addEventListener(TABLE_ORDERS_CHANGED_EVENT, refreshActiveOrders);
    return () => window.removeEventListener(TABLE_ORDERS_CHANGED_EVENT, refreshActiveOrders);
  }, [load, selectedStoreId]);

  useEffect(() => {
    if (!qrUrl || !isSetupOpen) return;
    let active = true;
    void import("qrcode").then((QRCode) => QRCode.toDataURL(qrUrl, {
      width: 960,
      margin: 3,
      color: { dark: "#042332", light: "#FFFFFF" },
    })).then((value) => {
      if (active) setQrDataUrl(value);
    });
    return () => {
      active = false;
    };
  }, [qrUrl, isSetupOpen]);

  async function request(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
    const response = await fetch("/api/panel/tables", {
      method,
      headers: { ...(await getPanelAuthHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: selectedStoreId, ...body }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo guardar el cambio.");
    return data;
  }

  async function saveSettings() {
    setIsSaving(true);
    setError("");
    try {
      await request("PATCH", {
        action: "settings",
        enabled,
        paymentMethods: selectedPaymentMethods,
        fulfillmentMode,
        waiterCallsEnabled,
        waiterCallLabel,
      });
      setNotice("Configuración guardada.");
      if (enabled) setIsSetupOpen(false);
      window.setTimeout(() => setNotice(""), 2200);
      await load(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function createTable() {
    if (!name.trim()) return;
    setIsSaving(true);
    setError("");
    try {
      await request("POST", { name, zone });
      setName("");
      setZone("");
      await load(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo crear la mesa.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateTable(tableId: string, updates: Record<string, unknown>) {
    setIsSaving(true);
    setError("");
    try {
      await request("PATCH", { tableId, ...updates });
      setEditingId("");
      await load(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar la mesa.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTable(table: TableRow) {
    const confirmed = window.confirm(
      `¿Eliminar ${table.name}? Los pedidos históricos conservarán el nombre de la mesa.`
    );
    if (!confirmed) return;

    setIsSaving(true);
    setError("");
    try {
      await request("DELETE", { tableId: table.id });
      setEditingId("");
      setTables((current) => current.filter((row) => row.id !== table.id));
      setNotice(`${table.name} fue eliminada.`);
      window.setTimeout(() => setNotice(""), 2200);
      await load(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo eliminar la mesa.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateOrderStatus(orderId: string, status: string) {
    const storeId = selectedStoreId;
    const pendingKey = `${storeId}:${orderId}`;
    if (pendingOrdersRef.current.has(pendingKey)) return;
    const order = activeOrders.find((item) => item.id === orderId);
    if (!order) return;
    const cancellation = status === "cancelled" ? await requestCancellation() : undefined;
    if (cancellation === null) return;
    if (currentStoreRef.current !== storeId || pendingOrdersRef.current.has(pendingKey)) return;
    pendingOrdersRef.current.add(pendingKey);
    setPendingOrderIds(new Set(pendingOrdersRef.current));
    setError("");
    try {
      const data = await requestTableJson("/api/panel/orders", {
        method: "PATCH",
        headers: { ...(await getPanelAuthHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status, expectedStatus: order.status, ...cancellation }),
      });
      if (currentStoreRef.current !== storeId) return;
      if (!data.order || data.order.id !== orderId) throw new Error("No se pudo confirmar el estado. Actualiza el pedido.");
      applyConfirmedTableOrder(storeId, data.order);
      setActiveOrders((current) =>
        ["completed", "cancelled"].includes(data.order.status)
          ? current.filter((order) => order.id !== orderId)
          : current.map((order) => order.id === orderId ? { ...order, ...data.order } : order)
      );
    } catch (saveError) {
      if (currentStoreRef.current === storeId) {
        setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar el pedido.");
        void load(true);
      }
    } finally {
      pendingOrdersRef.current.delete(pendingKey);
      if (currentStoreRef.current === storeId) setPendingOrderIds(new Set(pendingOrdersRef.current));
    }
  }

  const openOrder = useCallback(async (orderId: string) => {
    const sequence = ++detailSequence.current;
    const storeId = selectedStoreId;
    setOpeningOrderId(orderId);
    setError("");
    try {
      const data = await requestTableJson(`/api/panel/orders?storeId=${encodeURIComponent(storeId || "")}&orderId=${encodeURIComponent(orderId)}`, {
        headers: await getPanelAuthHeaders(), cache: "no-store",
      });
      if (currentStoreRef.current !== storeId || sequence !== detailSequence.current) return;
      if (!data.order) throw new Error("El pedido ya no está disponible.");
      setSelectedOrder(data.order);
    } catch (error) {
      if (currentStoreRef.current === storeId && sequence === detailSequence.current) setError(error instanceof Error ? error.message : "No se pudo abrir el pedido.");
    } finally { if (sequence === detailSequence.current) setOpeningOrderId(""); }
  }, [selectedStoreId]);

  useEffect(() => {
    const selected = selectedOrderRef.current;
    if (!selected) return;
    const summary = activeOrders.find((order) => order.id === selected.id);
    const changed = summary
      ? summary.status !== selected.status || summary.payment_status !== selected.payment_status
      : !["completed", "cancelled"].includes(selected.status);
    if (changed) void openOrder(selected.id);
  }, [activeOrders, openOrder]);

  async function attendCall(call: WaiterCall) {
    setIsSaving(true);
    try {
      await request("PATCH", { action: "attend", tableId: call.table_id, requestedAt: call.requested_at });
      await load(true);
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo atender la llamada."); }
    finally { setIsSaving(false); }
  }

  async function verifyPayment(orderId: string) {
    const storeId = selectedStoreId;
    const pendingKey = `${storeId}:${orderId}`;
    if (pendingOrdersRef.current.has(pendingKey)) throw new Error("Espera a que termine el cambio de este pedido.");
    pendingOrdersRef.current.add(pendingKey);
    setPendingOrderIds(new Set(pendingOrdersRef.current));
    try {
      const data = await requestTableJson(`/api/panel/orders/${encodeURIComponent(orderId)}/payment`, {
        method: "PATCH",
        headers: { ...(await getPanelAuthHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "verified" }),
      });
      if (currentStoreRef.current !== storeId) return;
      if (data.order?.id !== orderId || data.order.payment_status !== "verified") throw new Error("No se pudo confirmar el pago. Actualiza el pedido.");
      applyConfirmedTableOrder(storeId, data.order);
      setActiveOrders((current) => current.map((order) => order.id === orderId ? { ...order, ...data.order } : order));
    } catch (error) {
      if (currentStoreRef.current === storeId) void load(true);
      throw error;
    } finally {
      pendingOrdersRef.current.delete(pendingKey);
      if (currentStoreRef.current === storeId) setPendingOrderIds(new Set(pendingOrdersRef.current));
    }
  }

  function renderOrder(order: ActiveOrder, counter = false) {
    const pending = pendingOrderIds.has(`${selectedStoreId}:${order.id}`);
    const next = nextStatusAction[order.status];
    return <section key={order.id} className="min-w-0 border-t border-[#25262B]/10 py-3">
      <div className="flex flex-wrap justify-between gap-2 text-xs font-black">
        <span>{order.public_code}</span>
        <span className="flex items-center gap-1 text-[#746f69]" title={new Date(order.created_at).toLocaleString("es-VE")}>
          <Clock3 size={14} /> {formatOrderAge(order.created_at, now)}
        </span>
      </div>
      <p className="mt-1 break-words text-sm font-black">{order.customer_name || "Cliente sin nombre"}</p>
      <p className="text-xs font-bold">{order.payment_method || "Pago por confirmar"} · {formatUsd(Number(order.total_usd || 0))}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-xs font-bold">{statusLabels[order.status] || order.status} · {getPaymentStatusLabel(order.payment_status)}</p>
        <button type="button" onClick={() => setPaymentOrderId(order.id)} title="Revisar pago" aria-label={`Revisar pago de ${order.public_code}`}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#25262B]/15 bg-white text-[#2E3A79] hover:bg-[#F8F3E8]">
          <Eye size={18} />
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        <button type="button" className="vp-button-soft w-full" onClick={() => void openOrder(order.id)} disabled={Boolean(openingOrderId)}>
          {openingOrderId === order.id ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16} />} Comanda y pago
        </button>
        {next ? <button type="button" className="vp-button-primary w-full disabled:cursor-not-allowed disabled:opacity-50" disabled={pending}
          onClick={() => void updateOrderStatus(order.id, next.status)}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {pending ? "Guardando..." : counter && order.status === "ready" ? "Marcar retirado" : next.label}
        </button> : null}
        <button type="button" className="vp-button-soft w-full text-red-700" disabled={pending} onClick={() => void updateOrderStatus(order.id, "cancelled")}>
          <X size={16} /> Cancelar pedido
        </button>
      </div>
    </section>;
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${selectedStore?.slug || "somos"}-pedidos-en-mesa-qr.png`;
    link.click();
  }

  if (!hasPremiumAccess) {
    return (
      <section className="rounded-[28px] bg-white p-6 text-center shadow-lg ring-1 ring-[#25262B]/10">
        <UtensilsCrossed className="mx-auto text-[#2E3A79]" size={38} />
        <h2 className="mt-3 text-xl font-black">Pedidos en Mesa / Barra</h2>
        <p className="mt-2 text-sm font-bold text-[#746f69]">
          Esta función premium no está habilitada para este comercio.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return <p className="flex items-center gap-2 text-sm font-black text-[#746f69]"><Loader2 className="animate-spin" size={18} /> Cargando mesas...</p>;
  }

  const activeOrdersByTable = new Map<string, ActiveOrder[]>();
  for (const order of activeOrders) {
    if (!order.store_table_id) continue;
    const current = activeOrdersByTable.get(order.store_table_id) || [];
    activeOrdersByTable.set(order.store_table_id, [...current, order]);
  }
  const counterOrders = activeOrders.filter(
    (order) => order.table_fulfillment_snapshot === "counter_pickup" || !order.store_table_id
  );
  const paymentOrder = activeOrders.find((order) => order.id === paymentOrderId);

  return (
    <div className="space-y-6">
      {cancellationDialog}
      {paymentOrder ? <PaymentReviewDialog key={paymentOrder.id} order={paymentOrder} pin="" onClose={() => setPaymentOrderId("")}
        onVerify={() => verifyPayment(paymentOrder.id)} /> : null}
      {selectedOrder ? <OrderDetail key={selectedOrder.id} order={selectedOrder} pin="" onClose={() => { detailSequence.current++; setOpeningOrderId(""); setSelectedOrder(null); }}
        onUpdated={() => { void openOrder(selectedOrder.id); void load(true); }} /> : null}
      {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-black text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-2xl bg-green-50 p-3 text-sm font-black text-green-700">{notice}</p> : null}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-white p-4 shadow-lg ring-1 ring-[#25262B]/10">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F8F3E8] text-[#2E3A79]">
            <Settings2 size={19} />
          </span>
          <div className="min-w-0">
            <p className="font-black">Configuración de Mesa / Barra</p>
            <p className="truncate text-xs font-bold text-[#746f69]">
              {enabled ? "Activa" : "Inactiva"} · {fulfillmentMode === "counter_pickup" ? "Retiro en barra" : "Servicio en mesa"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsSetupOpen((current) => !current)}
          className="vp-button-soft"
          aria-expanded={isSetupOpen}
        >
          {isSetupOpen ? "Ocultar" : "Editar configuración"}
          <ChevronDown size={17} className={isSetupOpen ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
      </section>

      {isSetupOpen ? <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-[28px] bg-white p-5 shadow-lg ring-1 ring-[#25262B]/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">Configuración</h2>
              <p className="mt-1 text-sm font-bold text-[#746f69]">
                {fulfillmentMode === "counter_pickup"
                  ? "Un QR para pedir y retirar en la barra."
                  : "Un solo QR para todas las mesas."}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-black">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-5 w-5 accent-[#2E3A79]" />
              Activo
            </label>
          </div>
          <h3 className="mt-5 text-sm font-black">¿Cómo recibe el cliente?</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className={`rounded-2xl p-4 text-sm font-bold ring-1 ${fulfillmentMode === "counter_pickup" ? "bg-[#FFF0C9] ring-[#FFB547]" : "bg-[#F8F3E8] ring-transparent"}`}>
              <input
                type="radio"
                name="table-fulfillment-mode"
                value="counter_pickup"
                checked={fulfillmentMode === "counter_pickup"}
                onChange={() => setFulfillmentMode("counter_pickup")}
                className="mr-2 accent-[#2E3A79]"
              />
              Retiro en barra
              <span className="mt-1 block text-xs text-[#746f69]">El cliente retira cuando el pedido esté listo.</span>
            </label>
            <label className={`rounded-2xl p-4 text-sm font-bold ring-1 ${fulfillmentMode === "table_service" ? "bg-[#FFF0C9] ring-[#FFB547]" : "bg-[#F8F3E8] ring-transparent"}`}>
              <input
                type="radio"
                name="table-fulfillment-mode"
                value="table_service"
                checked={fulfillmentMode === "table_service"}
                onChange={() => setFulfillmentMode("table_service")}
                className="mr-2 accent-[#2E3A79]"
              />
              Servir en la mesa
              <span className="mt-1 block text-xs text-[#746f69]">El comercio lleva el pedido a la mesa elegida.</span>
            </label>
          </div>
          {fulfillmentMode === "table_service" ? <label className="mt-4 flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={waiterCallsEnabled} onChange={(event) => setWaiterCallsEnabled(event.target.checked)} className="h-5 w-5" />
            Permitir pedir asistencia
          </label> : null}
          {fulfillmentMode === "table_service" && waiterCallsEnabled ? <div className="mt-3 space-y-3">
            <label className="block text-sm font-bold">Texto del botón
              <select className="vp-input mt-2 w-full" value={customAssistanceLabel ? "custom" : waiterCallLabel}
                onChange={(event) => {
                  setCustomAssistanceLabel(event.target.value === "custom");
                  if (event.target.value !== "custom") setWaiterCallLabel(event.target.value);
                }}>
                {TABLE_ASSISTANCE_LABELS.map((label) => <option key={label}>{label}</option>)}
                <option value="custom">Personalizado</option>
              </select>
            </label>
            {customAssistanceLabel ? <label className="block text-sm font-bold">Texto personalizado
              <input className="vp-input mt-2 w-full" value={waiterCallLabel} maxLength={40} minLength={3}
                onChange={(event) => setWaiterCallLabel(event.target.value)} />
            </label> : null}
          </div> : null}
          <h3 className="mt-5 text-sm font-black">Pagos previos disponibles</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {paymentMethods.map((method) => (
              <label key={method} className="flex items-center gap-3 rounded-2xl bg-[#F8F3E8] p-3 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={selectedPaymentMethods.includes(method)}
                  onChange={(event) => setSelectedPaymentMethods((current) => event.target.checked ? [...current, method] : current.filter((item) => item !== method))}
                  className="h-4 w-4 accent-[#2E3A79]"
                />
                {method}
              </label>
            ))}
          </div>
          <button type="button" onClick={saveSettings} disabled={isSaving} className="vp-button-primary mt-5">
            <Save size={17} /> Guardar configuración
          </button>
        </div>

        <div className="rounded-[28px] bg-white p-5 text-center shadow-lg ring-1 ring-[#25262B]/10">
          <h2 className="flex items-center justify-center gap-2 text-lg font-black"><QrCode size={20} /> QR del comercio</h2>
          {qrDataUrl ? <Image src={qrDataUrl} alt={`QR de ${selectedStore?.name || "Mesa / Barra"}`} width={220} height={220} unoptimized className="mx-auto mt-3 h-52 w-52" /> : null}
          <button type="button" onClick={downloadQr} disabled={!qrDataUrl} className="vp-button-mango mt-3 w-full">
            <Download size={17} /> Descargar QR
          </button>
        </div>
      </section> : null}

      {waiterCalls.length ? <section className="border-y border-amber-200 bg-amber-50 p-4">
        <h2 className="flex items-center gap-2 text-lg font-black"><BellRing size={20} /> Solicitudes de asistencia</h2>
        <div className="mt-2 divide-y divide-amber-200">
          {waiterCalls.map((call) => <div key={`${call.table_id}-${call.requested_at}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <p className="text-sm font-bold">{tables.find((table) => table.id === call.table_id)?.name || "Mesa"} · {formatOrderAge(call.requested_at, now)}</p>
            <button type="button" className="vp-button-soft" disabled={isSaving} onClick={() => void attendCall(call)}><Check size={16} /> Atendido</button>
          </div>)}
        </div>
      </section> : null}

      {counterOrders.length ? (
        <section className="rounded-[28px] bg-white p-5 shadow-lg ring-1 ring-[#25262B]/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Retiro en barra</h2>
              <p className="mt-1 text-sm font-bold text-[#746f69]">Pedidos que el cliente retirará cuando estén listos.</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-black text-amber-800">
              {counterOrders.length}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {counterOrders.map((order) => renderOrder(order, true))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tables.map((table) => {
          const tableOrders = activeOrdersByTable.get(table.id) || [];
          const isEditing = editingId === table.id;
          return (
            <article key={table.id} className="min-h-56 rounded-[28px] bg-white p-5 shadow-lg ring-1 ring-[#25262B]/10">
              {isEditing ? (
                <div className="space-y-3">
                  <input className="vp-input" value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={40} />
                  <input className="vp-input" value={editingZone} onChange={(event) => setEditingZone(event.target.value)} placeholder="Zona opcional" maxLength={40} />
                  <div className="flex gap-2">
                    <button type="button" className="vp-button-primary" onClick={() => updateTable(table.id, { name: editingName, zone: editingZone })}><Check size={16} /> Guardar</button>
                    <button type="button" className="vp-button-soft" onClick={() => setEditingId("")} aria-label="Cancelar edición"><X size={16} /></button>
                    <button
                      type="button"
                      className="ml-auto grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-700 disabled:opacity-60"
                      onClick={() => deleteTable(table)}
                      disabled={isSaving}
                      aria-label={`Eliminar ${table.name}`}
                      title={`Eliminar ${table.name}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="text-lg font-black">{table.name}</h3><p className="text-xs font-bold text-[#746f69]">{table.zone || "Sin zona"}</p></div>
                    <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-[#F8F3E8] text-[#2E3A79]" onClick={() => { setEditingId(table.id); setEditingName(table.name); setEditingZone(table.zone || ""); }} aria-label={`Editar ${table.name}`}><Edit3 size={16} /></button>
                  </div>
                  <div className={`mt-4 rounded-2xl p-3 ${!table.is_enabled ? "bg-gray-100 text-gray-600" : tableOrders.length ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-700"}`}>
                    <p className="text-sm font-black">
                      {!table.is_enabled
                        ? "Desactivada"
                        : tableOrders.length
                          ? `${tableOrders.length} ${tableOrders.length === 1 ? "pedido activo" : "pedidos activos"}`
                          : "Sin pedidos activos"}
                    </p>
                  </div>
                  {tableOrders.length ? (
                    <div className="mt-4 grid gap-3">
                      {tableOrders.map((order) => renderOrder(order))}
                    </div>
                  ) : (
                    <button type="button" className="vp-button-soft mt-4 w-full" onClick={() => updateTable(table.id, { isEnabled: !table.is_enabled })} disabled={isSaving}>
                      {table.is_enabled ? "Desactivar mesa" : "Activar mesa"}
                    </button>
                  )}
                </>
              )}
            </article>
          );
        })}
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-lg ring-1 ring-[#25262B]/10">
        <h2 className="text-xl font-black">Nueva mesa</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input className="vp-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Mesa 01" maxLength={40} />
          <input className="vp-input" value={zone} onChange={(event) => setZone(event.target.value)} placeholder="Zona opcional: Terraza" maxLength={40} />
          <button type="button" onClick={createTable} disabled={isSaving || !name.trim()} className="vp-button-mango"><Plus size={17} /> Crear</button>
        </div>
      </section>
    </div>
  );
}
