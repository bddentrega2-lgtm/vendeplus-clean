"use client";

import { useState, type ReactNode } from "react";
import { Eye, Loader2, MessageCircle, RefreshCcw, X } from "lucide-react";
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
  onAssignDriver: (orderId: string, driverId: string) => Promise<void>;
  onLoadOrderDetail: (orderId: string) => Promise<void>;
  onPeriodChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onStoreChange: (value: string) => void;
  onUpdateStatus: (orderId: string, status: string) => Promise<void>;
  orders: any[];
  page: number;
  period: string;
  premiumDispatchEnabled: boolean;
  savingOrderId: string | null;
  statusFilter: string;
  storeFilter: string;
  stores: any[];
}

const statusActionsByCurrent: Record<string, Array<readonly [string, string]>> = {
  pending_agency: [["agency_accepted", "Aceptar"], ["agency_rejected", "Rechazar"]],
  sent_to_agency: [["agency_accepted", "Aceptar"], ["agency_rejected", "Rechazar"]],
  agency_received: [["agency_accepted", "Aceptar"], ["agency_rejected", "Rechazar"]],
  agency_accepted: [["on_the_way", "En camino"], ["issue_reported", "Reportar novedad"]],
  driver_assigned: [["on_the_way", "En camino"], ["issue_reported", "Reportar novedad"]],
  pickup_pending: [["on_the_way", "En camino"], ["issue_reported", "Reportar novedad"]],
  picked_up: [["on_the_way", "En camino"], ["issue_reported", "Reportar novedad"]],
  on_the_way: [["delivered", "Entregado"], ["delivery_failed", "Entrega fallida"], ["issue_reported", "Reportar novedad"]],
  issue_reported: [["agency_accepted", "Retomar"], ["on_the_way", "En camino"], ["cancelled", "Cancelar"]],
};

const closedStatuses = ["delivered", "agency_rejected", "cancelled", "delivery_failed"];

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
  onAssignDriver,
  onLoadOrderDetail,
  onPeriodChange,
  onStatusChange,
  onStoreChange,
  onUpdateStatus,
  orders,
  page,
  period,
  savingOrderId,
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

  function buildMapsUrl(entry: any) {
    const latitude = Number(entry.orders?.delivery_lat);
    const longitude = Number(entry.orders?.delivery_lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  }

  function isCashPayment(value: unknown) {
    return /efectivo|cash/i.test(String(value || ""));
  }

  function buildDriverCommandUrl(entry: any, driver: any) {
    const driverPhone = cleanPhone(driver?.phone);
    if (!driverPhone) return "";

    const paymentMethod = String(entry.orders?.payment_method || "No indicado");
    const cashPayment = isCashPayment(paymentMethod);
    const mapsUrl = buildMapsUrl(entry);
    const total = Number(entry.orders?.total_usd || 0);
    const message = [
      "*Nuevo servicio delivery*",
      entry.orders?.public_code ? `Pedido: ${entry.orders.public_code}` : null,
      "",
      `Comercio: ${entry.store_name_snapshot || entry.stores?.name || "Comercio"}`,
      `Telefono comercio: ${entry.store_whatsapp_snapshot || entry.stores?.whatsapp || "No indicado"}`,
      "",
      `Cliente: ${entry.customer_name_snapshot || "Cliente"}`,
      `Telefono cliente: ${entry.customer_phone_snapshot || "No indicado"}`,
      mapsUrl ? `Ubicacion GPS: ${mapsUrl}` : "Ubicacion GPS: no indicada",
      entry.delivery_address || entry.delivery_reference
        ? `Referencia: ${entry.delivery_address || entry.delivery_reference}`
        : null,
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
        aria-label={`Asignar repartidor a ${entry.orders?.public_code || "pedido"}`}
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
                <span>Cliente</span>
                <span>Precio</span>
                <span>Estado</span>
                <span>Repartidor</span>
                <span className="text-right">Acciones</span>
              </div>

              {orders.map((entry) => {
                const isSaving = savingOrderId === entry.id;
                const isDetailLoading = loadingDetailOrderId === entry.id;
                const assignedDriver = drivers.find((driver) => driver.id === entry.driver_id);
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
                        {entry.orders?.public_code || "Pedido"}
                      </p>
                      <p className="mt-1 text-xs font-bold text-[#8A98AA]">
                        {formatTime(entry.created_at || entry.orders?.created_at)}
                      </p>
                    </div>
                    <p className="truncate pr-3 font-black text-[#162033]">
                      {entry.store_name_snapshot || entry.stores?.name || "Comercio"}
                    </p>
                    <div className="min-w-0 pr-3">
                      <p className="truncate font-black text-[#162033]">
                        {entry.customer_name_snapshot || "Cliente"}
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
                        aria-label={`Actualizar estado de ${entry.orders?.public_code || "pedido"}`}
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
}: {
  billingSymbol: string;
  cleanPhone: (value: unknown) => string;
  entry: any;
  isLoading: boolean;
  mapsUrl: string;
  onClose: () => void;
  renderDriverSelect: (entry: any, compact?: boolean) => ReactNode;
}) {
  const commercePhone = cleanPhone(entry.store_whatsapp_snapshot || entry.stores?.whatsapp);
  const customerPhone = cleanPhone(entry.customer_phone_snapshot);
  const paymentMethod = String(entry.orders?.payment_method || "No indicado");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#162033]/50 p-4">
      <section className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#EEF1F5] px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#746f69]">
              Detalle del servicio
            </p>
            <h3 className="mt-1 text-2xl font-black text-[#162033]">
              {entry.orders?.public_code || "Pedido"}
            </h3>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              {entry.store_name_snapshot || entry.stores?.name || "Comercio"} ·{" "}
              {entry.customer_name_snapshot || "Cliente"}
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
                    <p>
                      Delivery:{" "}
                      <span className="font-black text-[#162033]">
                        {billingSymbol}
                        {Number(entry.delivery_fee_usd || 0).toFixed(2)}
                      </span>
                    </p>
                    <p>Pago: {paymentMethod}</p>
                    <p>
                      Dirección:{" "}
                      {entry.delivery_address || entry.delivery_reference || "Por confirmar"}
                      {entry.delivery_zone_name ? ` · ${entry.delivery_zone_name}` : ""}
                    </p>
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
                      Comercio WA
                    </a>
                  ) : null}
                  {customerPhone ? (
                    <a
                      href={`https://wa.me/${customerPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-green-100 px-4 py-2 text-xs font-black text-green-700"
                    >
                      Cliente WA
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
