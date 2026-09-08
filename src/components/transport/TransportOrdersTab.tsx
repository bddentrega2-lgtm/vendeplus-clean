"use client";

import { useState, type ReactNode } from "react";
import { Eye, Loader2, MessageCircle, RefreshCcw, Send, X } from "lucide-react";
import { transportStatusLabels } from "@/components/transport/transport-panel-helpers";

type LoadOrders = (overrides?: Record<string, string>) => Promise<void>;

interface TransportOrdersTabProps {
  billingSymbol: string;
  drivers: any[];
  driverWhatsappDispatchEnabled: boolean;
  hasMore: boolean;
  isLoading: boolean;
  loadingDetailOrderId: string | null;
  loadOrders: LoadOrders;
  canSendParticularToEntrega2: boolean;
  onAssignDriver: (orderId: string, driverId: string) => Promise<void>;
  onLoadOrderDetail: (orderId: string) => Promise<void>;
  onSendParticularToEntrega2: (orderId: string) => Promise<void>;
  onPeriodChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onStoreChange: (value: string) => void;
  onUpdateStatus: (orderId: string, status: string) => Promise<void>;
  orders: any[];
  page: number;
  period: string;
  premiumDispatchEnabled: boolean;
  savingOrderId: string | null;
  sendingEntrega2OrderId: string | null;
  statusFilter: string;
  storeFilter: string;
  stores: any[];
}

const statusActionsByCurrent: Record<string, Array<readonly [string, string]>> = {
  pending_agency: [["agency_accepted", "Aceptar"], ["agency_rejected", "Rechazar"]],
  sent_to_agency: [["agency_accepted", "Aceptar"], ["agency_rejected", "Rechazar"]],
  agency_received: [["agency_accepted", "Aceptar"], ["agency_rejected", "Rechazar"]],
  agency_accepted: [["pickup_pending", "Por retirar"], ["picked_up", "Retirado"], ["delivered", "Entregado"], ["issue_reported", "Reportar novedad"]],
  driver_assigned: [["pickup_pending", "Por retirar"], ["picked_up", "Retirado"], ["delivered", "Entregado"], ["issue_reported", "Reportar novedad"]],
  pickup_pending: [["picked_up", "Retirado"], ["delivered", "Entregado"], ["issue_reported", "Reportar novedad"]],
  picked_up: [["on_the_way", "En camino"], ["delivered", "Entregado"], ["issue_reported", "Reportar novedad"]],
  on_the_way: [["delivered", "Entregado"], ["delivery_failed", "Entrega fallida"], ["issue_reported", "Reportar novedad"]],
  issue_reported: [["agency_accepted", "Retomar"], ["on_the_way", "En camino"], ["cancelled", "Cancelar"]],
};

const closedStatuses = ["delivered", "agency_rejected", "cancelled", "delivery_failed"];

function entrega2StatusLabel(status: unknown) {
  const normalized = String(status || "");
  const labels: Record<string, string> = {
    sending: "Enviando",
    sent: "Enviado",
    accepted: "Aceptado",
    delivering: "En camino",
    completed: "Completado",
    error: "Error",
    failed: "Error",
    reconcile_required: "Revisar antes de reenviar",
  };
  return labels[normalized] || normalized || "Registrado";
}

