"use client";

import { FormEvent, useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Copy, MessageCircle, Plus, RefreshCcw, Search, X } from "lucide-react";
import { affiliateWelcomeMessage } from "@/lib/affiliates";

type Code = { id: string; code: string; name: string; contact: string | null; status: string; partner_type: string; beneficiary_email: string | null; transport_agency_id: string | null; discount_percent: number; setup_commission_percent: number; commission_percent: number; duration_months: number; used_count: number; max_uses: number | null };
type Referral = { id: string; affiliate_code_id: string; store_id: string | null; fee_started_at: string | null; fee_ends_at: string | null; commerce_registration_requests: { store_name: string; request_code: string; status: string; setup_payment_status: string } | null };
type Commission = { id: string; referral_id: string; kind: "setup" | "fee"; fee_usd: number | null; setup_paid_usd: number | null; commission_percent: number; amount_usd: number; eligible_at: string; status: string; codeId?: string; codeName?: string; allyName?: string; storeName?: string; netAmountUsd?: number };
type Settlement = { id: string; affiliate_code_id: string; amount_usd: number; paid_at: string; method: string; reference: string };
type Adjustment = { id: string; commission_id: string; amount_usd: number; reason: string; created_at: string };
type PayoutAccount = { beneficiary_email: string | null; transport_agency_id: string | null; holder_name: string; bank_name: string; document_number: string; phone: string };
type Balance = { allyKey: string; displayName: string; beneficiaryEmail: string | null; transportAgencyId: string | null; codes: string[]; partnerTypes: string[]; commerceCount: number; setupPendingCount: number; setupPaidCount: number; feePendingCount: number; feePaidCount: number; setupPendingUsd: number; feePendingUsd: number; setupPaidUsd: number; feePaidUsd: number; demo?: boolean };
type Data = { codes: Code[]; referrals: Referral[]; commissions: Commission[]; settlements: Settlement[]; adjustments: Adjustment[]; agencies: Array<{ id: string; name: string }>; balances: Balance[]; payoutAccounts: PayoutAccount[] };
type CommissionPage = { allyKey: string; commissions: Commission[]; payoutAccount: PayoutAccount | null; pagination: { page: number; pageSize: number; total: number; totalPages: number } };

const field = "w-full rounded-md border border-[#25262B]/20 bg-white px-3 py-2 text-sm";
const money = (value: number) => `US$${Number(value).toFixed(2)}`;
const date = (value: string | null) => value ? new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Caracas" }).format(new Date(value)) : "Pendiente";
const category = (types: string[]) => types.map((type) => type === "delivery" ? "Delivery" : type === "creator" ? "Creador" : "Vendedor").join(" / ");

function BalancePair({ pendingCount, pendingUsd, paidCount, paidUsd, unit }: { pendingCount: number; pendingUsd: number; paidCount: number; paidUsd: number; unit: "suscripciones" | "pedidos" }) {
  return <div className="space-y-1 text-xs leading-5">
    <p><span className="text-[#586269]">Por pagar:</span> <strong className="tabular-nums">{pendingCount} {unit} · {money(pendingUsd)}</strong></p>
    <p><span className="text-[#586269]">{unit === "suscripciones" ? "Pagadas" : "Pagados"}:</span> <strong className="tabular-nums text-[#007A69]">{paidCount} {unit} · {money(paidUsd)}</strong></p>
  </div>;
}

