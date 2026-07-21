"use client";

import { Loader2, RefreshCcw } from "lucide-react";
import { transportStatusLabels } from "@/components/transport/transport-panel-helpers";

type LoadOrders = (overrides?: Record<string, string>) => Promise<void>;

interface TransportOrdersTabProps {
  billingSymbol: string;
  isLoading: boolean;
  loadOrders: LoadOrders;
  onPeriodChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onStoreChange: (value: string) => void;
  onUpdateStatus: (orderId: string, status: string) => Promise<void>;
  orders: any[];
  page: number;
  period: string;
  savingOrderId: string | null;
  statusFilter: string;
  storeFilter: string;
  stores: any[];
  hasMore: boolean;
}

const statusActions = [
  ["agency_received", "Recibido"],
  ["agency_accepted", "Aceptar"],
  ["agency_rejected", "Rechazar"],
  ["pickup_pending", "Pendiente por retirar"],
  ["picked_up", "Retirado"],
  ["on_the_way", "En camino"],
  ["delivered", "Entregado"],
  ["delivery_failed", "Entrega fallida"],
  ["issue_reported", "Novedad"],
] as const;

export function TransportOrdersTab({
  billingSymbol,
  hasMore,
  isLoading,
  loadOrders,
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
}: TransportOrdersTabProps) {
  return (
    <section className="space-y-4">
      <div className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-black">Pedidos recibidos</h2>
            <p className="mt-1 text-sm font-bold text-[#746f69]">Servicios enviados por comercios afiliados a tu empresa delivery.</p>
          </div>
          <button type="button" onClick={() => loadOrders()} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]">
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Actualizar
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <select value={period} onChange={(event) => onPeriodChange(event.target.value)} className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]" aria-label="Periodo de pedidos">
            <option value="today">Hoy</option><option value="week">Semana</option><option value="all">Todos</option>
          </select>
          <select value={statusFilter} onChange={(event) => onStatusChange(event.target.value)} className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]" aria-label="Estado de pedidos">
            <option value="all">Todos los estados</option><option value="pending">Pendientes</option><option value="agency_accepted">Aceptados</option><option value="agency_rejected">Rechazados</option><option value="on_the_way">En camino</option><option value="delivered">Entregados</option><option value="issue_reported">Novedades</option>
          </select>
          <select value={storeFilter} onChange={(event) => onStoreChange(event.target.value)} className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]" aria-label="Comercio de los pedidos">
            <option value="all">Todos los comercios</option>
            {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center text-sm font-bold text-[#746f69]">{isLoading ? "Cargando pedidos..." : "No hay pedidos de empresa delivery con estos filtros."}</div>
      ) : (
        <div className="grid gap-3">
          {orders.map((entry) => {
            const isSaving = savingOrderId === entry.id;
            const commercePhone = String(entry.store_whatsapp_snapshot || entry.stores?.whatsapp || "").replace(/[^0-9]/g, "");
            const customerPhone = String(entry.customer_phone_snapshot || "").replace(/[^0-9]/g, "");
            const latitude = Number(entry.orders?.delivery_lat);
            const longitude = Number(entry.orders?.delivery_lng);
            const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
            return (
              <article key={entry.id} className="rounded-[28px] bg-white p-4 shadow-xl shadow-[#25262B]/10">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{entry.orders?.public_code || "Pedido"}</h3><span className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black text-[#2E3A79]">{transportStatusLabels[entry.status] || entry.status}</span></div>
                    <p className="mt-1 text-sm font-bold text-[#746f69]">{entry.store_name_snapshot || entry.stores?.name || "Comercio"} · {entry.customer_name_snapshot || "Cliente"} · {entry.customer_phone_snapshot || "sin teléfono"}</p>
                    <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">{entry.delivery_address || entry.delivery_reference || "Dirección por confirmar"}{entry.delivery_zone_name ? ` · ${entry.delivery_zone_name}` : ""}</p>
                    <p className="mt-2 text-sm font-black">Delivery: {billingSymbol}{Number(entry.delivery_fee_usd || 0).toFixed(2)}</p>
                    {entry.orders?.delivery_notes ? (
                      <p className="mt-1 text-xs font-bold leading-relaxed text-[#2E3A79]">
                        Regla de tarifa: {entry.orders.delivery_notes}
                      </p>
                    ) : null}
                    {hasLocation ? <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">Ver ubicación en mapa</a> : null}
                    {entry.orders?.order_items?.length ? <div className="mt-3 rounded-2xl bg-[#F8F3E8] p-3"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">Detalle del pedido</p>{entry.orders.order_items.map((item: any) => <p key={item.id} className="mt-1 text-sm font-bold text-[#746f69]">{item.quantity} × {item.product_name}{item.variant_name ? ` · ${item.variant_name}` : ""}</p>)}{entry.orders.order_details || entry.orders.notes ? <p className="mt-2 text-xs font-bold text-[#746f69]">{entry.orders.order_details || entry.orders.notes}</p> : null}</div> : null}
                    {entry.agency_status_note || entry.rejection_reason ? <p className="mt-2 rounded-2xl bg-[#F8F3E8] p-3 text-xs font-bold text-[#746f69]">{entry.agency_status_note || entry.rejection_reason}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
                    {commercePhone ? <a href={`https://wa.me/${commercePhone}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-green-100 px-3 py-2 text-xs font-black text-green-700">Comercio WA</a> : null}
                    {customerPhone ? <a href={`https://wa.me/${customerPhone}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-green-100 px-3 py-2 text-xs font-black text-green-700">Cliente WA</a> : null}
                    <select value={entry.status} disabled={isSaving || ["delivered", "agency_rejected", "cancelled"].includes(entry.status)} onChange={(event) => onUpdateStatus(entry.id, event.target.value)} className="rounded-full border border-[#2E3A79]/20 bg-[#2E3A79] px-4 py-2 text-xs font-black text-white disabled:bg-[#F8F3E8] disabled:text-[#746f69]" aria-label={`Actualizar estado de ${entry.orders?.public_code || "pedido"}`}>
                      <option value={entry.status}>{isSaving ? "Actualizando..." : transportStatusLabels[entry.status] || entry.status}</option>
                      {statusActions.filter(([status]) => status !== entry.status).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
                    </select>
                  </div>
                </div>
                {entry.transport_order_events?.length ? <div className="mt-4 border-t border-[#25262B]/10 pt-3"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">Historial</p><div className="mt-2 grid gap-1">{entry.transport_order_events.slice(0, 4).map((event: any) => <p key={event.id} className="text-xs font-bold text-[#746f69]">{transportStatusLabels[event.status_to] || event.status_to || event.event_type} · {event.actor_name || event.actor_type}</p>)}</div></div> : null}
              </article>
            );
          })}
        </div>
      )}
      {hasMore ? <div className="flex justify-center"><button type="button" onClick={() => loadOrders({ page: String(page + 1), append: "true" })} disabled={isLoading} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#2E3A79] shadow-xl shadow-[#25262B]/10 disabled:opacity-60">{isLoading ? <Loader2 size={16} className="animate-spin" /> : null}Cargar más pedidos</button></div> : null}
    </section>
  );
}
