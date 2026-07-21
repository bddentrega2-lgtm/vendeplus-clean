"use client";

import { useMemo, useState } from "react";

interface TransportBillingTabProps {
  billing: TransportBilling | null;
  currency: "USD" | "EUR";
  symbol: string;
}

interface TransportBillingOrder {
  created_at?: string | null;
  customer_name_snapshot?: string | null;
  customer_phone_snapshot?: string | null;
  delivery_fee_usd?: number | string | null;
  delivery_zone_name?: string | null;
  id: string;
  order_id?: string | null;
  orders?: {
    created_at?: string | null;
    delivery_distance_km?: number | string | null;
    delivery_usd?: number | string | null;
    delivery_zone_name?: string | null;
    distance_km?: number | string | null;
    public_code?: string | null;
  } | null;
  status?: string | null;
  store_id?: string | null;
  store_name_snapshot?: string | null;
  stores?: { name?: string | null } | null;
}

interface TransportBilling {
  orders?: TransportBillingOrder[];
  totalUsd?: number | string | null;
  week?: { endDate?: string | null; startDate?: string | null } | null;
}

function getAmount(order: TransportBillingOrder) {
  return Number(order.delivery_fee_usd ?? order.orders?.delivery_usd ?? 0);
}

function formatServiceDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function getDeliveryDetail(order: TransportBillingOrder) {
  const zone = order.delivery_zone_name || order.orders?.delivery_zone_name;
  if (zone) return `Zona: ${zone}`;

  const distance = order.orders?.delivery_distance_km ?? order.orders?.distance_km;
  const parsedDistance = Number(distance);
  if (Number.isFinite(parsedDistance) && parsedDistance > 0) {
    return `${parsedDistance.toFixed(2)} km`;
  }

  return "Zona/km por confirmar";
}

export function TransportBillingTab({ billing, currency, symbol }: TransportBillingTabProps) {
  const [storeFilter, setStoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const stats = useMemo(() => {
    const orders = billing?.orders || [];
    const storeMap = new Map<
      string,
      {
        storeId: string;
        storeName: string;
        orders: number;
        total: number;
        delivered: number;
        pending: number;
      }
    >();

    for (const order of orders) {
      const storeId = String(order.store_id || "sin-comercio");
      const status = String(order.status || "");
      const current = storeMap.get(storeId) || {
        storeId,
        storeName: order.store_name_snapshot || order.stores?.name || "Comercio",
        orders: 0,
        total: 0,
        delivered: 0,
        pending: 0,
      };

      current.orders += 1;
      if (status === "delivered") {
        current.total += getAmount(order);
        current.delivered += 1;
      } else {
        current.pending += 1;
      }
      storeMap.set(storeId, current);
    }

    const filteredOrders = orders.filter((order) => {
      const matchesStore = storeFilter === "all" || order.store_id === storeFilter;
      const matchesStatus = statusFilter === "all" || String(order.status || "") === statusFilter;
      return matchesStore && matchesStatus;
    });

    return {
      byStore: Array.from(storeMap.values()).sort((a, b) => b.total - a.total),
      deliveredCount: orders.filter((order) => String(order.status || "") === "delivered").length,
      filteredOrders,
      filteredTotal: filteredOrders.reduce(
        (sum, order) => (order.status === "delivered" ? sum + getAmount(order) : sum),
        0
      ),
      pendingCount: orders.filter(
        (order) => !["delivered", "cancelled", "agency_rejected"].includes(String(order.status || ""))
      ).length,
      totalOrders: orders.length,
      totalUsd: Number(billing?.totalUsd || 0),
    };
  }, [billing, statusFilter, storeFilter]);

  return (
    <section className="space-y-4">
      <div className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h2 className="text-xl font-black">Facturacion semanal</h2>
            <p className="mt-2 text-sm font-bold text-[#746f69]">
              {billing?.week?.startDate} a {billing?.week?.endDate} · Moneda de cobro {currency}
            </p>
          </div>
          <div className="rounded-3xl bg-[#F8F3E8] px-5 py-4 text-right">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
              Balance general
            </p>
            <p className="mt-1 text-3xl font-black">
              {symbol}
              {stats.totalUsd.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            ["Servicios", stats.totalOrders],
            ["Entregados", stats.deliveredCount],
            ["Pendientes", stats.pendingCount],
            ["Filtrado", `${symbol}${stats.filteredTotal.toFixed(2)}`],
          ].map(([label, value]) => (
            <div key={label} className="border-t border-[#25262B]/10 pt-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                {label}
              </p>
              <p className="mt-1 text-2xl font-black">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
              Comercio
            </span>
            <select
              value={storeFilter}
              onChange={(event) => setStoreFilter(event.target.value)}
              className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
            >
              <option value="all">Todos los comercios</option>
              {stats.byStore.map((store) => (
                <option key={store.storeId} value={store.storeId}>
                  {store.storeName}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
              Estado
            </span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
            >
              <option value="all">Todos</option>
              <option value="sent_to_agency">Enviado</option>
              <option value="agency_received">Recibido</option>
              <option value="agency_accepted">Aceptado</option>
              <option value="picked_up">Retirado</option>
              <option value="on_the_way">En camino</option>
              <option value="delivered">Entregado</option>
              <option value="issue_reported">Novedad</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {stats.byStore.map((store) => (
          <article key={store.storeId} className="rounded-[28px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-black">{store.storeName}</h3>
                <p className="mt-1 text-sm font-bold text-[#746f69]">
                  {store.orders} servicios · {store.delivered} entregados · {store.pending} pendientes
                </p>
              </div>
              <p className="text-xl font-black">
                {symbol}
                {store.total.toFixed(2)}
              </p>
            </div>
          </article>
        ))}
        {!stats.byStore.length ? (
          <div className="rounded-[28px] bg-white p-5 text-sm font-black text-[#746f69]">
            Aun no hay servicios facturables esta semana.
          </div>
        ) : null}
      </div>

      <div className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
        <h3 className="text-lg font-black">Servicios filtrados</h3>
        <div className="mt-3 grid gap-2">
          {stats.filteredOrders.slice(0, 30).map((order) => (
            <div
              key={order.id}
              className="flex flex-col justify-between gap-3 rounded-2xl bg-[#F8F3E8] p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                <p className="text-sm font-black">{order.orders?.public_code || "Pedido"}</p>
                <p className="text-xs font-bold text-[#746f69]">
                  {order.store_name_snapshot || order.stores?.name || "Comercio"} · {order.status}
                </p>
                <p className="mt-1 text-xs font-bold text-[#746f69]">
                  {order.customer_name_snapshot || "Cliente"} · {getDeliveryDetail(order)}
                </p>
                <p className="mt-1 text-xs font-bold text-[#746f69]">
                  {formatServiceDate(order.created_at || order.orders?.created_at)}
                  {order.customer_phone_snapshot ? ` · ${order.customer_phone_snapshot}` : ""}
                </p>
              </div>
              <p className="text-sm font-black">
                {symbol}
                {getAmount(order).toFixed(2)}
              </p>
            </div>
          ))}
          {!stats.filteredOrders.length ? (
            <p className="text-sm font-black text-[#746f69]">No hay servicios con esos filtros.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
