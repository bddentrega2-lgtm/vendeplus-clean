"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Loader2, RefreshCcw, Send, ShieldCheck, Truck, XCircle } from "lucide-react";
import { getPanelAuthHeaders } from "@/lib/panel/client-auth";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import { getTransportAgencyRateFromRelation } from "@/lib/transport";

type Props = {
  pin: string;
  onChanged?: () => void;
};

const EMPTY_LIST: any[] = [];

export function TransportMarketplaceSection({ pin, onChanged }: Props) {
  const [data, setData] = useState<any>({
    stores: [],
    agencies: [],
    requests: [],
    connections: [],
    billing: null,
  });
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [recentlyRequestedAgencyIds, setRecentlyRequestedAgencyIds] = useState<string[]>([]);

  const stores = data.stores ?? EMPTY_LIST;
  const agencies = data.agencies ?? EMPTY_LIST;
  const requests = data.requests ?? EMPTY_LIST;
  const connections = data.connections ?? EMPTY_LIST;
  const activeStoreId = selectedStoreId || stores[0]?.id || "";

  function formatDateTime(value?: string | null) {
    if (!value) return "";
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }

  const connectionEnded = useCallback((connection: any) => {
    return Boolean(
        connection?.disengagement_confirmed_at &&
        connection?.disengagement_effective_at &&
        nowMs > 0 &&
        new Date(connection.disengagement_effective_at).getTime() <= nowMs
    );
  }, [nowMs]);

  const connectionPendingExit = useCallback((connection: any) => {
    return Boolean(connection?.disengagement_requested_at && !connectionEnded(connection));
  }, [connectionEnded]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/panel/transport/agencies", {
        headers: await getPanelAuthHeaders(pin),
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "No se pudo cargar empresas delivery.");
      setData(next);
      setSelectedStoreId((current) => current || next.stores?.[0]?.id || "");
    } catch (error: any) {
      setMessage(error.message || "No se pudo cargar empresas delivery.");
    } finally {
      setIsLoading(false);
    }
  }, [pin]);

  useEffect(() => {
    setNowMs(Date.now());
    load();
  }, [load]);

  const byAgency = useMemo(() => {
    const map = new Map<string, { request?: any; connection?: any }>();
    for (const entry of requests.filter((item: any) => item.store_id === activeStoreId)) {
      map.set(entry.agency_id, { ...(map.get(entry.agency_id) || {}), request: entry });
    }
    for (const entry of connections.filter((item: any) => item.store_id === activeStoreId)) {
      map.set(entry.agency_id, { ...(map.get(entry.agency_id) || {}), connection: entry });
    }
    return map;
  }, [requests, connections, activeStoreId]);

  const activeExclusiveConnection = useMemo(
    () =>
      connections.find(
        (connection: any) =>
          connection.store_id === activeStoreId &&
          connection.status === "active" &&
          connection.is_exclusive &&
          !connectionEnded(connection)
      ) || null,
    [connections, activeStoreId, connectionEnded]
  );

  const visibleAgencies = useMemo(() => {
    if (!activeExclusiveConnection?.agency_id) return agencies;
    return agencies.filter((agency: any) => agency.id === activeExclusiveConnection.agency_id);
  }, [agencies, activeExclusiveConnection?.agency_id]);

  function pricingLabel(agency: any) {
    const rate = getTransportAgencyRateFromRelation(agency.transport_agency_rates) || {};

    if (agency.pricing_type === "flat") {
      return `Tarifa plana $${Number(rate.flat_fee_usd || 0).toFixed(2)}${
        rate.max_distance_km ? ` hasta ${rate.max_distance_km} km` : ""
      }`;
    }

    if (agency.pricing_type === "distance_ranges") {
      return `${agency.transport_agency_distance_rates?.length || 0} rangos configurados${
        rate.max_distance_km ? ` - limite ${rate.max_distance_km} km` : ""
      }`;
    }

    if (agency.pricing_type === "zones") {
      return `${agency.transport_agency_zones?.length || 0} zonas configuradas`;
    }

    return rate.manual_quote_message || "Cotiza cada pedido por WhatsApp";
  }

  async function requestAgency(agencyId: string) {
    if (!activeStoreId) return;
    setMessage("");
    const response = await fetch(`/api/panel/transport/agencies/${agencyId}/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getPanelAuthHeaders(pin)) },
      body: JSON.stringify({ storeId: activeStoreId }),
    });
    const next = await response.json();
    if (!response.ok) {
      setMessage(next.error || "No se pudo solicitar.");
      return;
    }
    setRecentlyRequestedAgencyIds((current) =>
      current.includes(agencyId) ? current : [...current, agencyId]
    );
    setData((current: any) => {
      const request = next.request;
      if (!request) return current;
      const requests = (current.requests || []).filter(
        (entry: any) => !(entry.store_id === activeStoreId && entry.agency_id === agencyId)
      );
      return { ...current, requests: [...requests, request] };
    });
    setMessage(next.message || "Solicitud enviada a la empresa delivery.");
    await load();
  }

  async function activateConnection(connectionId: string) {
    setMessage("");
    const response = await fetch(`/api/panel/transport/connections/${connectionId}/activate`, {
      method: "POST",
      headers: await getPanelAuthHeaders(pin),
    });
    const next = await response.json();
    if (!response.ok) {
      setMessage(next.error || "No se pudo activar.");
      return;
    }
    setMessage("Empresa delivery activada como proveedor.");
    await load();
    onChanged?.();
  }

  async function requestDisengagement(connection: any) {
    const isAgencyRequest = connection?.disengagement_requested_by === "agency";
    if (
      !window.confirm(
        isAgencyRequest
          ? "Confirmar desafiliacion solicitada por la empresa delivery? La salida se ejecutara al confirmar ambas partes."
          : "Solicitar desafiliacion a esta empresa delivery? La salida se ejecutara cuando la empresa confirme."
      )
    ) {
      return;
    }

    setMessage("");
    const response = await fetch(`/api/panel/transport/connections/${connection.id}/disengage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getPanelAuthHeaders(pin)) },
      body: JSON.stringify({}),
    });
    const next = await response.json();
    if (!response.ok) {
      setMessage(next.error || "No se pudo solicitar la desafiliacion.");
      return;
    }
    setMessage(next.message || "Solicitud de desafiliacion enviada.");
    await load();
    onChanged?.();
  }

  return (
    <section className="rounded-[34px] bg-[#25262B] p-5 text-white shadow-xl shadow-[#25262B]/20">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
            Afiliarse a una empresa delivery
          </p>
          <h2 className="mt-2 text-2xl font-black">Red de delivery disponible</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-white/70">
            Revisa condiciones, solicita afiliacion y activa una empresa aprobada cuando acepte trabajar con el comercio.
          </p>
        </div>
        <button
          onClick={load}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
          Actualizar empresas
        </button>
      </div>

      {stores.length > 1 ? (
        <label className="mt-4 block max-w-sm space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-white/60">Comercio</span>
          <select
            value={activeStoreId}
            onChange={(event) => setSelectedStoreId(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm font-bold text-[#25262B] outline-none focus:border-[#FFB547]"
          >
            {stores.map((store: any) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {activeExclusiveConnection ? (
        <div className="mt-4 rounded-2xl bg-white/10 p-4 text-sm font-bold leading-relaxed text-white/75">
          Este comercio tiene una afiliacion exclusiva activa. Por proteccion de esa alianza,
          solo se muestra la empresa delivery afiliada actualmente.
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {visibleAgencies.map((agency: any) => {
          const status = byAgency.get(agency.id) || {};
          const connection = status.connection;
          const request = status.request;
          const isEnded = connectionEnded(connection);
          const isPendingExit = connectionPendingExit(connection);
          const canResendRequest = request && ["rejected", "cancelled"].includes(request.status);
          const wasJustRequested = recentlyRequestedAgencyIds.includes(agency.id);
          const canSeeRates = agency.rates_visibility !== "private" || (connection && !isEnded);
          const isReady = agency.is_ready !== false;
          const configIssues = agency.config_issues || [];
          return (
            <details key={agency.id} className="group rounded-[22px] bg-white p-2 text-[#25262B]">
              <summary className="flex cursor-pointer list-none flex-col items-center gap-2 text-center">
                {agency.logo_url ? (
                  <OptimizedImage
                    src={agency.logo_url}
                    alt={agency.name}
                    width={56}
                    height={56}
                    sizes="56px"
                    className="h-14 w-14 rounded-2xl bg-[#F8F3E8] object-cover"
                    fallback={
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#F8F3E8] text-sm font-black text-[#2E3A79]">
                        {agency.name?.slice(0, 1).toUpperCase() || "D"}
                      </div>
                    }
                  />
                ) : (
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#2E3A79] text-[#FFB547]">
                    <Truck size={20} />
                  </div>
                )}
                <span className="line-clamp-2 min-h-[2rem] text-xs font-black leading-tight">
                  {agency.name}
                </span>
                <span className="rounded-full bg-[#F8F3E8] px-2 py-1 text-[10px] font-black text-[#746f69]">
                  {connection && !isEnded
                    ? "Afiliada"
                    : request && !canResendRequest
                      ? "Solicitada"
                      : isReady
                        ? "Disponible"
                        : "Por completar"}
                </span>
              </summary>

              <div className="mt-3 rounded-[20px] bg-[#F8F3E8] p-3">
                <h3 className="text-base font-black">{agency.name}</h3>
                <p className="mt-1 text-xs font-bold text-[#746f69]">
                  {agency.city || "Cobertura configurable"} · {agency.modality === "exclusive" ? "exclusiva" : agency.modality === "mixed" ? "mixta" : "abierta"}
                </p>
                {connection && !isEnded ? (
                  <p className="mt-1 text-[11px] font-black text-[#2E3A79]">
                    Afiliacion {connection.is_exclusive ? "exclusiva" : "mixta"}
                  </p>
                ) : null}

                {!isReady ? (
                  <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs font-black leading-relaxed text-amber-800">
                    Falta configurar: {configIssues.join(", ") || "datos de la empresa"}.
                  </p>
                ) : null}

              {canSeeRates ? (
                <p className="mt-3 text-sm font-bold text-[#746f69]">{pricingLabel(agency)}</p>
              ) : (
                <p className="mt-3 rounded-2xl bg-[#F8F3E8] p-3 text-sm font-black leading-relaxed text-[#746f69]">
                  Esta empresa comparte sus tarifas luego de aprobar la afiliacion.
                </p>
              )}

              <details className="mt-3 rounded-2xl bg-white p-3">
                <summary className="cursor-pointer list-none text-xs font-black text-[#2E3A79]">
                  Ver detalle
                </summary>

                <div className="mt-3 grid gap-2 text-xs font-bold text-[#746f69] sm:grid-cols-2">
                  {agency.capacity_dimensions_cm ? (
                    <span className="rounded-2xl bg-white px-3 py-2">
                      Bolso {agency.capacity_dimensions_cm}
                    </span>
                  ) : null}
                  {agency.capacity_weight_kg ? (
                    <span className="rounded-2xl bg-white px-3 py-2">
                      Hasta {agency.capacity_weight_kg} kg
                    </span>
                  ) : null}
                  {agency.max_wait_time_minutes ? (
                    <span className="rounded-2xl bg-white px-3 py-2">
                      Espera max {agency.max_wait_time_minutes} min
                    </span>
                  ) : null}
                  <span className="rounded-2xl bg-white px-3 py-2">
                    {!canSeeRates
                      ? "Retorno efectivo: visible luego de aprobar"
                      : agency.charges_cash_return
                      ? `Retorno efectivo $${Number(agency.cash_return_fee_usd || 0).toFixed(2)}`
                      : "Sin cargo declarado por retorno"}
                  </span>
                  <span className="rounded-2xl bg-white px-3 py-2">
                    Cobra en {agency.billing_currency === "EUR" ? "EUR" : "USD"}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {canSeeRates && agency.payment_terms ? (
                    <p className="rounded-2xl bg-white p-3 text-xs font-bold leading-relaxed text-[#746f69]">
                      Pago: {agency.payment_terms}
                    </p>
                  ) : null}
                  {canSeeRates && agency.credit_terms ? (
                    <p className="rounded-2xl bg-white p-3 text-xs font-bold leading-relaxed text-[#746f69]">
                      Credito: {agency.credit_terms}
                    </p>
                  ) : null}
                  {agency.additional_conditions || agency.coverage_notes ? (
                    <p className="rounded-2xl bg-white p-3 text-xs font-bold leading-relaxed text-[#746f69]">
                      {agency.additional_conditions || agency.coverage_notes}
                    </p>
                  ) : null}
                </div>
              </details>

              <div className="mt-4">
                {connection && !isEnded ? (
                  <div className="space-y-2">
                    {isPendingExit ? (
                      <>
                        <div className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-black text-amber-800">
                          <Clock3 size={16} className="mr-1 inline" />
                          {connection.disengagement_effective_at
                            ? "Salida confirmada"
                            : connection.disengagement_requested_by === "agency"
                              ? "La empresa solicito desafiliacion. Confirma para ejecutar la salida."
                              : "Desafiliacion solicitada. Esperando confirmacion de la empresa delivery."}
                        </div>
                        {connection.disengagement_requested_by === "agency" ? (
                          <button
                            type="button"
                            onClick={() => requestDisengagement(connection)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-50 px-4 py-3 text-sm font-black text-amber-800"
                          >
                            <CheckCircle2 size={16} />
                            Confirmar salida
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <button
                        onClick={() => activateConnection(connection.id)}
                        className={[
                          "inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black",
                          connection.is_default
                            ? "bg-green-100 text-green-700"
                            : "bg-[#FFB547] text-[#25262B]",
                        ].join(" ")}
                      >
                        <CheckCircle2 size={16} />
                        {connection.is_default ? "Activa en checkout" : "Activar empresa"}
                      </button>
                    )}
                    {!isPendingExit ? (
                      <button
                        type="button"
                        onClick={() => requestDisengagement(connection)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-red-50 px-4 py-3 text-sm font-black text-red-700"
                      >
                        <XCircle size={16} />
                        Solicitar desafiliacion
                      </button>
                    ) : null}
                  </div>
                ) : connection && isEnded ? (
                  <div className="space-y-2">
                    <div className="rounded-2xl bg-[#F8F3E8] px-4 py-3 text-center text-sm font-black text-[#746f69]">
                      Afiliacion finalizada
                    </div>
                    <button
                      onClick={() => requestAgency(agency.id)}
                      disabled={wasJustRequested}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B]"
                    >
                      <Send size={16} />
                      {wasJustRequested ? "Solicitud enviada" : "Solicitar afiliacion de nuevo"}
                    </button>
                  </div>
                ) : request && !canResendRequest ? (
                  <div className="rounded-2xl bg-[#F8F3E8] px-4 py-3 text-center text-sm font-black text-[#746f69]">
                    Solicitud {request.status}
                  </div>
                ) : canResendRequest ? (
                  <div className="space-y-2">
                    <div className="rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-black text-red-700">
                      Solicitud {request.status}. Puedes enviarla nuevamente.
                    </div>
                    <button
                      onClick={() => requestAgency(agency.id)}
                      disabled={wasJustRequested}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
                    >
                      <Send size={16} />
                      {wasJustRequested ? "Solicitud enviada" : "Enviar solicitud de nuevo"}
                    </button>
                  </div>
                ) : !isReady ? (
                  <div className="rounded-2xl bg-amber-50 px-4 py-3 text-center text-sm font-black text-amber-800">
                    Esta empresa debe completar su configuracion antes de recibir solicitudes.
                  </div>
                ) : (
                  <button
                    onClick={() => requestAgency(agency.id)}
                    disabled={wasJustRequested}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
                  >
                    <Send size={16} />
                    {wasJustRequested ? "Solicitud enviada" : "Solicitar afiliacion"}
                  </button>
                )}
              </div>
              </div>
            </details>
          );
        })}
      </div>

      {!visibleAgencies.length && !isLoading ? (
        <div className="mt-4 rounded-2xl bg-white/10 p-4 text-sm font-black text-white/70">
          Aun no hay empresas delivery activas para este comercio.
        </div>
      ) : null}

      {data.billing ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white/70">
          <ShieldCheck size={16} />
          Semana actual: {data.billing.ordersCount} pedidos - ${Number(data.billing.totalUsd || 0).toFixed(2)}
        </p>
      ) : null}

      {message ? (
        <p className="mt-3 rounded-2xl bg-white p-3 text-sm font-black text-[#2E3A79]">
          {message}
        </p>
      ) : null}
    </section>
  );
}
