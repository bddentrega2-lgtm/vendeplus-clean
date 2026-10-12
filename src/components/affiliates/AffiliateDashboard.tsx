"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, CircleDollarSign, Copy, ExternalLink, RefreshCcw, Store, TrendingUp, Wallet } from "lucide-react";
import { getPanelAuthHeaders } from "@/lib/panel/client-auth";

type StoreEarnings = {
  referralId: string;
  storeName: string;
  setupPendingUsd: number;
  setupPaidUsd: number;
  feePendingUsd: number;
  feePaidUsd: number;
};
type Payout = { holderName: string; bankName: string; documentNumber: string; phone: string };
type Data = {
  demo?: boolean;
  asOf: string;
  stores: StoreEarnings[];
  codes: Array<{ id: string; code: string; status: string; discount_percent: number; setup_commission_percent: number; commission_percent: number; duration_months: number }>;
  settlements: Array<{ id: string; amount_usd: number; paid_at: string; method: string; reference: string }>;
};
const emptyPayout: Payout = { holderName: "", bankName: "", documentNumber: "", phone: "" };
const field = "w-full rounded-lg border border-[#25262B]/20 bg-white px-3 py-2 text-sm";
function money(value: number) { return `US$${Number(value || 0).toFixed(2)}`; }
function sum(stores: StoreEarnings[], key: keyof StoreEarnings) {
  return stores.reduce((total, store) => total + Number(store[key] || 0), 0);
}
function date(value: string) {
  return new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeZone: "America/Caracas" }).format(new Date(value));
}

