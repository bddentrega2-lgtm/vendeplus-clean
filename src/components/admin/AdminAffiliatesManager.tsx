"use client";

import { FormEvent, useEffect, useState } from "react";
import { Copy, RefreshCcw } from "lucide-react";

type Code = { id: string; code: string; name: string; contact: string | null; status: string; discount_percent: number; commission_percent: number; duration_months: number; used_count: number; max_uses: number | null; beneficiary_user_id: string | null };
type Referral = { id: string; affiliate_code_id: string; beneficiary_user_id: string | null; activated_at: string | null; ends_at: string | null; commerce_registration_requests: { store_name: string; request_code: string; status: string; setup_payment_status: string } | null };
type Commission = { id: string; referral_id: string; fee_usd: number; commission_percent: number; amount_usd: number; eligible_at: string; status: string };
type Settlement = { id: string; amount_usd: number; paid_at: string; method: string; reference: string };
type Adjustment = { id: string; commission_id: string; amount_usd: number; reason: string; created_at: string };
type Data = { codes: Code[]; referrals: Referral[]; commissions: Commission[]; settlements: Settlement[]; adjustments: Adjustment[] };
const field = "w-full rounded-lg border border-[#25262B]/15 bg-white px-3 py-2 text-sm";
function money(value: number) { return `US$${Number(value).toFixed(2)}`; }
function date(value: string | null) { return value ? new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Caracas" }).format(new Date(value)) : "Pendiente"; }

export function AdminAffiliatesManager() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState({ code: "", name: "", contact: "", beneficiaryEmail: "", discountPercent: "50", commissionPercent: "50", durationMonths: "3", maxUses: "", startsAt: "", expiresAt: "" });
  const [settlement, setSettlement] = useState({ paidAt: new Date().toISOString().slice(0, 10), method: "", reference: "" });
  async function load() {
    setError("");
    try {
      const response = await fetch("/api/admin/affiliates", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo cargar.");
      setData(json);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar."); }
  }
  useEffect(() => { void load(); }, []);
  async function post(path: string, method: string, body: object) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo guardar.");
      setMessage(json.accessEmailRequired && !json.accessEmailSent ? "Codigo creado, pero fallo el correo de acceso. Usa Reenviar acceso." : json.message || "Guardado correctamente."); setSelected([]); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }
  function create(event: FormEvent) { event.preventDefault(); void post("/api/admin/affiliates", "POST", { ...draft, startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : "", expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : "" }); }
  const netAmount = (item: Commission) => Number(item.amount_usd) + (data?.adjustments || []).filter((adjustment) => adjustment.commission_id === item.id).reduce((sum, adjustment) => sum + Number(adjustment.amount_usd), 0);
  const selectedTotal = data?.commissions.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + netAmount(item), 0) || 0;
  async function refund(item: Commission) {
    const amount = window.prompt(`Fee reintegrado del pedido (maximo ${money(item.fee_usd)}):`);
    if (amount === null) return;
    const reference = window.prompt("Referencia unica del reintegro:");
    if (reference === null) return;
    void post("/api/admin/affiliates/adjustments", "POST", { commissionId: item.id, feeRefundUsd: Number(amount), reference: reference.trim() });
  }
  return <div className="space-y-6">
    {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    {message ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
    <section className="border-b border-[#25262B]/10 pb-6"><h2 className="mb-3 text-lg font-black">Nuevo codigo</h2>
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold">Codigo<input required value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} className={field} /></label>
        <label className="text-xs font-bold">Nombre<input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Contacto<input value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Correo beneficiario<input type="email" value={draft.beneficiaryEmail} onChange={(e) => setDraft({ ...draft, beneficiaryEmail: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Descuento %<input required type="number" min="0" max="100" step="0.01" value={draft.discountPercent} onChange={(e) => setDraft({ ...draft, discountPercent: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Comision %<input required type="number" min="0" max="100" step="0.01" value={draft.commissionPercent} onChange={(e) => setDraft({ ...draft, commissionPercent: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Meses<select value={draft.durationMonths} onChange={(e) => setDraft({ ...draft, durationMonths: e.target.value })} className={field}><option value="1">1 mes</option><option value="2">2 meses</option><option value="3">3 meses</option></select></label>
        <label className="text-xs font-bold">Usos maximos<input type="number" min="1" value={draft.maxUses} onChange={(e) => setDraft({ ...draft, maxUses: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Vigente desde<input type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Vence<input type="datetime-local" value={draft.expiresAt} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} className={field} /></label>
        <button disabled={busy} className="self-end rounded-lg bg-[#007A69] px-4 py-2 text-sm font-black text-white disabled:opacity-50">Crear codigo</button>
      </form>
      <p className="mt-2 text-xs text-[#50565A]">Para un codigo promocional sin beneficiario, deja el correo vacio y fija comision en 0%.</p>
    </section>
    <section><h2 className="mb-3 text-lg font-black">Historial de comisiones</h2><div className="grid gap-2">{data?.commissions.filter((item) => item.status !== "available").map((item) => <p key={item.id} className="rounded-lg bg-white p-3 text-sm">{date(item.eligible_at)} · Fee {money(item.fee_usd)} · Comision {money(item.amount_usd)} · {item.status === "paid" ? "Pagada" : "Ajustada"}</p>)}</div></section>
    <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black">Codigos</h2><button onClick={() => void load()} title="Actualizar" aria-label="Actualizar"><RefreshCcw size={17} /></button></div>
      <div className="grid gap-2">{data?.codes.map((code) => <div key={code.id} className="grid items-center gap-3 rounded-lg bg-white p-3 sm:grid-cols-[1fr_auto_auto]">
        <div><p className="font-black">{code.code} · {code.name}</p><p className="text-xs text-[#50565A]">{code.discount_percent}% descuento · {code.commission_percent}% del fee · {code.duration_months} meses · {code.used_count}{code.max_uses ? `/${code.max_uses}` : ""} usos</p></div>
        <button type="button" title="Copiar enlace" aria-label={`Copiar enlace ${code.code}`} onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/registro?ref=${encodeURIComponent(code.code)}`)}><Copy size={17} /></button>
        <select aria-label={`Estado de ${code.code}`} value={code.status} disabled={busy} onChange={(e) => void post("/api/admin/affiliates", "PATCH", { id: code.id, status: e.target.value })} className={field}><option value="active">Activo</option><option value="paused">Pausado</option><option value="disabled">Desactivado</option></select>
        {code.beneficiary_user_id ? <button type="button" disabled={busy} onClick={() => void post("/api/admin/affiliates", "PATCH", { id: code.id, action: "resend_access" })} className="text-left text-xs font-bold text-[#007A69] sm:col-span-3">Reenviar acceso</button> : null}
        <CodeTermsEditor code={code} busy={busy} save={(values) => void post("/api/admin/affiliates", "PATCH", { id: code.id, ...values })} />
      </div>)}</div>
    </section>
    <section><h2 className="mb-3 text-lg font-black">Comercios referidos</h2><div className="grid gap-2">{data?.referrals.map((item) => <div key={item.id} className="rounded-lg bg-white p-3 text-sm"><p className="font-black">{item.commerce_registration_requests?.store_name} · {item.commerce_registration_requests?.request_code}</p><p className="text-[#50565A]">{item.commerce_registration_requests?.status} · Pago {item.commerce_registration_requests?.setup_payment_status} · Inicio {date(item.activated_at)} · Vence {date(item.ends_at)}</p></div>)}</div></section>
    <section><h2 className="mb-3 text-lg font-black">Comisiones disponibles</h2><div className="grid gap-2">{data?.commissions.filter((item) => item.status === "available").map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 text-sm"><label className="flex flex-1 items-center gap-3"><input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} /><span>{date(item.eligible_at)} · Fee {money(item.fee_usd)} · {item.commission_percent}% · Disponible {money(netAmount(item))}</span></label><button type="button" onClick={() => void refund(item)} className="text-xs font-bold text-red-700">Registrar reintegro</button></div>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); if (window.confirm(`Registrar liquidacion por ${money(selectedTotal)}?`)) void post("/api/admin/affiliates/settlements", "POST", { commissionIds: selected, ...settlement }); }} className="mt-3 grid gap-3 sm:grid-cols-4">
        <label className="text-xs font-bold">Fecha de pago<input required type="date" value={settlement.paidAt} onChange={(e) => setSettlement({ ...settlement, paidAt: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Metodo<input required value={settlement.method} onChange={(e) => setSettlement({ ...settlement, method: e.target.value })} className={field} /></label>
        <label className="text-xs font-bold">Referencia<input required value={settlement.reference} onChange={(e) => setSettlement({ ...settlement, reference: e.target.value })} className={field} /></label>
        <button disabled={busy || !selected.length} className="self-end rounded-lg bg-[#007A69] px-4 py-2 text-sm font-black text-white disabled:opacity-50">Liquidar {money(selectedTotal)}</button>
      </form>
    </section>
    <section><h2 className="mb-3 text-lg font-black">Ajustes y reintegros</h2><div className="grid gap-2">{data?.adjustments.map((item) => <p key={item.id} className="rounded-lg bg-white p-3 text-sm">{date(item.created_at)} · {money(item.amount_usd)} · {item.reason}</p>)}</div></section>
    <section><h2 className="mb-3 text-lg font-black">Liquidaciones</h2><div className="grid gap-2">{data?.settlements.map((item) => <p key={item.id} className="rounded-lg bg-white p-3 text-sm">{date(item.paid_at)} · {money(item.amount_usd)} · {item.method} · {item.reference}</p>)}</div></section>
  </div>;
}

function CodeTermsEditor({ code, busy, save }: { code: Code; busy: boolean; save: (values: { discountPercent: number; commissionPercent: number; durationMonths: number }) => void }) {
  const [discount, setDiscount] = useState(String(code.discount_percent));
  const [commission, setCommission] = useState(String(code.commission_percent));
  const [months, setMonths] = useState(String(code.duration_months));
  return <details className="sm:col-span-3"><summary className="cursor-pointer text-xs font-bold text-[#007A69]">Condiciones para nuevas solicitudes</summary>
    <div className="mt-2 grid gap-2 sm:grid-cols-4">
      <label className="text-xs font-bold">Descuento %<input type="number" min="0" max="100" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className={field} /></label>
      <label className="text-xs font-bold">Comision %<input type="number" min="0" max="100" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} className={field} /></label>
      <label className="text-xs font-bold">Meses<select value={months} onChange={(e) => setMonths(e.target.value)} className={field}><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
      <button type="button" disabled={busy} onClick={() => save({ discountPercent: Number(discount), commissionPercent: Number(commission), durationMonths: Number(months) })} className="self-end rounded-lg bg-[#007A69] px-3 py-2 text-xs font-black text-white disabled:opacity-50">Guardar</button>
    </div>
  </details>;
}
