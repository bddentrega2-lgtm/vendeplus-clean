"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCcw,
  Search,
  XCircle,
} from "lucide-react";
import { businessTypeLabel } from "@/lib/business-types";
import { getWeeklyOrderVolume, WEEKLY_ORDER_VOLUME_OPTIONS } from "@/lib/commerce-registration";

type RegistrationRequest = {
  id: string;
  request_code: string;
  store_name: string;
  representative_name: string;
  representative_id_number: string;
  email: string;
  whatsapp: string;
  business_type: string;
  weekly_order_volume: string;
  status: string;
  activation_error: string | null;
  access_email_sent_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  store_id: string | null;
  logo_url: string | null;
  service_cities?: { name?: string; state_name?: string } | null;
};

type ApiResponse = {
  requests: RegistrationRequest[];
  summary: Record<string, number>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const statusOptions = [
  { value: "pending", label: "Pendientes" },
  { value: "approved", label: "Aprobadas" },
  { value: "activation_error", label: "Con error" },
  { value: "rejected", label: "Rechazadas" },
  { value: "all", label: "Todas" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(status: string) {
  if (status === "approved") return "Aprobada";
  if (status === "rejected") return "Rechazada";
  if (status === "activation_error") return "Revisar activación";
  if (status === "activating") return "Activando";
  return "Pendiente";
}

function statusStyle(status: string) {
  if (status === "approved") return "bg-emerald-100 text-emerald-800";
  if (status === "rejected") return "bg-red-100 text-red-800";
  if (status === "activation_error") return "bg-amber-100 text-amber-900";
  return "bg-[#F8F3E8] text-[#746f69]";
}

export function AdminRegistrationRequestsManager() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [status, setStatus] = useState("pending");
  const [volume, setVolume] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const loadRequests = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status, page: String(page) });
      if (volume) params.set("volume", volume);
      if (appliedSearch) params.set("search", appliedSearch);
      const response = await fetch(`/api/admin/registration-requests?${params}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudieron cargar las solicitudes.");
      if (currentRequest === requestId.current) setData(payload);
    } catch (loadError: any) {
      if (currentRequest === requestId.current) setError(loadError.message || "No se pudieron cargar las solicitudes.");
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, [status, volume, appliedSearch, page]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const summaryCards = useMemo(() => [
    { label: "Pendientes", value: data?.summary?.pending || 0 },
    { label: "Aprobadas", value: data?.summary?.approved || 0 },
    { label: "Con error", value: data?.summary?.activation_error || 0 },
    { label: "Rechazadas", value: data?.summary?.rejected || 0 },
  ], [data]);

  async function runAction(entry: RegistrationRequest, action: "approve" | "reject" | "resend_access") {
    const actionLabel = action === "approve" ? "aprobar" : action === "reject" ? "rechazar" : "reenviar el acceso de";
    if (!window.confirm(`¿Confirmas ${actionLabel} ${entry.store_name}?`)) return;

    setActiveId(entry.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/registration-requests", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo procesar la solicitud.");
      setMessage(payload.message || "Solicitud actualizada.");
      await loadRequests();
    } catch (actionError: any) {
      setError(actionError.message || "No se pudo procesar la solicitud.");
    } finally {
      setActiveId("");
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-lg bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
            <p className="text-xs font-black uppercase text-[#746f69]">{card.label}</p>
            <p className="mt-1 text-3xl font-black text-[#25262B]">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
        <div className="grid gap-3 lg:grid-cols-[180px_220px_1fr_auto]">
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-lg border border-[#25262B]/10 px-3 py-3 text-sm font-bold">
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={volume} onChange={(event) => { setVolume(event.target.value); setPage(1); }} className="rounded-lg border border-[#25262B]/10 px-3 py-3 text-sm font-bold">
            <option value="">Todos los potenciales</option>
            {WEEKLY_ORDER_VOLUME_OPTIONS.slice().sort((a, b) => b.score - a.score).map((option) => (
              <option key={option.value} value={option.value}>{option.potential}</option>
            ))}
          </select>
          <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { setAppliedSearch(search.trim()); setPage(1); } }} placeholder="Comercio, correo, WhatsApp o código" className="rounded-lg border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]" />
          <button type="button" onClick={() => { setAppliedSearch(search.trim()); setPage(1); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2E3A79] px-4 py-3 text-sm font-black text-white">
            <Search size={17} /> Buscar
          </button>
        </div>
      </section>

      {message ? <p className="rounded-lg bg-emerald-50 p-3 text-sm font-black text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-black text-red-700">{error}</p> : null}

      {isLoading ? (
        <div className="py-12 text-center"><Loader2 className="mx-auto animate-spin text-[#2E3A79]" /><p className="mt-2 text-sm font-bold text-[#746f69]">Cargando solicitudes...</p></div>
      ) : (
        <section className="grid gap-3">
          {(data?.requests || []).map((entry) => {
            const volumeInfo = getWeeklyOrderVolume(entry.weekly_order_volume);
            const isWorking = activeId === entry.id;
            return (
              <article key={entry.id} className="grid gap-4 rounded-lg bg-white p-4 ring-1 ring-[#25262B]/[0.06] lg:grid-cols-[96px_1fr_auto] lg:items-center">
                <div className="aspect-square overflow-hidden rounded-lg bg-[#F8F3E8]">
                  {entry.logo_url ? <img src={entry.logo_url} alt={`Logo de ${entry.store_name}`} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black">{entry.store_name}</h2>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${statusStyle(entry.status)}`}>{statusLabel(entry.status)}</span>
                    <span className="rounded-full bg-[#FFB547] px-2 py-1 text-[10px] font-black uppercase text-[#25262B]">{volumeInfo.potential}</span>
                  </div>
                  <p className="mt-1 text-xs font-black text-[#2E3A79]">{entry.request_code} · {formatDate(entry.created_at)}</p>
                  <p className="mt-2 text-sm font-bold text-[#746f69]">{entry.representative_name} · {entry.representative_id_number}</p>
                  <p className="text-sm font-bold text-[#746f69]">{entry.email} · {entry.whatsapp}</p>
                  <p className="text-sm font-bold text-[#746f69]">{businessTypeLabel(entry.business_type)} · {entry.service_cities?.name || "Ciudad"}, {entry.service_cities?.state_name || ""}</p>
                  <p className="mt-1 text-sm font-black text-[#25262B]">{volumeInfo.label} por semana</p>
                  {entry.activation_error ? <p className="mt-2 text-xs font-black text-amber-800">{entry.activation_error}</p> : null}
                  {entry.access_email_sent_at ? <p className="mt-2 text-xs font-bold text-emerald-700">Acceso enviado: {formatDate(entry.access_email_sent_at)}</p> : null}
                </div>
                <div className="grid min-w-[190px] gap-2">
                  <a href={`https://wa.me/${entry.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-black text-[#143D42]"><MessageCircle size={15} /> WhatsApp</a>
                  {["pending", "activation_error"].includes(entry.status) ? (
                    <>
                      <button type="button" disabled={isWorking} onClick={() => runAction(entry, "approve")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2E3A79] px-3 py-2 text-xs font-black text-white disabled:opacity-50">{isWorking ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Aprobar</button>
                      <button type="button" disabled={isWorking} onClick={() => runAction(entry, "reject")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50"><XCircle size={15} /> Rechazar</button>
                    </>
                  ) : null}
                  {entry.status === "approved" && (!entry.access_email_sent_at || entry.activation_error) ? (
                    <button type="button" disabled={isWorking} onClick={() => runAction(entry, "resend_access")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#FFB547] px-3 py-2 text-xs font-black text-[#25262B] disabled:opacity-50"><Mail size={15} /> Reenviar acceso</button>
                  ) : null}
                </div>
              </article>
            );
          })}
          {!data?.requests?.length ? <div className="rounded-lg bg-white py-12 text-center"><Clock3 className="mx-auto text-[#746f69]" /><p className="mt-2 text-sm font-bold text-[#746f69]">No hay solicitudes con estos filtros.</p></div> : null}
        </section>
      )}

      <div className="flex items-center justify-between gap-3">
        <button type="button" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#2E3A79] ring-1 ring-[#25262B]/10 disabled:opacity-40" title="Página anterior"><ChevronLeft size={18} /></button>
        <p className="text-sm font-black text-[#746f69]">Página {data?.pagination?.page || page} de {data?.pagination?.totalPages || 1} · {data?.pagination?.total || 0} solicitudes</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => loadRequests()} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#2E3A79] ring-1 ring-[#25262B]/10" title="Actualizar"><RefreshCcw size={17} /></button>
          <button type="button" disabled={page >= (data?.pagination?.totalPages || 1) || isLoading} onClick={() => setPage((current) => current + 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#2E3A79] ring-1 ring-[#25262B]/10 disabled:opacity-40" title="Página siguiente"><ChevronRight size={18} /></button>
        </div>
      </div>
    </div>
  );
}
