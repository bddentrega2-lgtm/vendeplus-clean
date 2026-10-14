"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCcw,
  Search,
  X,
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
  setup_due_usd: number;
  setup_discount_percent: number;
  setup_payment_status: string;
  setup_payment_reference: string | null;
  setup_paid_usd: number | null;
  setup_payment_confirmed_at: string | null;
  setup_payment_proof_url: string | null;
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
  { value: "payment_pending", label: "Pagos pendientes" },
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
  const [accessDialog, setAccessDialog] = useState<{ entry: RegistrationRequest; action: "approve" | "set_password" } | null>(null);
  const [accessMethod, setAccessMethod] = useState<"email" | "password">("email");
  const [accessPassword, setAccessPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  function openAccessDialog(entry: RegistrationRequest, action: "approve" | "set_password") {
    setAccessDialog({ entry, action });
    setAccessMethod(action === "approve" ? "email" : "password");
    setAccessPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setError("");
  }

  function closeAccessDialog() {
    setAccessDialog(null);
    setAccessPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  }

  async function submitAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessDialog) return;
    const manual = accessDialog.action === "set_password" || accessMethod === "password";
    if (manual && (accessPassword.length < 8 || accessPassword.length > 72 || accessPassword.trim().length < 8)) {
      setError("La clave debe tener entre 8 y 72 caracteres, sin espacios de relleno.");
      return;
    }
    if (manual && accessPassword !== confirmPassword) {
      setError("Las claves no coinciden.");
      return;
    }
    const succeeded = await runAction(accessDialog.entry, accessDialog.action, {
      accessMethod: accessDialog.action === "approve" ? accessMethod : undefined,
      password: manual ? accessPassword : undefined,
    });
    if (succeeded) closeAccessDialog();
  }

  async function runAction(entry: RegistrationRequest, action: "approve" | "reject" | "resend_access" | "set_password" | "report_payment" | "confirm_payment" | "waive_payment", access?: { accessMethod?: "email" | "password"; password?: string }) {
    const actionLabel = action === "approve" ? "aprobar" : action === "reject" ? "rechazar" : action === "confirm_payment" ? "confirmar el pago de" : action === "waive_payment" ? "exonerar" : action === "report_payment" ? "reportar el pago de" : "reenviar el acceso de";
    if (action !== "approve" && action !== "set_password" && !window.confirm(`¿Confirmas ${actionLabel} ${entry.store_name}?`)) return false;
    if (action === "approve" && !["confirmed", "waived", "legacy"].includes(entry.setup_payment_status) && Number(entry.setup_due_usd) > 0 && !window.confirm(`El pago inicial de US$${Number(entry.setup_due_usd).toFixed(2)} sigue pendiente. ¿Habilitar el comercio sin registrar un cobro?`)) return false;
    if (action === "reject" && entry.setup_payment_status === "confirmed" && !window.confirm("Este comercio ya tiene un pago confirmado. Si rechazas la solicitud, deberas conciliar la devolucion por separado. ¿Continuar?")) return false;
    let reference = "";
    let paidUsd: number | undefined;
    if (action === "report_payment" || action === "confirm_payment") {
      const input = window.prompt("Referencia del pago:", entry.setup_payment_reference || "");
      if (input === null) return false;
      reference = input.trim();
      if (!reference) { setError("Indica la referencia del pago."); return false; }
    }
    if (action === "confirm_payment") {
      const input = window.prompt("Importe verificado en USD:", Number(entry.setup_due_usd).toFixed(2));
      if (input === null) return false;
      paidUsd = Number(input);
      if (!Number.isFinite(paidUsd) || paidUsd !== Number(entry.setup_due_usd)) { setError("El importe debe coincidir con el total inicial."); return false; }
    }

    setActiveId(entry.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/registration-requests", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, action, reference, paidUsd, ...access }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo procesar la solicitud.");
      setMessage(payload.message || "Solicitud actualizada.");
      await loadRequests();
      return true;
    } catch (actionError: any) {
      setError(actionError.message || "No se pudo procesar la solicitud.");
      return false;
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
                  <p className="mt-2 text-sm font-black text-[#2E3A79]">{entry.setup_payment_status === "legacy" ? "Registro anterior al cobro inicial" : `Configuracion: US$${Number(entry.setup_due_usd).toFixed(2)} ${Number(entry.setup_discount_percent) ? `(${entry.setup_discount_percent}% de descuento)` : ""} · ${entry.setup_payment_status === "confirmed" ? "Pago confirmado" : entry.setup_payment_status === "waived" ? "Exonerado" : entry.setup_payment_status === "reported" ? "Pago reportado, sin confirmar" : "Pago pendiente"}`}</p>
                  {entry.setup_payment_reference ? <p className="text-xs font-bold text-[#746f69]">Referencia: {entry.setup_payment_reference}</p> : null}
                  {entry.setup_payment_status === "confirmed" ? <p className="text-xs font-bold text-emerald-700">Ingreso registrado: US${Number(entry.setup_paid_usd).toFixed(2)} · {formatDate(entry.setup_payment_confirmed_at)}</p> : null}
                  {entry.setup_payment_proof_url ? <a href={entry.setup_payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-[#007A69] underline">Ver comprobante</a> : null}
                  {entry.activation_error ? <p className="mt-2 text-xs font-black text-amber-800">{entry.activation_error}</p> : null}
                  {entry.access_email_sent_at ? <p className="mt-2 text-xs font-bold text-emerald-700">Acceso enviado: {formatDate(entry.access_email_sent_at)}</p> : null}
                </div>
                <div className="grid min-w-[190px] gap-2">
                  <a href={`https://wa.me/${entry.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-black text-[#143D42]"><MessageCircle size={15} /> WhatsApp</a>
                  {["pending", "activation_error", "approved"].includes(entry.status) && !["confirmed", "waived", "legacy"].includes(entry.setup_payment_status) ? (
                    Number(entry.setup_due_usd) > 0
                      ? <button type="button" disabled={isWorking} onClick={() => runAction(entry, "confirm_payment")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800 disabled:opacity-50"><Banknote size={15} /> Aprobar pago</button>
                      : <button type="button" disabled={isWorking} onClick={() => runAction(entry, "waive_payment")} className="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800 disabled:opacity-50">Aprobar exoneracion</button>
                  ) : null}
                  {["pending", "activation_error"].includes(entry.status) ? (
                    <>
                      <button type="button" disabled={isWorking} onClick={() => openAccessDialog(entry, "approve")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2E3A79] px-3 py-2 text-xs font-black text-white disabled:opacity-50">{isWorking ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Aprobar comercio</button>
                      <button type="button" disabled={isWorking} onClick={() => runAction(entry, "reject")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50"><XCircle size={15} /> Rechazar</button>
                    </>
                  ) : null}
                  {entry.status === "approved" ? (
                    <>
                      <button type="button" disabled={isWorking} onClick={() => runAction(entry, "resend_access")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#FFB547] px-3 py-2 text-xs font-black text-[#25262B] disabled:opacity-50"><Mail size={15} /> Reenviar correo</button>
                      <button type="button" disabled={isWorking} onClick={() => openAccessDialog(entry, "set_password")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F8F3E8] px-3 py-2 text-xs font-black text-[#2E3A79] disabled:opacity-50"><KeyRound size={15} /> Definir clave</button>
                    </>
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

      {accessDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#25262B]/60 p-4">
          <form role="dialog" aria-modal="true" aria-labelledby="access-dialog-title" onSubmit={submitAccess} className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="access-dialog-title" className="text-lg font-black text-[#25262B]">{accessDialog.action === "approve" ? "Aprobar comercio" : "Definir clave"}</h2>
                <p className="mt-1 break-all text-sm font-bold text-[#746f69]">{accessDialog.entry.store_name} · {accessDialog.entry.email}</p>
              </div>
              <button type="button" onClick={closeAccessDialog} disabled={activeId === accessDialog.entry.id} title="Cerrar" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#746f69] hover:bg-[#F8F3E8] disabled:opacity-50"><X size={19} /></button>
            </div>

            {accessDialog.action === "approve" ? (
              <div className="mt-5 grid grid-cols-2 gap-2" role="group" aria-label="Forma de entregar el acceso">
                <button type="button" onClick={() => { setAccessMethod("email"); setError(""); }} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-black ${accessMethod === "email" ? "bg-[#2E3A79] text-white" : "bg-[#F8F3E8] text-[#2E3A79]"}`}><Mail size={16} /> Enviar correo</button>
                <button type="button" onClick={() => { setAccessMethod("password"); setError(""); }} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-black ${accessMethod === "password" ? "bg-[#2E3A79] text-white" : "bg-[#F8F3E8] text-[#2E3A79]"}`}><KeyRound size={16} /> Definir clave</button>
              </div>
            ) : null}

            {accessDialog.action === "set_password" || accessMethod === "password" ? (
              <div className="mt-5 space-y-3">
                <div>
                  <label htmlFor="registration-access-password" className="text-xs font-black text-[#25262B]">Clave nueva</label>
                  <div className="mt-1 flex rounded-lg border border-[#25262B]/15 focus-within:border-[#2E3A79]">
                    <input id="registration-access-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={72} required value={accessPassword} onChange={(event) => setAccessPassword(event.target.value)} className="min-w-0 flex-1 rounded-lg px-3 py-3 text-sm outline-none" />
                    <button type="button" onClick={() => setShowPassword((current) => !current)} title={showPassword ? "Ocultar clave" : "Mostrar clave"} className="grid w-11 shrink-0 place-items-center text-[#2E3A79]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                  </div>
                </div>
                <div>
                  <label htmlFor="registration-access-confirm" className="text-xs font-black text-[#25262B]">Confirmar clave</label>
                  <input id="registration-access-confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={72} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-[#25262B]/15 px-3 py-3 text-sm outline-none focus:border-[#2E3A79]" />
                </div>
                <p className="text-xs font-bold text-[#746f69]">{accessDialog.action === "set_password" ? "Solo para cuentas que aun no han iniciado sesion y no comparten acceso con otros comercios. " : ""}No se enviara correo. Comparte la clave de forma privada y pide al comercio que la cambie al entrar.</p>
              </div>
            ) : <p className="mt-5 text-sm text-[#746f69]">El comercio recibira un enlace para crear su propia clave.</p>}

            {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeAccessDialog} disabled={activeId === accessDialog.entry.id} className="rounded-lg px-4 py-3 text-sm font-black text-[#746f69] disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={activeId === accessDialog.entry.id} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2E3A79] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{activeId === accessDialog.entry.id ? <Loader2 size={16} className="animate-spin" /> : accessDialog.action === "approve" ? <CheckCircle2 size={16} /> : <KeyRound size={16} />}{accessDialog.action === "set_password" ? "Guardar clave" : accessMethod === "email" ? "Aprobar y enviar correo" : "Aprobar con clave"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
