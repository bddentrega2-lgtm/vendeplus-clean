"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePanelAuth } from "@/components/panel/PanelAuthProvider";

type GateState = "loading" | "open" | "required" | "blocked";

export function AdminMfaGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isBootstrapping, isFounderMode } = usePanelAuth();
  const [state, setState] = useState<GateState>("loading");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function check() {
    const response = await fetch("/api/admin/mfa-session", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.required || data.verified) { setState("open"); return; }
    const supabase = createSupabaseBrowserClient();
    const { data: factors } = supabase ? await supabase.auth.mfa.listFactors() : { data: null };
    const factor = factors?.totp?.find((item) => item.status === "verified");
    setFactorId(factor?.id || "");
    setState(factor ? "required" : "blocked");
  }

  useEffect(() => { if (!isBootstrapping) { if (isFounderMode) void check().catch(() => setState("blocked")); else setState("open"); } }, [isBootstrapping, isFounderMode]);

  async function verify() {
    const supabase = createSupabaseBrowserClient();
    const cleanCode = code.replace(/\D/g, "");
    if (!supabase || !factorId || cleanCode.length !== 6) { setError("Escribe los seis dígitos de tu autenticador."); return; }
    setWorking(true); setError("");
    try {
      const { error: challengeError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: cleanCode });
      if (challengeError) throw challengeError;
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch("/api/admin/mfa-session", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken: session.session?.access_token || "" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo confirmar el autenticador.");
      setCode(""); setState("open");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo verificar el código."); }
    finally { setWorking(false); }
  }

  if (pathname === "/admin/seguridad" || state === "open") return <>{children}</>;
  if (state === "loading" || isBootstrapping) return <div className="grid min-h-[45vh] place-items-center"><Loader2 className="animate-spin text-[#2E3A79]" /></div>;
  if (state === "blocked") return <section className="mx-auto max-w-xl rounded-3xl bg-white p-7 text-center shadow-sm"><ShieldAlert className="mx-auto text-[#B53A2D]" size={28} /><h2 className="mt-4 text-xl font-black">Configura tu autenticador</h2><p className="mt-2 text-sm font-semibold text-[#746f69]">Antes de entrar a Admin, configura y verifica tu aplicación autenticadora.</p><Link href="/admin/seguridad" className="mt-5 inline-flex min-h-11 items-center rounded-2xl bg-[#2E3A79] px-5 text-sm font-black text-white">Ir a Seguridad</Link></section>;
  return <section className="mx-auto max-w-xl rounded-3xl bg-white p-7 text-center shadow-sm"><KeyRound className="mx-auto text-[#087443]" size={28} /><h2 className="mt-4 text-xl font-black">Confirma tu autenticador</h2><p className="mt-2 text-sm font-semibold text-[#746f69]">Escribe el código de seis dígitos para abrir Admin.</p><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="mt-5 w-full rounded-2xl border border-[#25262B]/15 px-4 py-3 text-center text-xl font-black tracking-[0.25em] outline-none focus:border-[#2E3A79]" /><button type="button" onClick={() => void verify()} disabled={working || code.length !== 6} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#087443] px-5 text-sm font-black text-white disabled:opacity-60">{working ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />} Confirmar</button>{error ? <p className="mt-4 text-sm font-bold text-[#B53A2D]">{error}</p> : null}</section>;
}
