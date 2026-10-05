"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ImageUp } from "lucide-react";

export function SetupPaymentForm() {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setCode(query.get("sol") || "");
    setEmail(query.get("email") || "");
    setPhone(query.get("tel") || "");
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!proof) { setError("Adjunta una imagen del comprobante."); return; }
    setBusy(true); setError("");
    try {
      const data = new FormData();
      data.set("requestCode", code); data.set("email", email); data.set("whatsapp", phone);
      data.set("reference", reference); data.set("proof", proof);
      const response = await fetch("/api/signup/payment", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo reportar el pago.");
      setDone(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo reportar el pago."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#F5F7F7] px-4 py-8 text-[#25262B]"><div className="mx-auto max-w-lg">
    <p className="text-sm font-black text-[#007A69]">SOMOS</p><Link href="/registro" className="mt-2 inline-block text-sm font-bold text-[#007A69]">Volver al registro</Link>
    <h1 className="mt-4 text-2xl font-black">Reportar pago inicial</h1>
    <p className="mt-2 text-sm text-[#50565A]">El comprobante queda en revision. El acceso llega por correo despues de confirmar el pago y aprobar la solicitud.</p>
    {done ? <p className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Pago reportado. SOMOS revisara la referencia y el comprobante.</p> :
      <form onSubmit={submit} className="mt-6 grid gap-4 rounded-lg bg-white p-5">
        <label className="text-sm font-bold">Codigo de solicitud<input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border p-3" /></label>
        <label className="text-sm font-bold">Correo del registro<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
        <label className="text-sm font-bold">WhatsApp del registro<input required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
        <label className="text-sm font-bold">Referencia del pago<input required value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
        <label className="text-sm font-bold">Comprobante (JPG, PNG o WebP; maximo 5 MB)<span className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#007A69]/50 bg-[#F5F7F7] px-3 py-3 text-sm font-medium text-[#007A69]"><ImageUp size={18} />{proof ? proof.name : "Seleccionar imagen"}</span><input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setProof(e.target.files?.[0] || null)} className="sr-only" /></label>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <button disabled={busy} className="rounded-lg bg-[#007A69] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Enviando..." : "Enviar comprobante"}</button>
      </form>}
  </div></main>;
}