function formatTime(value: unknown) {
  if (!value) return "--:--";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusPillClass(status: string) {
  if (status === "delivered") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (["on_the_way", "picked_up"].includes(status)) {
    return "bg-indigo-100 text-indigo-800 ring-indigo-200";
  }
  if (["agency_accepted", "driver_assigned"].includes(status)) {
    return "bg-blue-100 text-blue-800 ring-blue-200";
  }
  if (["agency_rejected", "cancelled", "delivery_failed"].includes(status)) {
    return "bg-red-100 text-red-800 ring-red-200";
  }
  if (status === "issue_reported") return "bg-amber-100 text-amber-800 ring-amber-200";
  return "bg-yellow-100 text-yellow-800 ring-yellow-200";
}

export function TransportOrdersTab({
  billingSymbol,
  driverWhatsappDispatchEnabled,
  drivers,
  hasMore,
  isLoading,
  loadingDetailOrderId,
  loadOrders,
  canSendParticularToEntrega2,
  onAssignDriver,
  onLoadOrderDetail,
  onSendParticularToEntrega2,
  onPeriodChange,
  onStatusChange,
  onStoreChange,
  onUpdateStatus,
  orders,
  page,
  period,
  savingOrderId,
  sendingEntrega2OrderId,
  statusFilter,
  storeFilter,
  stores,
  premiumDispatchEnabled,
}: TransportOrdersTabProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const activeDrivers = drivers.filter((driver) => driver.is_active !== false);
  const selectedOrder = selectedOrderId
    ? orders.find((entry) => entry.id === selectedOrderId) || null
    : null;

  function cleanPhone(value: unknown) {
    return String(value || "").replace(/[^0-9]/g, "");
  }

  function particular(entry: any) {
    const request = entry.transport_particular_requests;
    return Array.isArray(request) ? request[0] || null : request || null;
  }

  function particularServiceLabel(entry: any) {
    const request = particular(entry);
    const description = String(request?.package_description || "");
    if (!request) return "Pedido";
    if (/Traslado de persona:/i.test(description)) return "Traslado";
    if (/Delivery:/i.test(description)) return "Delivery";
    return "Particular";
  }

  function originLabel(entry: any) {
    const request = particular(entry);
    if (!request) return entry.store_name_snapshot || entry.stores?.name || "Comercio";
    return "Particular";
  }

  function requestDetailLabel(entry: any) {
    return particularServiceLabel(entry) === "Traslado" ? "Detalle" : "Paquete";
  }

  function orderCode(entry: any) {
    return entry.orders?.public_code || particular(entry)?.public_code || "Pedido";
  }

  function entrega2Integration(entry: any) {
    return (entry.order_integrations || []).find((integration: any) => integration.provider === "entrega2") || null;
  }

  function canShowEntrega2Button(entry: any) {
    return canSendParticularToEntrega2 && Boolean(particular(entry) || entry.order_id);
  }

  function buildMapsUrl(entry: any) {
    const latitude = Number(entry.orders?.delivery_lat ?? particular(entry)?.delivery_lat);
    const longitude = Number(entry.orders?.delivery_lng ?? particular(entry)?.delivery_lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  }

  function isCashPayment(value: unknown) {
    return /efectivo|cash/i.test(String(value || ""));
  }

  function buildDriverCommandUrl(entry: any, driver: any) {
    const driverPhone = cleanPhone(driver?.phone);
    if (!driverPhone) return "";

    const request = particular(entry);
    const serviceLabel = particularServiceLabel(entry);
    const paymentMethod = String(entry.orders?.payment_method || request?.payment_method || "No indicado");
    const cashPayment = isCashPayment(paymentMethod);
    const mapsUrl = buildMapsUrl(entry);
    const total = Number(entry.orders?.total_usd || 0);
    const message = [
      request ? `*Nuevo ${serviceLabel.toLowerCase()} particular*` : "*Nuevo servicio delivery*",
      `Pedido: ${orderCode(entry)}`,
      "",
      `Origen: ${originLabel(entry)}`,
      request
        ? `${serviceLabel === "Traslado" ? "Pasajero" : "Retiro"}: ${request.pickup_name || entry.customer_name_snapshot || "No indicado"}`
        : null,
      request && serviceLabel !== "Traslado"
        ? `Entrega: ${request.delivery_name || "No indicado"}`
        : null,
      request
        ? `Telefono ${serviceLabel === "Traslado" ? "de contacto" : "de retiro"}: ${request.pickup_phone || "No indicado"}`
        : `Telefono comercio: ${entry.store_whatsapp_snapshot || entry.stores?.whatsapp || "No indicado"}`,
      "",
      `${request ? "Solicitante" : "Cliente"}: ${entry.customer_name_snapshot || (request ? "Solicitante" : "Cliente")}`,
      `Telefono ${request ? "solicitante" : "cliente"}: ${entry.customer_phone_snapshot || "No indicado"}`,
      mapsUrl ? `Ubicacion GPS: ${mapsUrl}` : "Ubicacion GPS: no indicada",
      entry.delivery_address || entry.delivery_reference
        ? `Referencia: ${entry.delivery_address || entry.delivery_reference}`
        : null,
      request?.package_description ? `${requestDetailLabel(entry)}: ${request.package_description}` : null,
      "",
      cashPayment
        ? `Pago: efectivo. Cobrar al cliente: $${total.toFixed(2)}`
        : `Pago: ${paymentMethod}. No cobrar efectivo salvo indicacion de la empresa.`,
    ]
      .filter(Boolean)
      .join("\n");

    return `https://wa.me/${driverPhone}?text=${encodeURIComponent(message)}`;
  }

  async function openDetail(entry: any) {
    setSelectedOrderId(entry.id);
    if (!entry.__detailsLoaded) {
      await onLoadOrderDetail(entry.id);
    }
  }

  function renderDriverSelect(entry: any, compact = true) {
    const isSaving = savingOrderId === entry.id;
    if (!premiumDispatchEnabled) {
      return <span className="text-xs font-bold text-[#746f69]">Premium no activo</span>;
    }

    return (
      <select
        value={entry.driver_id || ""}
        disabled={isSaving || closedStatuses.includes(entry.status)}
        onChange={(event) => onAssignDriver(entry.id, event.target.value)}
        className={[
          "w-full rounded-xl border border-[#D8DEEA] bg-white font-bold text-[#2E3A79] outline-none disabled:bg-[#F8F3E8] disabled:text-[#746f69]",
          compact ? "px-2 py-1.5 text-xs" : "px-4 py-3 text-sm",
        ].join(" ")}
        aria-label={`Asignar repartidor a ${orderCode(entry)}`}
      >
        <option value="">-- Sin asignar --</option>
        {activeDrivers.map((driver) => (
          <option key={driver.id} value={driver.id}>
            {driver.name} · {Number(driver.commission_percent || 0).toFixed(0)}%
          </option>
        ))}
      </select>
    );
  }

  return (
    <section className="space-y-3">
      <div className="rounded-[24px] bg-white p-4 shadow-lg shadow-[#25262B]/8">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-black">Pedidos recibidos</h2>
            <p className="mt-1 text-xs font-bold text-[#746f69]">
              Vista operativa compacta: más pedidos visibles, menos ruido.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadOrders()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-4 py-2.5 text-xs font-black text-[#25262B]"
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
            Actualizar
          </button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <select
            value={period}
            onChange={(event) => onPeriodChange(event.target.value)}
            className="rounded-xl border border-[#25262B]/10 px-3 py-2.5 text-xs font-black outline-none focus:border-[#2E3A79]"
            aria-label="Periodo de pedidos"
          >
            <option value="today">Hoy</option>
            <option value="week">Semana</option>
            <option value="all">Todos</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => onStatusChange(event.target.value)}
            className="rounded-xl border border-[#25262B]/10 px-3 py-2.5 text-xs font-black outline-none focus:border-[#2E3A79]"
            aria-label="Estado de pedidos"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="agency_accepted">Aceptados</option>
            <option value="agency_rejected">Rechazados</option>
            <option value="on_the_way">En camino</option>
            <option value="delivered">Entregados</option>
            <option value="issue_reported">Novedades</option>
          </select>
          <select
            value={storeFilter}
            onChange={(event) => onStoreChange(event.target.value)}
            className="rounded-xl border border-[#25262B]/10 px-3 py-2.5 text-xs font-black outline-none focus:border-[#2E3A79]"
            aria-label="Comercio de los pedidos"
          >
            <option value="all">Todos los comercios</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl bg-white p-5 text-center text-sm font-bold text-[#746f69]">
          {isLoading ? "Cargando pedidos..." : "No hay pedidos de empresa delivery con estos filtros."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] bg-white shadow-lg shadow-[#25262B]/8 ring-1 ring-[#D8DEEA]">
          <div className="overflow-x-auto">
            <div className="min-w-[1120px]">
              <div className="grid grid-cols-[115px_210px_210px_100px_150px_235px_100px] items-center border-b border-[#D8DEEA] bg-[#F8FAFC] px-4 py-3 text-xs font-black text-[#52647A]">
                <span>ID / Hora</span>
                <span>Comercio</span>
                <span>Cliente / Solicitante</span>
                <span>Precio</span>
                <span>Estado</span>
                <span>Repartidor</span>
                <span className="text-right">Acciones</span>
              </div>

              {orders.map((entry) => {
                const isSaving = savingOrderId === entry.id;
                const isSendingEntrega2 = sendingEntrega2OrderId === entry.id;
                const isDetailLoading = loadingDetailOrderId === entry.id;
                const assignedDriver = drivers.find((driver) => driver.id === entry.driver_id);
                const entrega2 = entrega2Integration(entry);
                const driverCommandUrl =
                  driverWhatsappDispatchEnabled && assignedDriver
                    ? buildDriverCommandUrl(entry, assignedDriver)
                    : "";
                const statusLabel = transportStatusLabels[entry.status] || entry.status;

                return (
                  <div
                    key={entry.id}
                    className="grid min-h-[68px] grid-cols-[115px_210px_210px_100px_150px_235px_100px] items-center border-b border-[#EEF1F5] px-4 py-2 text-sm last:border-b-0 hover:bg-[#FBFCFE]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black text-[#162033]">
                        {orderCode(entry)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-[#8A98AA]">
                        {formatTime(entry.created_at || entry.orders?.created_at)}
                      </p>
                    </div>
                    <div className="min-w-0 pr-3">
                      <p className="truncate font-black text-[#162033]">
                        {originLabel(entry)}
                      </p>
                      {particular(entry) ? (
                        <span
                          className={[
                            "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                            particularServiceLabel(entry) === "Traslado"
                              ? "bg-violet-100 text-violet-800"
                              : "bg-blue-100 text-blue-800",
                          ].join(" ")}
                        >
                          {particularServiceLabel(entry)}
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 pr-3">
                      <p className="truncate font-black text-[#162033]">
                        {entry.customer_name_snapshot || (particular(entry) ? "Solicitante" : "Cliente")}
                      </p>
                      <p className="truncate text-xs font-bold text-[#8A98AA]">
                        {entry.customer_phone_snapshot || "sin teléfono"}
                      </p>
                    </div>
                    <p className="font-black text-[#162033]">
                      {billingSymbol}
                      {Number(entry.delivery_fee_usd || 0).toFixed(2)}
                    </p>
                    <div>
                      <select
                        value={entry.status}
                        disabled={isSaving || ["delivered", "agency_rejected", "cancelled"].includes(entry.status)}
                        onChange={(event) => onUpdateStatus(entry.id, event.target.value)}
                        className={[
                          "max-w-[112px] rounded-full px-2 py-1 text-[10px] font-black uppercase leading-none outline-none ring-1 disabled:opacity-65",
                          statusPillClass(entry.status),
                        ].join(" ")}
                        aria-label={`Actualizar estado de ${orderCode(entry)}`}
                      >
                        <option value={entry.status}>{isSaving ? "Actualizando..." : statusLabel}</option>
                        {(statusActionsByCurrent[entry.status] || []).map(([status, label]) => (
                            <option key={status} value={status}>
                              {label}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="pr-3">{renderDriverSelect(entry)}</div>
                    <div className="flex items-center justify-end gap-2">
                      {canShowEntrega2Button(entry) ? (
                        <button
                          type="button"
                          onClick={() => void onSendParticularToEntrega2(entry.id)}
                          disabled={isSendingEntrega2 || Boolean(entrega2 && !["error", "failed"].includes(entrega2.status))}
                          title={entrega2 ? `Entrega2 App: ${entrega2StatusLabel(entrega2.status)}` : "Enviar a Entrega2 App"}
                          aria-label={entrega2 ? `Entrega2 App: ${entrega2StatusLabel(entrega2.status)}` : "Enviar a Entrega2 App"}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#2E3A79] text-white hover:bg-[#243061] disabled:bg-[#D8DEEA] disabled:text-[#52647A]"
                        >
                          {isSendingEntrega2 ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                      ) : null}
                      {driverCommandUrl ? (
                        <a
                          href={driverCommandUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Enviar comanda"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-green-100 text-green-700 hover:bg-green-200"
                        >
                          <MessageCircle size={16} />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void openDetail(entry)}
                        disabled={isDetailLoading}
                        title="Ver detalle"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF2F7] text-[#52647A] hover:bg-[#DDE6F1] disabled:opacity-60"
                      >
                        {isDetailLoading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => loadOrders({ page: String(page + 1), append: "true" })}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#2E3A79] shadow-xl shadow-[#25262B]/10 disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            Cargar más pedidos
          </button>
        </div>
      ) : null}

      {selectedOrder ? (
        <OrderDetailModal
          billingSymbol={billingSymbol}
          cleanPhone={cleanPhone}
          entry={selectedOrder}
          isLoading={loadingDetailOrderId === selectedOrder.id && !selectedOrder.__detailsLoaded}
          mapsUrl={buildMapsUrl(selectedOrder)}
          onClose={() => setSelectedOrderId(null)}
          renderDriverSelect={renderDriverSelect}
          orderCode={orderCode}
          originLabel={originLabel}
          particularServiceLabel={particularServiceLabel}
          requestDetailLabel={requestDetailLabel}
          canShowEntrega2Button={canShowEntrega2Button}
          entrega2Integration={entrega2Integration}
          onSendParticularToEntrega2={onSendParticularToEntrega2}
          sendingEntrega2OrderId={sendingEntrega2OrderId}
        />
      ) : null}
    </section>
  );
}

function OrderDetailModal({
  billingSymbol,
  cleanPhone,
  entry,
  isLoading,
  mapsUrl,
  onClose,
  renderDriverSelect,
  orderCode,
  originLabel,
  particularServiceLabel,
  requestDetailLabel,
  canShowEntrega2Button,
  entrega2Integration,
  onSendParticularToEntrega2,
  sendingEntrega2OrderId,
}: {
  billingSymbol: string;
  cleanPhone: (value: unknown) => string;
  entry: any;
  isLoading: boolean;
  mapsUrl: string;
  onClose: () => void;
  renderDriverSelect: (entry: any, compact?: boolean) => ReactNode;
  orderCode: (entry: any) => string;
  originLabel: (entry: any) => string;
  particularServiceLabel: (entry: any) => string;
  requestDetailLabel: (entry: any) => string;
  canShowEntrega2Button: (entry: any) => boolean;
  entrega2Integration: (entry: any) => any;
  onSendParticularToEntrega2: (orderId: string) => Promise<void>;
  sendingEntrega2OrderId: string | null;
}) {
  const rawRequest = entry.transport_particular_requests;
  const request = Array.isArray(rawRequest) ? rawRequest[0] || null : rawRequest || null;
  const commercePhone = cleanPhone(request?.pickup_phone || entry.store_whatsapp_snapshot || entry.stores?.whatsapp);
  const customerPhone = cleanPhone(request?.delivery_phone || entry.customer_phone_snapshot);
  const paymentMethod = String(entry.orders?.payment_method || request?.payment_method || "No indicado");
  const entrega2 = entrega2Integration(entry);
  const isSendingEntrega2 = sendingEntrega2OrderId === entry.id;
  const serviceLabel = particularServiceLabel(entry);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#162033]/50 p-4">
      <section className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#EEF1F5] px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#746f69]">
              Detalle del servicio
            </p>
            <h3 className="mt-1 text-2xl font-black text-[#162033]">
              {orderCode(entry)}
            </h3>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              {originLabel(entry)} ·{" "}
              {entry.customer_name_snapshot || (request ? "Solicitante" : "Cliente")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-[#F8F3E8] text-[#25262B]"
            aria-label="Cerrar detalle"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(88vh-96px)] overflow-y-auto p-5">
          {isLoading ? (
            <div className="grid min-h-[220px] place-items-center text-sm font-black text-[#746f69]">
              <span className="inline-flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" /> Cargando detalle...
              </span>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#F8F3E8] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                    Servicio
                  </p>
                  <div className="mt-3 grid gap-2 text-sm font-bold text-[#746f69]">
                    {request ? (
                      <p>
                        Tipo:{" "}
                        <span
                          className={[
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                            serviceLabel === "Traslado"
                              ? "bg-violet-100 text-violet-800"
                              : "bg-blue-100 text-blue-800",
                          ].join(" ")}
                        >
                          {serviceLabel}
                        </span>
                      </p>
                    ) : null}
                    <p>
                      {request ? "Tarifa" : "Delivery"}:{" "}
                      <span className="font-black text-[#162033]">
                        {billingSymbol}
                        {Number(entry.delivery_fee_usd || 0).toFixed(2)}
                      </span>
                    </p>
                    <p>Pago: {paymentMethod}</p>
                    {request?.payment_reference ? <p>Referencia de pago: {request.payment_reference}</p> : null}
                    <p>
                      Dirección:{" "}
                      {request?.delivery_address || entry.delivery_address || request?.delivery_reference || entry.delivery_reference || "Ver punto GPS"}
                      {entry.delivery_zone_name ? ` · ${entry.delivery_zone_name}` : ""}
                    </p>
                    {request ? (
                      <p>
                        {serviceLabel === "Traslado" ? "Origen" : "Retiro"}:{" "}
                        {request.pickup_address || request.pickup_reference || "Ver punto GPS"}
                      </p>
                    ) : null}
                    {request?.pickup_name ? (
                      <p>{serviceLabel === "Traslado" ? "Pasajero" : "Contacto retiro"}: {request.pickup_name}</p>
                    ) : null}
                    {request?.delivery_name && serviceLabel !== "Traslado" ? (
                      <p>Contacto entrega: {request.delivery_name}</p>
                    ) : null}
                    {request?.distance_km != null ? <p>Distancia: {Number(request.distance_km).toFixed(2)} km</p> : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#EEF1F5] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                    Repartidor
                  </p>
                  <div className="mt-3">{renderDriverSelect(entry, false)}</div>
                  {entry.driver_name_snapshot ? (
                    <p className="mt-2 text-sm font-black text-[#2E3A79]">
                      Pago al repartidor: {billingSymbol}
                      {Number(entry.driver_payout_usd || 0).toFixed(2)}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {canShowEntrega2Button(entry) ? (
                    <button
                      type="button"
                      onClick={() => void onSendParticularToEntrega2(entry.id)}
                      disabled={isSendingEntrega2 || Boolean(entrega2 && !["error", "failed"].includes(entrega2.status))}
                      aria-label={entrega2 ? `Entrega2 App: ${entrega2StatusLabel(entrega2.status)}` : "Enviar a Entrega2 App"}
                      className="inline-flex items-center gap-2 rounded-full bg-[#2E3A79] px-4 py-2 text-xs font-black text-white disabled:bg-[#D8DEEA] disabled:text-[#52647A]"
                    >
                      {isSendingEntrega2 ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {entrega2 ? `Entrega2 App: ${entrega2StatusLabel(entrega2.status)}` : "Enviar a Entrega2 App"}
                    </button>
                  ) : null}
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700"
                    >
                      Ver mapa
                    </a>
                  ) : null}
                  {commercePhone ? (
                    <a
                      href={`https://wa.me/${commercePhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-green-100 px-4 py-2 text-xs font-black text-green-700"
                    >
                      {request ? "Retiro WA" : "Comercio WA"}
                    </a>
                  ) : null}
                  {customerPhone ? (
                    <a
                      href={`https://wa.me/${customerPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-green-100 px-4 py-2 text-xs font-black text-green-700"
                    >
                      {request ? "Entrega WA" : "Cliente WA"}
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-[#EEF1F5] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                    Pedido
                  </p>
                  {entry.orders?.order_items?.length ? (
                    <div className="mt-3 grid gap-2">
                      {entry.orders.order_items.map((item: any) => (
                        <p key={item.id} className="text-sm font-bold text-[#746f69]">
                          {item.quantity} × {item.product_name}
                          {item.variant_name ? ` · ${item.variant_name}` : ""}
                        </p>
                      ))}
                    </div>
                  ) : request?.package_description ? (
                    <div className="mt-3 rounded-2xl bg-[#F8F3E8] px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#746f69]">
                        {requestDetailLabel(entry)}
                      </p>
                      <p className="mt-1 text-sm font-bold text-[#746f69]">{request.package_description}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm font-bold text-[#746f69]">
                      Sin productos cargados en el detalle.
                    </p>
                  )}
                  {entry.orders?.order_details || entry.orders?.notes ? (
                    <p className="mt-3 rounded-2xl bg-[#F8F3E8] px-3 py-2 text-xs font-bold text-[#746f69]">
                      {entry.orders.order_details || entry.orders.notes}
                    </p>
                  ) : null}
                </div>

                {entry.transport_order_events?.length ? (
                  <div className="rounded-2xl border border-[#EEF1F5] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                      Historial
                    </p>
                    <div className="mt-3 grid gap-2">
                      {entry.transport_order_events.slice(0, 8).map((event: any) => (
                        <p key={event.id} className="text-xs font-bold text-[#746f69]">
                          {transportStatusLabels[event.status_to] ||
                            event.status_to ||
                            event.event_type}{" "}
                          · {event.actor_name || event.actor_type}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
