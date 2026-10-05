"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, RefreshCcw } from "lucide-react";
import { getPanelAuthHeaders } from "@/lib/panel/client-auth";

type Data = {
  pendingUsd: number;
  codes: Array<{ id: string; code: string; status: string; discount_percent: number; commission_percent: number; duration_months: number }>;
  referrals: Array<{ id: string; affiliate_code_id: string; duration_months: number; activated_at: string | null; ends_at: string | null; commerce_registration_requests: { store_name: string; request_code: string; status: string; setup_payment_status: string } | null }>;
  commissions: Array<{ id: string; referral_id: string; fee_usd: number; commission_percent: number; amount_usd: number; eligible_at: string; status: string }>;
  settlements: Array<{ id: string; amount_usd: number; paid_at: string; method: string; reference: string }>;
  adjustments: Array<{ commission_id: string; amount_usd: number; created_at: string }>;
};

function money(value: number) { return `US$${Number(value).toFixed(2)}`; }
function date(value: string | null) { return value ? new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Caracas" }).format(new Date(value)) : "Pendiente"; }
function remaining(value: string | null) {
  if (!value) return "Pendiente de activacion";
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  return days > 0 ? `Vigente · ${days} dias restantes` : "Periodo vencido";
}

export function AffiliateDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/affiliates/me", { headers: await getPanelAuthHeaders(), cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo cargar el panel.");
      setData(json);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar el panel."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <main className="min-h-screen bg-[#F5F7F7] px-4 py-6 text-[#25262B]">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center justify-between border-b border-[#25262B]/10 pb-4">
        <div><p className="text-sm font-black text-[#007A69]">SOMOS</p><h1 className="text-2xl font-black">Mis referidos</h1></div>
        <button type="button" title="Actualizar" aria-label="Actualizar" onClick={() => void load()} className="grid h-10 w-10 place-items-center rounded-lg bg-white"><RefreshCcw size={18} /></button>
      </header>
      <p className="text-sm text-[#50565A]">Recibes el porcentaje pactado del fee de SOMOS durante el periodo indicado de cada comercio referido.</p>
      {loading ? <p>Cargando...</p> : null}
      {error ? <p role="alert" className="text-red-700">{error} <Link href="/panel/login?next=/aliados" className="underline">Iniciar sesion</Link></p> : null}
      {data ? <>
        <section className="grid gap-3 sm:grid-cols-3">
          {[{ label: "Pendiente de cobro", value: data.pendingUsd }, { label: "Disponible", value: data.commissions.filter((item) => item.status === "available").reduce((sum, item) => sum + Number(item.amount_usd) + data.adjustments.filter((adjustment) => adjustment.commission_id === item.id).reduce((part, adjustment) => part + Number(adjustment.amount_usd), 0), 0) }, { label: "Pagado", value: data.settlements.reduce((sum, item) => sum + Number(item.amount_usd), 0) }].map((item) => <div key={item.label} className="rounded-lg bg-white p-4"><p className="text-xs font-bold text-[#50565A]">{item.label}</p><p className="mt-1 text-xl font-black">{money(item.value)}</p></div>)}
        </section>
        <section><h2 className="mb-3 text-lg font-black">Codigos</h2><div className="grid gap-2">{data.codes.map((code) => <div key={code.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-4"><div><p className="font-black">{code.code} · {code.status}</p><p className="text-xs text-[#50565A]">{code.discount_percent}% de descuento · {code.commission_percent}% del fee · {code.duration_months} meses</p></div><button type="button" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/registro?ref=${encodeURIComponent(code.code)}`)} className="inline-flex items-center gap-2 text-sm font-bold text-[#007A69]"><Copy size={16} /> Copiar enlace</button></div>)}</div></section>
        <section><h2 className="mb-3 text-lg font-black">Comercios referidos</h2><div className="grid gap-2">{data.referrals.map((item) => <div key={item.id} className="rounded-lg bg-white p-4"><p className="font-black">{item.commerce_registration_requests?.store_name || "Comercio"}</p><p className="text-sm text-[#50565A]">{item.commerce_registration_requests?.request_code} · {item.commerce_registration_requests?.status === "approved" ? "Activado" : item.commerce_registration_requests?.setup_payment_status === "confirmed" ? "Pago confirmado" : item.commerce_registration_requests?.setup_payment_status === "waived" ? "Exonerado" : "Pendiente de pago o aprobacion"}</p><p className="text-xs text-[#50565A]">{item.duration_months} meses · Inicio: {date(item.activated_at)} · Vence: {date(item.ends_at)} · {remaining(item.ends_at)}</p></div>)}</div></section>
        <section><h2 className="mb-3 text-lg font-black">Comisiones</h2><div className="overflow-x-auto rounded-lg bg-white"><table className="w-full min-w-[500px] text-left text-sm"><thead><tr className="border-b"><th className="p-3">Fecha</th><th>Fee cobrado</th><th>Porcentaje</th><th>Comision</th><th>Estado</th></tr></thead><tbody>{data.commissions.map((item) => <tr key={item.id} className="border-b"><td className="p-3">{date(item.eligible_at)}</td><td>{money(item.fee_usd)}</td><td>{item.commission_percent}%</td><td>{money(item.amount_usd)}</td><td>{item.status === "available" ? "Disponible" : item.status === "paid" ? "Pagada" : "Ajustada"}</td></tr>)}</tbody></table></div></section>
        <section><h2 className="mb-3 text-lg font-black">Liquidaciones</h2><div className="grid gap-2">{data.settlements.map((item) => <p key={item.id} className="rounded-lg bg-white p-3 text-sm">{date(item.paid_at)} · {money(item.amount_usd)} · {item.method} · {item.reference}</p>)}</div></section>
        <section><h2 className="mb-3 text-lg font-black">Ajustes</h2><div className="grid gap-2">{data.adjustments.map((item) => <p key={`${item.commission_id}-${item.created_at}`} className="rounded-lg bg-white p-3 text-sm">{date(item.created_at)} · {money(item.amount_usd)}</p>)}</div></section>
      </> : null}
    </div>
  </main>;
}
