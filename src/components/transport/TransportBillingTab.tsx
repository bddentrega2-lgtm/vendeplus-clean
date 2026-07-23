"use client";

import { useEffect, useMemo, useState } from "react";
import { getPanelAuthHeaders, getSavedPanelPin } from "@/lib/panel/client-auth";

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
    status?: string | null;
  } | null;
  status?: string | null;
  store_id?: string | null;
  store_name_snapshot?: string | null;
  stores?: { name?: string | null } | null;
}

interface TransportBilling {
  orders?: TransportBillingOrder[];
  range?: { endDate?: string | null; startDate?: string | null } | null;
  totalUsd?: number | string | null;
  week?: { endDate?: string | null; startDate?: string | null } | null;
}

const rangeOptions = [
  { value: "this_week", label: "Esta semana" },
  { value: "last_week", label: "Semana pasada" },
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "custom", label: "Personalizado" },
];

function getAmount(order: TransportBillingOrder) {
  const parsed = Number(order.delivery_fee_usd ?? order.orders?.delivery_usd ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatServiceDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "short",
    timeStyle: "short",
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

function getServiceId(order: TransportBillingOrder) {
  return order.orders?.public_code || order.order_id?.slice(0, 8) || order.id.slice(0, 8);
}

export function TransportBillingTab({ billing, currency, symbol }: TransportBillingTabProps) {
  const [billingData, setBillingData] = useState<TransportBilling | null>(billing);
  const [storeFilter, setStoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [range, setRange] = useState("this_week");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setBillingData(billing);
  }, [billing]);

  async function loadBilling(overrideRange = range) {
    setIsLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({
        includeBilling: "true",
        includeRelations: "false",
        range: overrideRange,
      });

      if (overrideRange === "custom") {
        if (startDate) params.set("start", startDate);
        if (endDate) params.set("end", endDate);
      }

      const response = await fetch(`/api/transport/me?${params.toString()}`, {
        headers: await getPanelAuthHeaders(getSavedPanelPin()),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo cargar facturación.");
      setBillingData(data.billing || null);
    } catch (error: any) {
      setMessage(error.message || "No se pudo cargar facturación.");
    } finally {
      setIsLoading(false);
    }
  }

  const stats = useMemo(() => {
    const orders = billingData?.orders || [];
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
      current.total += getAmount(order);
      if (status === "delivered") {
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
      filteredTotal: filteredOrders.reduce((sum, order) => sum + getAmount(order), 0),
      pendingCount: orders.filter((order) => String(order.status || "") !== "delivered").length,
      totalOrders: orders.length,
      totalUsd: Number(billingData?.totalUsd || 0),
    };
  }, [billingData, statusFilter, storeFilter]);

  return (
    <section className="space-y-4">
      <div className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h2 className="text-xl font-black">Facturación delivery</h2>
            <p className="mt-2 text-sm font-bold text-[#746f69]">
              {billingData?.range?.startDate || billingData?.week?.startDate || "--"} a{" "}
              {billingData?.range?.endDate || billingData?.week?.endDate || "--"} · Moneda de cobro {currency}
            </p>
            <p className="mt-1 text-xs font-black text-[#746f69]">
              Incluye todos los servicios no cancelados del período.
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

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
              Período
            </span>
            <select
              value={range}
              onChange={(event) => {
                const nextRange = event.target.value;
                setRange(nextRange);
                if (nextRange !== "custom") void loadBilling(nextRange);
              }}
              className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
            >
              {rangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
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
          <button
            type="button"
            onClick={() => loadBilling(range)}
            disabled={isLoading}
            className="self-end rounded-2xl bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {isLoading ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        {range === "custom" ? (
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none"
            />
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none"
            />
            <button
              type="button"
              onClick={() => loadBilling("custom")}
              disabled={isLoading}
              className="rounded-2xl bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              Aplicar fechas
            </button>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            ["Servicios", stats.totalOrders],
            ["Entregados", stats.deliveredCount],
            ["En proceso", stats.pendingCount],
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

        <label className="mt-4 block space-y-1">
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

        {message ? (
          <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-black text-red-700">{message}</p>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {stats.byStore.map((store) => (
          <article key={store.storeId} className="rounded-[28px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-black">{store.storeName}</h3>
                <p className="mt-1 text-sm font-bold text-[#746f69]">
                  {store.orders} servicios · {store.delivered} entregados · {store.pending} en proceso
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
            Aún no hay servicios facturables en este período.
          </div>
        ) : null}
      </div>

      <div className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-black">Detalle de servicios</h3>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              ID, fecha, cliente, precio y zona/km.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDetail((current) => !current)}
            className="rounded-full bg-[#F8F3E8] px-5 py-3 text-sm font-black"
          >
            {showDetail ? "Ocultar detalle" : "Ver detalle"}
          </button>
        </div>

        {showDetail ? (
          <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-[#25262B]/10">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-[#F8F3E8] text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Fecha y hora</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Precio</th>
                  <th className="px-4 py-3">Zona o km</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#25262B]/10 bg-white">
                {stats.filteredOrders.map((order) => (
                  <tr key={order.id} className="font-bold text-[#25262B]">
                    <td className="px-4 py-3">{getServiceId(order)}</td>
                    <td className="px-4 py-3">{formatServiceDate(order.created_at || order.orders?.created_at)}</td>
                    <td className="px-4 py-3">{order.customer_name_snapshot || "Cliente"}</td>
                    <td className="px-4 py-3 font-black text-[#2E3A79]">
                      {symbol}
                      {getAmount(order).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">{getDeliveryDetail(order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {showDetail && !stats.filteredOrders.length ? (
          <p className="mt-3 text-sm font-black text-[#746f69]">No hay servicios con esos filtros.</p>
        ) : null}
      </div>
    </section>
  );
}