export function AffiliateDashboard({ agencyId, embedded = false }: { agencyId?: string; embedded?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [payout, setPayout] = useState<Payout>(emptyPayout);
  const [payoutExists, setPayoutExists] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);
  const payoutPath = `/api/affiliates/payout${agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : ""}`;

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    if (!quiet) setError("");
    try {
      const path = agencyId
        ? `/api/transport/panel/affiliates?agencyId=${encodeURIComponent(agencyId)}`
        : "/api/affiliates/me";
      const headers = await getPanelAuthHeaders();
      const response = await fetch(path, { headers, cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudieron cargar tus comisiones.");
      setData(json);
      if (!quiet && json.codes?.length) {
        const payoutResponse = await fetch(`/api/affiliates/payout${agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : ""}`, { headers, cache: "no-store" });
        const payoutJson = await payoutResponse.json();
        if (!payoutResponse.ok) throw new Error(payoutJson.error || "No se pudieron cargar tus datos de pago.");
        setPayout(payoutJson.payout || emptyPayout);
        setPayoutExists(Boolean(payoutJson.payout));
      }
    } catch (reason) {
      if (!quiet) setData(null);
      setError(reason instanceof Error ? reason.message : "No se pudo cargar la informacion.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(true); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/registro?ref=${encodeURIComponent(code)}`);
      setMessage("Enlace copiado.");
    } catch { setMessage("No se pudo copiar el enlace."); }
  }

  async function savePayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(payoutPath, {
        method: "PUT", headers: { ...(await getPanelAuthHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify(payout),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudieron guardar tus datos de pago.");
      setPayout(json.payout);
      setPayoutExists(true);
      setMessage("Datos de Pago Móvil guardados.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); }
    finally { setSaving(false); }
  }

  const stores = data?.stores || [];
  const pendingTotal = sum(stores, "setupPendingUsd") + sum(stores, "feePendingUsd");
  const paidTotal = sum(stores, "setupPaidUsd") + sum(stores, "feePaidUsd");
  const content = <div className="mx-auto max-w-5xl space-y-6 text-[#25262B]">
    <header className="flex items-start justify-between gap-3 border-b border-[#25262B]/10 pb-4">
      <div><h1 className="text-xl font-black">Mis referidos</h1>
        {data ? <p className="mt-1 text-xs text-[#586269]">Actualizado {new Intl.DateTimeFormat("es-VE", { hour: "numeric", minute: "2-digit", timeZone: "America/Caracas" }).format(new Date(data.asOf))}</p> : null}
      </div>
      <button type="button" title="Actualizar" aria-label="Actualizar" onClick={() => void load(true)} disabled={refreshing}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#25262B]/15 bg-white text-[#007A69] disabled:opacity-50">
        <RefreshCcw size={18} className={refreshing ? "animate-spin" : ""} />
      </button>
    </header>
    {message ? <p role="status" className="text-sm font-medium text-[#007A69]">{message}</p> : null}
    {loading && !data ? <p className="text-sm">Cargando...</p> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error} {!agencyId && !data ? <Link href="/panel/login?next=/aliados" className="underline">Iniciar sesión</Link> : null}</p> : null}

    {data ? <>
      {data.demo ? <p className="rounded-lg border border-[#E7A648]/50 bg-[#FFF5E4] px-3 py-2 text-xs font-bold text-[#67420D]">Vista de demostración. Los importes y comercios son simulados; no representan deudas reales.</p> : null}
      <section aria-label="Comisiones acumuladas">
        <div className="overflow-hidden rounded-lg border border-[#007A69]/15 bg-white">
          <div className="border-b border-[#007A69]/10 bg-[#E8F5EE] px-4 py-5 sm:px-6">
            <div className="flex items-center gap-2 text-sm font-bold text-[#006854]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#007A69] text-white"><TrendingUp size={18} aria-hidden="true" /></span><h2>Ganancias totales</h2></div>
            <p className="mt-3 text-3xl font-black tabular-nums text-[#153C35] sm:text-4xl">{money(pendingTotal + paidTotal)}</p>
            <p className="mt-1 text-xs text-[#315D52]">Comisiones confirmadas de todos tus comercios</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-[#25262B]/10">
            <div className="min-w-0 px-4 py-4 sm:px-6"><div className="flex items-center gap-2 text-xs font-bold text-[#586269]"><Wallet size={17} className="shrink-0 text-[#D17723]" aria-hidden="true" />Pendiente de pago</div><p className="mt-1 text-lg font-black tabular-nums sm:text-xl">{money(pendingTotal)}</p></div>
            <div className="min-w-0 px-4 py-4 sm:px-6"><div className="flex items-center gap-2 text-xs font-bold text-[#586269]"><CheckCircle2 size={17} className="shrink-0 text-[#007A69]" aria-hidden="true" />Cobrado</div><p className="mt-1 text-lg font-black tabular-nums sm:text-xl">{money(paidTotal)}</p></div>
          </div>
        </div>
        <p className="mt-2 text-xs text-[#586269]">Solo incluye suscripciones y fee que SOMOS ya cobró. Pendiente de pago es dinero por pagarte a ti.</p>
        <h3 className="mb-2 mt-5 flex items-center gap-2 text-sm font-black"><CircleDollarSign size={18} className="text-[#007A69]" aria-hidden="true" /> De donde vienen tus ganancias</h3>
        <EarningsTable rows={[
          { label: "Por suscripciones", pending: sum(stores, "setupPendingUsd"), paid: sum(stores, "setupPaidUsd") },
          { label: "Por fee de pedidos", pending: sum(stores, "feePendingUsd"), paid: sum(stores, "feePaidUsd") },
        ]} />
      </section>

      <section aria-label="Comercios referidos" className="border-t border-[#25262B]/10 pt-5">
        <h2 className="mb-3 text-sm font-black">Por comercio</h2>
        {stores.length ? <div className="divide-y divide-[#25262B]/10 border-y border-[#25262B]/10">
          {stores.map((store) => {
            const expanded = expandedStoreId === store.referralId;
            const pending = Number(store.setupPendingUsd) + Number(store.feePendingUsd);
            const paid = Number(store.setupPaidUsd) + Number(store.feePaidUsd);
            return <div key={store.referralId} className="py-1">
              <button type="button" data-affiliate-store aria-expanded={expanded} aria-controls={`affiliate-store-${store.referralId}`}
                onClick={() => setExpandedStoreId(expanded ? null : store.referralId)}
                className="flex w-full min-w-0 items-center gap-3 py-3 text-left">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFF2DE] text-[#B95E18]"><Store size={18} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{store.storeName}</span><span className="block text-xs text-[#586269]">Ganado {money(pending + paid)}</span><span className="block text-[11px] text-[#586269] sm:hidden">Pendiente {money(pending)} · Cobrado {money(paid)}</span></span>
                <span className="hidden shrink-0 text-right text-xs sm:block"><span className="block text-[#586269]">Pendiente {money(pending)}</span><span className="block font-bold text-[#007A69]">Cobrado {money(paid)}</span></span>
                <ChevronDown size={18} className={`shrink-0 text-[#586269] transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              <div id={`affiliate-store-${store.referralId}`} hidden={!expanded} className="pb-3 pl-1 sm:pl-12">
                <EarningsTable rows={[
                  { label: "Suscripcion", pending: store.setupPendingUsd, paid: store.setupPaidUsd },
                  { label: "Fee de pedidos", pending: store.feePendingUsd, paid: store.feePaidUsd },
                ]} />
              </div>
            </div>;
          })}
        </div> : <p className="border-y border-[#25262B]/10 py-5 text-sm text-[#586269]">Aun no tienes comercios referidos.</p>}
      </section>

      {data.codes.length ? <section className="border-t border-[#25262B]/10 pt-5">
        <h2 className="mb-2 text-sm font-black">Mis enlaces</h2>
        <div className="divide-y divide-[#25262B]/10">{data.codes.map((code) => <div key={code.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0"><p className="text-sm font-bold">{code.code}{code.status !== "active" ? ` (${code.status})` : ""}</p>
            <p className="text-xs text-[#586269]">{code.discount_percent}% de descuento al comercio · {code.setup_commission_percent}% de la suscripción · {code.commission_percent}% del fee durante {code.duration_months} {code.duration_months === 1 ? "mes" : "meses"}</p></div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" title="Copiar enlace" onClick={() => void copy(code.code)} className="inline-flex items-center gap-1 text-xs font-bold text-[#007A69]"><Copy size={15} /> Copiar</button>
            <Link href={`/registro?ref=${encodeURIComponent(code.code)}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#007A69]"><ExternalLink size={15} /> Registrar comercio</Link>
          </div>
        </div>)}</div>
      </section> : null}

      {data.codes.length ? <section className="border-t border-[#25262B]/10 pt-5">
        <h2 className="text-sm font-black">Mis datos para recibir pagos</h2>
        <p className="mb-3 text-xs text-[#586269]">El administrador usará estos datos de Pago Móvil cuando corresponda pagarte.</p>
        <form onSubmit={(event) => void savePayout(event)} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold">Nombre del titular<input required maxLength={120} autoComplete="name" value={payout.holderName} onChange={(event) => setPayout({ ...payout, holderName: event.target.value })} className={field} /></label>
          <label className="text-xs font-bold">Banco<input required maxLength={80} value={payout.bankName} onChange={(event) => setPayout({ ...payout, bankName: event.target.value })} className={field} /></label>
          <label className="text-xs font-bold">Cédula o RIF<input required maxLength={20} value={payout.documentNumber} onChange={(event) => setPayout({ ...payout, documentNumber: event.target.value })} className={field} /></label>
          <label className="text-xs font-bold">Teléfono Pago Móvil<input required inputMode="tel" maxLength={11} placeholder="04XXXXXXXXX" value={payout.phone} onChange={(event) => setPayout({ ...payout, phone: event.target.value })} className={field} /></label>
          <div className="sm:col-span-2"><button type="submit" disabled={saving} className="rounded-lg bg-[#007A69] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Guardando..." : payoutExists ? "Actualizar datos" : "Guardar datos"}</button></div>
        </form>
      </section> : null}

      {!data.demo && data.settlements.length ? <section className="border-t border-[#25262B]/10 pt-5">
        <h2 className="mb-2 text-sm font-black">Pagos recibidos</h2>
        <div className="divide-y divide-[#25262B]/10">{data.settlements.slice(0, 5).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{date(item.paid_at)} · {item.method} · {item.reference}</span><strong>{money(item.amount_usd)}</strong></div>)}</div>
      </section> : null}
    </> : null}
  </div>;
  return embedded ? <section className="py-5">{content}</section> : <main className="min-h-screen bg-[#F5F7F7] px-4 py-6">{content}</main>;
}

function EarningsTable({ rows }: { rows: Array<{ label: string; pending: number; paid: number }> }) {
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[300px] table-fixed text-left text-sm">
      <thead><tr className="border-b border-[#25262B]/15 text-xs text-[#586269]"><th className="w-[42%] pb-2 font-bold">Concepto</th><th className="w-[29%] pb-2 text-right font-bold">Pendiente de pago</th><th className="w-[29%] pb-2 text-right font-bold">Cobrado</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.label} className="border-b border-[#25262B]/10"><th className="py-2.5 pr-2 font-medium">{row.label}</th><td className="py-2.5 text-right tabular-nums">{money(row.pending)}</td><td className="py-2.5 text-right tabular-nums">{money(row.paid)}</td></tr>)}
        </tbody>
    </table>
  </div>;
}