export function AdminAffiliatesManager() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [commissionPage, setCommissionPage] = useState(1);
  const [commissionData, setCommissionData] = useState<CommissionPage | null>(null);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionError, setCommissionError] = useState("");
  const [revision, setRevision] = useState(0);
  const [showNewCode, setShowNewCode] = useState(false);
  const [welcome, setWelcome] = useState("");
  const [draft, setDraft] = useState({ code: "", name: "", contact: "", partnerType: "seller", beneficiaryEmail: "", transportAgencyId: "", discountPercent: "0", setupCommissionPercent: "0", commissionPercent: "0", durationMonths: "3", maxUses: "", startsAt: "", expiresAt: "" });
  const [settlement, setSettlement] = useState({ paidAt: new Date().toISOString().slice(0, 10), method: "", reference: "" });

  async function load() {
    setError("");
    try {
      const response = await fetch("/api/admin/affiliates", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo cargar.");
      setData(json);
      setSelected([]); setCommissionPage(1); setRevision((value) => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar."); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!expandedKey) return;
    const controller = new AbortController();
    setCommissionLoading(true); setCommissionError("");
    fetch(`/api/admin/affiliates/commissions?allyKey=${encodeURIComponent(expandedKey)}&page=${commissionPage}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "No se pudieron cargar las comisiones.");
        setCommissionData(json);
      })
      .catch((reason) => { if (!controller.signal.aborted) setCommissionError(reason instanceof Error ? reason.message : "No se pudieron cargar las comisiones."); })
      .finally(() => { if (!controller.signal.aborted) setCommissionLoading(false); });
    return () => controller.abort();
  }, [expandedKey, commissionPage, revision]);
  async function post(path: string, method: string, body: object) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo guardar.");
      if (path === "/api/admin/affiliates" && method === "POST" && json.code) {
        setWelcome(affiliateWelcomeMessage(window.location.origin, json.code));
        setShowNewCode(false);
      }
      setMessage(json.message || "Guardado correctamente."); setSelected([]); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }
  function create(event: FormEvent) { event.preventDefault(); void post("/api/admin/affiliates", "POST", { ...draft, startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : "", expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : "" }); }
  async function copyText(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage("Copiado."); }
    catch { setError("No se pudo copiar. Puedes seleccionar y copiar el texto del mensaje."); }
  }
  const netAmount = (item: Commission) => item.netAmountUsd ?? Number(item.amount_usd) + (data?.adjustments || []).filter((adjustment) => adjustment.commission_id === item.id).reduce((sum, adjustment) => sum + Number(adjustment.amount_usd), 0);
  const pageData = commissionData?.allyKey === expandedKey && commissionData.pagination.page === commissionPage ? commissionData : null;
  const selectedTotal = pageData?.commissions.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + netAmount(item), 0) || 0;
  const selectedCommission = pageData?.commissions.find((item) => item.id === selected[0]);
  const payoutFor = (code: Code | undefined) => data?.payoutAccounts.find((account) => code?.partner_type === "delivery" ? account.transport_agency_id === code.transport_agency_id : account.beneficiary_email === code?.beneficiary_email);
  const codeFor = (item: Commission) => data?.codes.find((code) => code.id === data.referrals.find((referral) => referral.id === item.referral_id)?.affiliate_code_id);
  const visibleBalances = (data?.balances || []).filter((ally) => `${ally.displayName} ${ally.beneficiaryEmail || ""} ${ally.codes.join(" ")} ${category(ally.partnerTypes)}`.toLocaleLowerCase("es-VE").includes(search.trim().toLocaleLowerCase("es-VE")))
    .sort((a, b) => Number(Boolean(a.demo)) - Number(Boolean(b.demo)) || (Number(b.setupPendingUsd) + Number(b.feePendingUsd)) - (Number(a.setupPendingUsd) + Number(a.feePendingUsd)));
  const expanded = data?.balances.find((ally) => ally.allyKey === expandedKey);
  const allyCodes = data?.codes.filter((code) => expanded?.codes.includes(code.code)) || [];
  const codeIds = new Set(allyCodes.map((code) => code.id));
  const allyReferrals = data?.referrals.filter((referral) => codeIds.has(referral.affiliate_code_id)) || [];
  const referralIds = new Set(allyReferrals.map((referral) => referral.id));
  const allyCommissions = data?.commissions.filter((item) => referralIds.has(item.referral_id)) || [];
  const available = pageData?.commissions.filter((item) => netAmount(item) > 0) || [];
  const commissionIds = new Set(allyCommissions.map((item) => item.id));

  function selectCommission(item: Commission, checked: boolean) {
    if (!checked) { setSelected((current) => current.filter((id) => id !== item.id)); return; }
    if (selectedCommission && selectedCommission.codeId !== item.codeId) {
      setError("Liquida por separado las comisiones de cada codigo."); return;
    }
    setError(""); setSelected((current) => [...current, item.id]);
  }
  function refund(item: Commission) {
    const amount = window.prompt(`${item.kind === "setup" ? "Suscripcion" : "Fee"} reintegrado (maximo ${money(Number(item.kind === "setup" ? item.setup_paid_usd : item.fee_usd))}):`);
    if (amount === null) return;
    const reference = window.prompt("Referencia unica del reintegro:");
    if (reference === null) return;
    void post("/api/admin/affiliates/adjustments", "POST", { commissionId: item.id, refundUsd: Number(amount), reference: reference.trim() });
  }

  return <div className="space-y-5">
    {error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    {message ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
    {welcome ? <section aria-label="Bienvenida del aliado" className="border-y border-[#007A69]/20 bg-[#F4F7F5] p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-bold">Mensaje de bienvenida</h3><button type="button" title="Cerrar bienvenida" aria-label="Cerrar bienvenida" onClick={() => setWelcome("")} className="p-2"><X size={18} /></button></div>
      <textarea aria-label="Mensaje para el aliado" readOnly value={welcome} rows={12} className={`${field} resize-y`} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void copyText(welcome)} className="inline-flex items-center gap-2 rounded-md bg-[#007A69] px-3 py-2 text-sm font-bold text-white"><Copy size={16} /> Copiar mensaje</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(welcome)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border border-[#007A69]/30 px-3 py-2 text-sm font-bold text-[#007A69]"><MessageCircle size={16} /> Compartir por WhatsApp</a>
      </div>
    </section> : null}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-black">Aliados referidores</h2><p className="text-xs text-[#586269]">Comisiones sobre suscripciones y fees ya cobrados por SOMOS. Por pagar significa pendiente de liquidar al aliado.</p></div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <label className="relative min-w-0 flex-1 sm:w-56"><span className="sr-only">Buscar aliado</span><Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#586269]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar aliado" className={`${field} pl-9`} /></label>
        <button type="button" onClick={() => void load()} title="Actualizar" aria-label="Actualizar aliados" className="rounded-md border p-2"><RefreshCcw size={17} /></button>
        <button type="button" onClick={() => setShowNewCode((value) => !value)} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#007A69] px-3 py-2 text-sm font-bold text-white"><Plus size={16} /> Nuevo aliado</button>
      </div>
    </div>
    {showNewCode ? <section aria-label="Nuevo aliado" className="border-y border-[#25262B]/15 py-4">
      <h3 className="mb-3 text-sm font-black">Crear codigo de aliado</h3>
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold">Codigo<input required value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} className={field} /></label>
        <label className="text-xs font-bold">Nombre<input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Contacto<input value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Categoria<select value={draft.partnerType} onChange={(e) => setDraft({ ...draft, partnerType: e.target.value })} className={field}><option value="seller">Vendedor</option><option value="creator">Creador</option><option value="delivery">Delivery</option></select></label>
        {draft.partnerType === "delivery" ? <label className="text-xs font-bold">Empresa<select required value={draft.transportAgencyId} onChange={(e) => setDraft({ ...draft, transportAgencyId: e.target.value })} className={field}><option value="">Selecciona una empresa</option>{data?.agencies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <label className="text-xs font-bold">Correo Google del aliado<input required={Number(draft.setupCommissionPercent) > 0 || Number(draft.commissionPercent) > 0} type="email" value={draft.beneficiaryEmail} onChange={(e) => setDraft({ ...draft, beneficiaryEmail: e.target.value })} className={field} /></label>}
        <label className="text-xs font-bold">Descuento %<input required type="number" min="0" max="100" step="0.01" value={draft.discountPercent} onChange={(e) => setDraft({ ...draft, discountPercent: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Comision por suscripcion %<input required type="number" min="0" max="100" step="0.01" value={draft.setupCommissionPercent} onChange={(e) => setDraft({ ...draft, setupCommissionPercent: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Comision del fee %<input required type="number" min="0" max="100" step="0.01" value={draft.commissionPercent} onChange={(e) => setDraft({ ...draft, commissionPercent: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Meses<select value={draft.durationMonths} onChange={(e) => setDraft({ ...draft, durationMonths: e.target.value })} className={field}><option value="1">1 mes</option><option value="2">2 meses</option><option value="3">3 meses</option></select></label>
        <label className="text-xs font-bold">Usos maximos<input type="number" min="1" value={draft.maxUses} onChange={(e) => setDraft({ ...draft, maxUses: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Vigente desde<input type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Vence<input type="datetime-local" value={draft.expiresAt} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} className={field} /></label>
        <button disabled={busy} className="self-end rounded-md bg-[#007A69] px-4 py-2 text-sm font-black text-white disabled:opacity-50">Crear codigo</button>
      </form>
    </section> : null}
    <section aria-label="Lista de aliados">
      <div className="hidden grid-cols-[minmax(165px,1.3fr)_70px_minmax(160px,1fr)_minmax(160px,1fr)_minmax(145px,0.9fr)_28px] gap-3 border-y border-[#25262B]/15 bg-[#F4F7F5] px-3 py-2 text-xs font-bold text-[#45535A] xl:grid">
        <span>Aliado y categoria</span><span>Comercios</span><span>Suscripciones</span><span>Pedidos con fee cobrado</span><span>Total al aliado</span><span />
      </div>
      {!data ? <p className="py-5 text-sm text-[#586269]">Cargando aliados...</p> : !visibleBalances.length ? <p className="border-y border-[#25262B]/10 py-5 text-sm text-[#586269]">{search ? "No hay aliados con esa busqueda." : "Todavia no hay aliados configurados."}</p> : null}
      <div className="divide-y divide-[#25262B]/15 border-b border-[#25262B]/15">{visibleBalances.map((ally) => {
        const pending = Number(ally.setupPendingUsd) + Number(ally.feePendingUsd);
        const paid = Number(ally.setupPaidUsd) + Number(ally.feePaidUsd);
        const open = expandedKey === ally.allyKey;
        return <div key={ally.allyKey} className={open ? "bg-[#F7FAF8]" : ""}>
          <button type="button" aria-expanded={open} onClick={() => { setExpandedKey(open ? null : ally.allyKey); setCommissionPage(1); setSelected([]); }} className="grid w-full gap-3 px-3 py-4 text-left hover:bg-[#F4F7F5] sm:grid-cols-[minmax(150px,1.2fr)_90px_minmax(150px,1fr)_minmax(150px,1fr)] xl:grid-cols-[minmax(165px,1.3fr)_70px_minmax(160px,1fr)_minmax(160px,1fr)_minmax(145px,0.9fr)_28px] xl:items-center">
            <span className="min-w-0"><strong className="block break-words text-sm">{ally.displayName}</strong><span className="text-xs font-semibold text-[#007A69]">{category(ally.partnerTypes)}</span>{ally.demo ? <span className="ml-2 text-xs font-bold text-[#A36316]">Demo · no liquidable</span> : null}<span className="block break-all text-[11px] text-[#586269]">{ally.beneficiaryEmail || ally.codes.join(", ")}</span></span>
            <span className="text-sm"><span className="text-xs text-[#586269] sm:hidden">Comercios afiliados: </span><strong className="tabular-nums">{ally.commerceCount}</strong></span>
            <span><span className="mb-1 block text-xs font-bold sm:hidden">Suscripciones</span><BalancePair pendingCount={ally.setupPendingCount} pendingUsd={ally.setupPendingUsd} paidCount={ally.setupPaidCount} paidUsd={ally.setupPaidUsd} unit="suscripciones" /></span>
            <span><span className="mb-1 block text-xs font-bold sm:hidden">Pedidos con fee cobrado</span><BalancePair pendingCount={ally.feePendingCount} pendingUsd={ally.feePendingUsd} paidCount={ally.feePaidCount} paidUsd={ally.feePaidUsd} unit="pedidos" /></span>
            <span className="border-t border-[#25262B]/10 pt-2 text-xs sm:col-span-4 xl:col-span-1 xl:border-l xl:border-t-0 xl:pl-3 xl:pt-0"><span className="mb-1 block font-bold xl:hidden">Total al aliado</span><span className="block">Por pagar <strong className="tabular-nums">{money(pending)}</strong></span><span className="block">Ya pagado <strong className="tabular-nums text-[#007A69]">{money(paid)}</strong></span></span>
            <ChevronDown size={18} aria-hidden="true" className={`hidden transition-transform xl:block ${open ? "rotate-180" : ""}`} />
          </button>
          {open ? <div className="space-y-5 border-t border-[#25262B]/10 px-3 pb-5 pt-4 text-sm">
            <section><h3 className="mb-2 font-bold">Codigos y pago movil</h3><div className="divide-y divide-[#25262B]/10">{allyCodes.map((code) => <div key={code.id} className="grid gap-2 py-2 md:grid-cols-[1fr_auto_auto] md:items-start">
              <div><strong>{code.code}</strong><p className="text-xs text-[#586269]">{code.discount_percent}% descuento · {code.setup_commission_percent}% suscripcion · {code.commission_percent}% fee · {code.duration_months} meses · {code.used_count}{code.max_uses ? `/${code.max_uses}` : ""} usos</p><p className="mt-1 text-xs">{payoutFor(code) ? `Pago Movil: ${payoutFor(code)?.bank_name} · ${payoutFor(code)?.holder_name} · ${payoutFor(code)?.document_number} · ${payoutFor(code)?.phone}` : "Sin datos de Pago Movil registrados"}</p></div>
              <div className="flex gap-1">
                <button type="button" title="Copiar enlace" aria-label={`Copiar enlace ${code.code}`} onClick={() => void copyText(`${window.location.origin}/registro?ref=${encodeURIComponent(code.code)}`)} className="p-2"><Copy size={16} /></button>
                <button type="button" title="Mensaje de bienvenida" aria-label={`Mensaje de bienvenida ${code.code}`} onClick={() => { setWelcome(affiliateWelcomeMessage(window.location.origin, code)); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="p-2"><MessageCircle size={16} /></button>
              </div>
              <select aria-label={`Estado de ${code.code}`} value={code.status} disabled={busy} onChange={(e) => void post("/api/admin/affiliates", "PATCH", { id: code.id, status: e.target.value })} className={field}><option value="active">Activo</option><option value="paused">Pausado</option><option value="disabled">Desactivado</option></select>
              <CodeTermsEditor code={code} busy={busy} save={(values) => void post("/api/admin/affiliates", "PATCH", { id: code.id, ...values })} />
            </div>)}</div></section>
            <section><h3 className="mb-2 font-bold">Comercios afiliados</h3>{allyReferrals.filter((referral) => referral.store_id).length ? <div className="divide-y divide-[#25262B]/10">{allyReferrals.filter((referral) => referral.store_id).map((referral) => <p key={referral.id} className="py-2">{referral.commerce_registration_requests?.store_name || referral.store_id} <span className="text-xs text-[#586269]">· Fee desde {date(referral.fee_started_at)}</span></p>)}</div> : <p className="text-xs text-[#586269]">Aun no hay comercios aprobados.</p>}</section>
            <section><h3 className="mb-2 font-bold">Pendiente de pago al aliado</h3>{ally.demo ? <p className="text-xs text-[#A36316]">Datos de demostracion: no se pueden liquidar.</p> : <>
              {commissionLoading ? <p className="py-3 text-xs text-[#586269]">Cargando comisiones...</p> : commissionError ? <p role="alert" className="py-3 text-xs text-red-700">{commissionError}</p> : available.length ? <div className="divide-y divide-[#25262B]/10">{available.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 py-2"><label className="flex min-w-0 flex-1 items-start gap-2"><input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => selectCommission(item, e.target.checked)} /><span>{date(item.eligible_at)} · {item.storeName} · {item.kind === "setup" ? "Suscripcion" : "Pedido con fee cobrado"} · {item.codeName || codeFor(item)?.code} · <strong>{money(netAmount(item))}</strong></span></label><button type="button" disabled={busy} onClick={() => refund(item)} className="text-xs font-bold text-red-700">Registrar reintegro</button></div>)}</div> : <p className="text-xs text-[#586269]">No hay comisiones pendientes.</p>}
              {pageData && pageData.pagination.totalPages > 1 ? <div className="mt-3 flex items-center justify-end gap-3 text-xs">
                <span>Pagina {pageData.pagination.page} de {pageData.pagination.totalPages} · {pageData.pagination.total} comisiones</span>
                <button type="button" aria-label="Pagina anterior de comisiones" title="Pagina anterior" disabled={commissionLoading || busy || commissionPage === 1} onClick={() => { setSelected([]); setCommissionPage((page) => page - 1); }} className="rounded-md border p-2 disabled:opacity-40"><ChevronLeft size={16} /></button>
                <button type="button" aria-label="Pagina siguiente de comisiones" title="Pagina siguiente" disabled={commissionLoading || busy || commissionPage >= pageData.pagination.totalPages} onClick={() => { setSelected([]); setCommissionPage((page) => page + 1); }} className="rounded-md border p-2 disabled:opacity-40"><ChevronRight size={16} /></button>
              </div> : null}
              {selectedCommission ? <p className="mt-3 bg-[#E6F4F0] p-3 text-sm">Pago a {selectedCommission.allyName}: {pageData?.payoutAccount ? `${pageData.payoutAccount.bank_name} · ${pageData.payoutAccount.holder_name} · ${pageData.payoutAccount.document_number} · ${pageData.payoutAccount.phone}` : "El aliado no ha registrado Pago Movil. Coordina otro medio antes de marcar como pagado."}</p> : null}
              <form onSubmit={(e) => { e.preventDefault(); if (window.confirm(`Registrar liquidacion por ${money(selectedTotal)}?`)) void post("/api/admin/affiliates/settlements", "POST", { commissionIds: selected, ...settlement }); }} className="mt-3 grid gap-3 sm:grid-cols-4">
                <label className="text-xs font-bold">Fecha de pago<input required type="date" value={settlement.paidAt} onChange={(e) => setSettlement({ ...settlement, paidAt: e.target.value })} className={field} /></label>
                <label className="text-xs font-bold">Metodo<input required value={settlement.method} onChange={(e) => setSettlement({ ...settlement, method: e.target.value })} className={field} /></label>
                <label className="text-xs font-bold">Referencia<input required value={settlement.reference} onChange={(e) => setSettlement({ ...settlement, reference: e.target.value })} className={field} /></label>
                <button disabled={busy || commissionLoading || Boolean(commissionError) || !selected.length} className="self-end rounded-md bg-[#007A69] px-4 py-2 text-sm font-black text-white disabled:opacity-50">Liquidar {money(selectedTotal)}</button>
              </form>
            </>}</section>
            <details><summary className="cursor-pointer font-bold">Historial y ajustes</summary><div className="mt-2 space-y-3 text-xs">
              <div><strong>Comisiones anteriores</strong>{allyCommissions.filter((item) => item.status !== "available").map((item) => <p key={item.id} className="py-1">{date(item.eligible_at)} · {item.kind === "setup" ? "Suscripcion" : "Fee"} · {money(item.amount_usd)} · {item.status === "paid" ? "Pagada" : "Ajustada"}</p>)}</div>
              <div><strong>Liquidaciones</strong>{data?.settlements.filter((item) => codeIds.has(item.affiliate_code_id)).map((item) => <p key={item.id} className="py-1">{date(item.paid_at)} · {money(item.amount_usd)} · {item.method} · {item.reference}</p>)}</div>
              <div><strong>Reintegros</strong>{data?.adjustments.filter((item) => commissionIds.has(item.commission_id)).map((item) => <p key={item.id} className="py-1">{date(item.created_at)} · {money(item.amount_usd)} · {item.reason}</p>)}</div>
            </div></details>
          </div> : null}
        </div>;
      })}</div>
    </section>
  </div>;
}

function CodeTermsEditor({ code, busy, save }: { code: Code; busy: boolean; save: (values: { discountPercent: number; setupCommissionPercent: number; commissionPercent: number; durationMonths: number }) => void }) {
  const [discount, setDiscount] = useState(String(code.discount_percent));
  const [setupCommission, setSetupCommission] = useState(String(code.setup_commission_percent));
  const [commission, setCommission] = useState(String(code.commission_percent));
  const [months, setMonths] = useState(String(code.duration_months));
  return <details className="md:col-span-3"><summary className="cursor-pointer text-xs font-bold text-[#007A69]">Condiciones para nuevas solicitudes</summary>
    <div className="mt-2 grid gap-2 sm:grid-cols-4">
      <label className="text-xs font-bold">Descuento %<input type="number" min="0" max="100" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className={field} /></label>
      <label className="text-xs font-bold">Suscripcion %<input type="number" min="0" max="100" step="0.01" value={setupCommission} onChange={(e) => setSetupCommission(e.target.value)} className={field} /></label>
      <label className="text-xs font-bold">Fee %<input type="number" min="0" max="100" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} className={field} /></label>
      <label className="text-xs font-bold">Meses<select value={months} onChange={(e) => setMonths(e.target.value)} className={field}><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
      <button type="button" disabled={busy} onClick={() => save({ discountPercent: Number(discount), setupCommissionPercent: Number(setupCommission), commissionPercent: Number(commission), durationMonths: Number(months) })} className="self-end rounded-md bg-[#007A69] px-3 py-2 text-xs font-black text-white disabled:opacity-50">Guardar</button>
    </div>
  </details>;
}
