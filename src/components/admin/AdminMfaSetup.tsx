"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePanelAuth } from "@/components/panel/PanelAuthProvider";

type TotpFactor = {
  id: string;
  friendly_name?: string | null;
  status?: string | null;
};

type PendingEnrollment = {
  id: string;
  qrCode: string;
  secret: string;
};

function readableError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message || fallback;
}

export function AdminMfaSetup() {
  const { isBootstrapping, isFounderMode } = usePanelAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [verifiedFactor, setVerifiedFactor] = useState<TotpFactor | null>(null);
  const [pending, setPending] = useState<PendingEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadFactors() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("No se pudo conectar con el inicio de sesión.");
      setIsLoading(false);
      return;
    }

    const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      setError(readableError(factorsError, "No se pudo revisar tu autenticador."));
      setIsLoading(false);
      return;
    }

    const verified = (data?.totp || []).find((factor) => factor.status === "verified") || null;
    setVerifiedFactor(verified);
    setIsLoading(false);
  }

  useEffect(() => {
    if (!isBootstrapping && isFounderMode) void loadFactors();
  }, [isBootstrapping, isFounderMode]);

  async function beginEnrollment() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    setIsWorking(true);
    setError("");
    setMessage("");
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Admin Somos",
      });
      if (enrollError || !data?.id || !data.totp?.qr_code || !data.totp.secret) {
        throw enrollError || new Error("No se pudo preparar el autenticador.");
      }
      setPending({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    } catch (reason) {
      setError(readableError(reason, "No se pudo preparar el autenticador."));
    } finally {
      setIsWorking(false);
    }
  }

  async function verifyEnrollment() {
    const supabase = createSupabaseBrowserClient();
    const cleanCode = code.replace(/\D/g, "");
    if (!supabase || !pending || cleanCode.length !== 6) {
      setError("Escribe los seis dígitos que muestra tu autenticador.");
      return;
    }

    setIsWorking(true);
    setError("");
    setMessage("");
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pending.id,
        code: cleanCode,
      });
      if (verifyError) throw verifyError;
      setPending(null);
      setCode("");
      setMessage("Autenticador verificado. Tu acceso actual continúa igual mientras completamos la prueba controlada.");
      await loadFactors();
    } catch (reason) {
      setError(readableError(reason, "No se pudo verificar el código."));
    } finally {
      setIsWorking(false);
    }
  }

  async function copySecret() {
    if (!pending?.secret) return;
    try {
      await navigator.clipboard.writeText(pending.secret);
      setMessage("Clave copiada.");
    } catch {
      setError("No se pudo copiar la clave. Puedes escribirla manualmente.");
    }
  }

  if (isBootstrapping || (isFounderMode && isLoading)) {
    return <div className="grid min-h-48 place-items-center"><Loader2 className="animate-spin text-[#2E3A79]" /></div>;
  }

  if (!isFounderMode) {
    return <div className="rounded-3xl bg-white p-6 text-sm font-bold text-[#746f69] shadow-sm">Esta sección está disponible solo para Administrador.</div>;
  }

  return (
    <section className="max-w-3xl rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#25262B]/10 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#E7F5EE] text-[#087443]"><KeyRound size={22} /></div>
        <div>
          <h2 className="text-xl font-black text-[#25262B]">Autenticador de administrador</h2>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-[#746f69]">Protege este acceso con Google Authenticator, Authy u otra aplicación compatible.</p>
        </div>
      </div>

      {verifiedFactor ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[#E7F5EE] p-4 text-[#087443]">
          <CheckCircle2 size={21} />
          <div><p className="font-black">Autenticador configurado</p><p className="text-sm font-semibold">{verifiedFactor.friendly_name || "Aplicación autenticadora"}</p></div>
        </div>
      ) : !pending ? (
        <div className="mt-6">
          <button type="button" onClick={() => void beginEnrollment()} disabled={isWorking} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#2E3A79] px-5 text-sm font-black text-white disabled:opacity-60">
            {isWorking ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}
            Configurar autenticador
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 rounded-3xl bg-[#F8F3E8] p-5 sm:grid-cols-[180px_1fr]">
          <img src={pending.qrCode} alt="Código QR para configurar el autenticador" className="h-[180px] w-[180px] rounded-xl bg-white p-2" />
          <div>
            <p className="text-sm font-bold text-[#25262B]">Escanea el código con tu aplicación autenticadora y escribe los seis dígitos que te muestre.</p>
            <button type="button" onClick={() => void copySecret()} className="mt-3 inline-flex items-center gap-2 text-sm font-black text-[#2E3A79]"><Copy size={16} /> Usar clave manual</button>
            <label className="mt-5 block text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">Código de seis dígitos</label>
            <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="mt-2 w-full rounded-2xl border border-[#25262B]/15 bg-white px-4 py-3 text-lg font-black tracking-[0.25em] outline-none focus:border-[#2E3A79]" />
            <button type="button" onClick={() => void verifyEnrollment()} disabled={isWorking || code.length !== 6} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#087443] px-5 text-sm font-black text-white disabled:opacity-60">
              {isWorking ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} Verificar autenticador
            </button>
          </div>
        </div>
      )}

      {message ? <p className="mt-5 rounded-2xl bg-[#E7F5EE] p-3 text-sm font-bold text-[#087443]">{message}</p> : null}
      {error ? <p className="mt-5 flex gap-2 rounded-2xl bg-[#FFF0EE] p-3 text-sm font-bold text-[#B53A2D]"><ShieldAlert size={18} className="shrink-0" />{error}</p> : null}
    </section>
  );
}
