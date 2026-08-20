"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Crown, Loader2, PauseCircle, RefreshCcw, XCircle } from "lucide-react";
import {
  getPanelAuthHeaders,
  getSavedPanelPin,
  hasSavedPanelAuth,
} from "@/lib/panel/client-auth";

export function AdminTransportManager() {
  const [pin, setPin] = useState("");
  const [data, setData] = useState<any>({
    agencies: [],
    requests: [],
    connections: [],
    transportOrders: [],
    summary: null,
  });
  const [isLoading, setIsLoading] = useState(() => hasSavedPanelAuth());
  const [message, setMessage] = useState("");
  const [storeQuery, setStoreQuery] = useState("");
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersHasMore, setOrdersHasMore] = useState(false);
  const [savingPremiumAgencyId, setSavingPremiumAgencyId] = useState("");

  const load = useCallback(async (currentPin?: string, options: { ordersPage?: number; appendOrders?: boolean } = {}) => {
    setIsLoading(true);
    setMessage("");
    try {
      const authPin = currentPin ?? getSavedPanelPin();
      const nextOrdersPage = options.ordersPage || 1;
      const params = new URLSearchParams({
        ordersPage: String(nextOrdersPage),
        ordersLimit: "50",
      });
      const response = await fetch(`/api/admin/transport/agencies?${params.toString()}`, {
        headers: await getPanelAuthHeaders(authPin),
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "No se pudo cargar transporte.");
      setData((current: any) =>
        options.appendOrders
          ? {
              ...next,
              transportOrders: [
                ...(current.transportOrders || []),
                ...(next.transportOrders || []),
              ],
            }
          : next
      );
      setOrdersPage(nextOrdersPage);
      setOrdersHasMore(Boolean(next.pagination?.transportOrders?.hasMore));
    } catch (error: any) {
      setMessage(error.message || "No se pudo cargar transporte.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedPin = getSavedPanelPin();
    setPin(savedPin);
    load(savedPin);
  }, [load]);

  async function updateAgency(agencyId: string, status: string) {
    const response = await fetch("/api/admin/transport/agencies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await getPanelAuthHeaders(pin)) },
      body: JSON.stringify({ agencyId, status }),
    });
    const next = await response.json();
    if (!response.ok) {
      setMessage(next.error || "No se pudo actualizar.");
      return;
    }
    setMessage("Empresa delivery actualizada.");
    load();
  }

  async function updatePremiumDispatch(agencyId: string, enabled: boolean) {
    setSavingPremiumAgencyId(agencyId);
    setMessage("");
    try {
      const response = await fetch("/api/admin/transport/agencies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await getPanelAuthHeaders(pin)) },
        body: JSON.stringify({
          action: "update_premium_dispatch",
          agencyId,
          enabled,
        }),
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "No se pudo actualizar el pack premium.");

      setData((current: any) => ({
        ...current,
        agencies: (current.agencies || []).map((agency: any) =>
          agency.id === agencyId ? { ...agency, ...next.agency } : agency
        ),
      }));
      setMessage(enabled ? "Pack premium activado." : "Pack premium desactivado.");
    } catch (error: any) {
      setMessage(error.message || "No se pudo actualizar el pack premium.");
    } finally {
      setSavingPremiumAgencyId("");
    }
  }

  async function disengageConnection(connectionId: string) {
    if (
      !window.confirm(
        "Desafiliar esta empresa delivery del comercio de forma inmediata? Esto puede desactivar el delivery del checkout si era el proveedor activo."
      )
    ) {
      return;
    }

    const response = await fetch(`/api/admin/transport/connections/${connectionId}/disengage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getPanelAuthHeaders(pin)) },
      body: JSON.stringify({}),
    });
    const next = await response.json();
    if (!response.ok) {
      setMessage(next.error || "No se pudo desafiliar.");
      return;
    }
    setMessage(
      next.checkoutDeliveryDisabled
        ? "Empresa desafiliada. Delivery desactivado en checkout para ese comercio."
        : "Empresa desafiliada."
    );
    load();
  }

  const summary = data.summary || {};
  const normalizedStoreQuery = storeQuery.trim().toLowerCase();
  const filteredRequests = (data.requests || []).filter((entry: any) => {
    if (!normalizedStoreQuery) return true;
    return [entry.stores?.name, entry.stores?.slug, entry.store_name_snapshot]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedStoreQuery));
  });
  const filteredConnections = (data.connections || []).filter((entry: any) => {
    if (!normalizedStoreQuery) return true;
    return [entry.stores?.name, entry.stores?.slug, entry.transport_agencies?.name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedStoreQuery));
  });

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Empresas aprobadas" value={summary.activeAgencies || 0} />
        <Metric label="Empresas pendientes" value={summary.pendingAgencies || 0} />
        <Metric label="Solicitudes pendientes" value={summary.pendingRequests || 0} />
        <Metric label="Delivery semana" value={`$${Number(summary.deliveryUsd || 0).toFixed(2)}`} />
      </section>

      <div className="flex justify-end">
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
          <input
            value={storeQuery}
            onChange={(event) => setStoreQuery(event.target.value)}
            placeholder="Filtrar por comercio o empresa..."
            className="rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79] md:w-80"
          />
          <button
            onClick={() => load()}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Actualizar
          </button>
        </div>
      </div>

      {message ? <p className="rounded-2xl bg-white p-3 text-sm font-black text-[#2E3A79]">{message}</p> : null}

      <section className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
        <h2 className="text-xl font-black">Empresas delivery</h2>
        <div className="mt-4 grid gap-3">
          {(data.agencies || []).map((agency: any) => (
            <div key={agency.id} className="rounded-3xl bg-[#F8F3E8] p-4">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                <div>
                  <h3 className="text-lg font-black">{agency.name}</h3>
                  <p className="text-sm font-bold text-[#746f69]">
                    {agency.status} · {agency.contact_email} · {agency.city || "Sin ciudad"}
                  </p>
                  <p className="mt-1 text-xs font-black text-[#2E3A79]">
                    {agency.status === "active"
                      ? agency.is_active
                        ? "Visible para comercios"
                        : "Acceso aprobado - falta configuracion para publicarse"
                      : "Pendiente de aprobacion de acceso"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updatePremiumDispatch(agency.id, agency.premium_dispatch_enabled !== true)
                    }
                    disabled={savingPremiumAgencyId === agency.id}
                    aria-pressed={agency.premium_dispatch_enabled === true}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black disabled:opacity-60 ${
                      agency.premium_dispatch_enabled
                        ? "bg-[#2E3A79] text-white"
                        : "bg-white text-[#2E3A79] ring-1 ring-[#2E3A79]/20"
                    }`}
                  >
                    {savingPremiumAgencyId === agency.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Crown size={15} />
                    )}
                    {agency.premium_dispatch_enabled ? "Premium activo" : "Activar premium"}
                  </button>
                  <button
                    onClick={() => updateAgency(agency.id, "active")}
                    className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-xs font-black text-green-700"
                  >
                    <CheckCircle2 size={15} />
                    Aprobar acceso
                  </button>
                  <button
                    onClick={() => updateAgency(agency.id, "paused")}
                    className="inline-flex items-center gap-2 rounded-full bg-[#FFF8F0] px-4 py-2 text-xs font-black text-[#8a5b00]"
                  >
                    <PauseCircle size={15} />
                    Pausar
                  </button>
                  <button
                    onClick={() => updateAgency(agency.id, "rejected")}
                    className="inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-2 text-xs font-black text-red-700"
                  >
                    <XCircle size={15} />
                    Rechazar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!data.agencies?.length ? (
            <p className="text-sm font-black text-[#746f69]">No hay empresas delivery registradas.</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <PanelList
          title="Solicitudes comercio-empresa"
          empty="Sin solicitudes."
          items={filteredRequests}
          render={(entry) => (
            <div className="rounded-3xl bg-white p-4">
              <h3 className="font-black">{entry.stores?.name || "Comercio"}</h3>
              <p className="text-sm font-bold text-[#746f69]">{entry.status}</p>
            </div>
          )}
        />
        <PanelList
          title="Conexiones"
          empty="Sin conexiones."
          items={filteredConnections}
          render={(entry) => (
            <div className="rounded-3xl bg-white p-4">
              <h3 className="font-black">{entry.stores?.name || "Comercio"}</h3>
              <p className="text-sm font-bold text-[#746f69]">
                {entry.transport_agencies?.name || "Empresa delivery"} - {entry.status}
                {entry.is_default ? " - activa" : ""}
              </p>
              {entry.status === "active" ? (
                <button
                  type="button"
                  onClick={() => disengageConnection(entry.id)}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-2 text-xs font-black text-red-700"
                >
                  <XCircle size={15} />
                  Desafiliar ahora
                </button>
              ) : null}
            </div>
          )}
        />
      </section>

      <PanelList
        title="Ordenes de transporte recientes"
        empty="Sin ordenes de transporte esta semana."
        items={data.transportOrders || []}
        render={(entry) => (
          <div className="rounded-3xl bg-white p-4">
            <h3 className="font-black">{entry.orders?.public_code || "Pedido"}</h3>
            <p className="text-sm font-bold text-[#746f69]">
              {entry.stores?.name || "Comercio"} - {entry.transport_agencies?.name || "Empresa delivery"} - {entry.status}
            </p>
            <p className="mt-1 text-sm font-black">
              ${Number(entry.delivery_fee_usd ?? entry.orders?.delivery_usd ?? 0).toFixed(2)}
            </p>
          </div>
        )}
      />
      {ordersHasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => load(pin, { ordersPage: ordersPage + 1, appendOrders: true })}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#2E3A79] shadow-xl shadow-[#25262B]/10 disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            Cargar mas ordenes
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function PanelList({
  title,
  items,
  empty,
  render,
}: {
  title: string;
  items: any[];
  empty: string;
  render: (item: any) => React.ReactNode;
}) {
  return (
    <section className="rounded-[32px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/10">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-3 grid gap-3">
        {items.map((item) => (
          <div key={item.id}>{render(item)}</div>
        ))}
        {!items.length ? <p className="text-sm font-black text-[#746f69]">{empty}</p> : null}
      </div>
    </section>
  );
}
