"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import {
  getPanelAuthHeaders,
  syncPanelServerSession,
} from "@/lib/panel/client-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Factor = {
  id: string;
  friendly_name?: string | null;
  factor_type?: string | null;
  status?: string | null;
};

type AuthCheck = {
  authenticated: boolean;
  userEmail: string | null;
  aal?: "aal1" | "aal2";
  mfaVerified?: boolean;
  reason: string;
};

export function AdminMfaManager() {
  const [authCheck, setAuthCheck] = useState<AuthCheck | null>(null);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  async function loadStatus() {
    setIsLoading(true);
    setError("");

    try {
      const authResponse = await fetch("/api/admin/auth-check", {
        headers: await getPanelAuthHeaders(),
      });
      const authData = await authResponse.json().catch(() => null);
      if (authResponse.ok) setAuthCheck(authData);

      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase no esta disponible.");

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        throw new Error("Inicia sesion nuevamente para configurar el segundo factor.");
      }

      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const totpFactors = ((data?.totp || []) as Factor[]).filter(
        (factor) => factor.status !== "unverified"
      );
      setFactors(totpFactors);
      setFactorId(totpFactors[0]?.id || "");
    } catch (error: any) {
      setError(error.message || "No se pudo cargar la seguridad admin.");
    } finally {
      setIsLoading(false);
    }
  }

  async function startEnrollment() {
    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase no esta disponible.");

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Admin Somos",
        issuer: "Somos",
      } as any);
      if (error) throw error;

      const nextFactorId = data?.id || "";
      const nextQrCode = data?.totp?.qr_code || "";
      const nextSecret = data?.totp?.secret || "";
      if (!nextFactorId || !nextQrCode) {
        throw new Error("No se pudo generar el codigo QR.");
      }

      const challenge = await supabase.auth.mfa.challenge({
        factorId: nextFactorId,
      });
      if (challenge.error) throw challenge.error;

      setFactorId(nextFactorId);
      setChallengeId(challenge.data.id);
      setQrCode(nextQrCode);
      setSecret(nextSecret);
      setMessage("Escanea el QR y escribe el codigo de 6 digitos.");
    } catch (error: any) {
      setError(error.message || "No se pudo iniciar el segundo factor.");
    } finally {
      setIsWorking(false);
    }
  }

  async function startChallenge() {
    if (!factorId) {
      setError("No hay un segundo factor configurado.");
      return;
    }

    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase no esta disponible.");

      const { data, error } = await supabase.auth.mfa.challenge({ factorId });
      if (error) throw error;
      setChallengeId(data.id);
      setMessage("Escribe el codigo de 6 digitos de tu app autenticadora.");
    } catch (error: any) {
      setError(error.message || "No se pudo pedir el codigo.");
    } finally {
      setIsWorking(false);
    }
  }

  async function verifyCode() {
    const cleanCode = code.replace(/\D/g, "");
    if (!factorId || !challengeId || cleanCode.length !== 6) {
      setError("Ingresa el codigo de 6 digitos.");
      return;
    }

    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase no esta disponible.");

      const { data: verifyData, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: cleanCode,
      });
      if (error) throw error;

      const { data } = await supabase.auth.getSession();
      const accessToken =
        (verifyData as { access_token?: string } | null)?.access_token ||
        data.session?.access_token ||
        "";
      if (!accessToken) throw new Error("No se pudo actualizar la sesion.");

      await syncPanelServerSession(accessToken);
      setCode("");
      setChallengeId("");
      setQrCode("");
      setSecret("");
      setMessage("Segundo factor verificado. Ya puedes entrar al admin.");
      await loadStatus();
    } catch (error: any) {
      setError(error.message || "No se pudo verificar el codigo.");
    } finally {
      setIsWorking(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  if (isLoading) {
    return (
      <section className="rounded-[32px] bg-white p-6 text-center shadow-xl shadow-[#2E3A79]/[0.07]">
        <Loader2 className="mx-auto animate-spin text-[#25262B]" size={24} />
        <p className="mt-3 text-sm font-black text-[#746f69]">Cargando seguridad...</p>
      </section>
    );
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
      <div className="rounded-[32px] bg-white p-6 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#25262B] text-[#FFB547]">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-black">Verificacion en dos pasos</h2>
            <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
              El admin global requiere una app autenticadora. Despues de verificar el codigo, la sesion queda habilitada para administrar.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-[#F8F3E8] p-4 text-sm font-bold">
          <p>Email: {authCheck?.userEmail || "no detectado"}</p>
          <p>Sesion MFA: {authCheck?.mfaVerified ? "verificada" : "pendiente"}</p>
          <p>Nivel: {authCheck?.aal || "aal1"}</p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={startEnrollment}
            disabled={isWorking}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60"
          >
            {isWorking ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
            Configurar autenticador
          </button>

          <button
            type="button"
            onClick={startChallenge}
            disabled={isWorking || !factorId}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25262B] px-5 py-4 text-sm font-black text-white disabled:opacity-60"
          >
            {isWorking ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            Verificar codigo
          </button>
        </div>

        {error && <p className="mt-4 text-sm font-black text-red-600">{error}</p>}
        {message && <p className="mt-4 text-sm font-black text-emerald-700">{message}</p>}
      </div>

      <div className="rounded-[32px] bg-white p-6 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <h3 className="text-lg font-black">Codigo de autenticador</h3>

        {qrCode ? (
          <div className="mt-4 rounded-3xl bg-[#F8F3E8] p-4 text-center">
            <img src={qrCode} alt="QR para configurar autenticador" className="mx-auto h-52 w-52 rounded-2xl bg-white p-3" />
            {secret ? (
              <p className="mt-3 break-all text-xs font-bold text-[#746f69]">
                Clave manual: {secret}
              </p>
            ) : null}
          </div>
        ) : factors.length ? (
          <div className="mt-4 rounded-2xl bg-[#F8F3E8] p-4 text-sm font-bold text-[#746f69]">
            Ya tienes un autenticador configurado. Presiona Verificar codigo para elevar la sesion.
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-[#F8F3E8] p-4 text-sm font-bold text-[#746f69]">
            Aun no hay autenticador configurado. Presiona Configurar autenticador.
          </div>
        )}

        <label className="mt-5 block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Codigo de 6 digitos
          </span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="123456"
            className="mt-1 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-center text-lg font-black tracking-[0.35em] outline-none focus:border-[#2E3A79]"
          />
        </label>

        <button
          type="button"
          onClick={verifyCode}
          disabled={isWorking || !challengeId}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-4 text-sm font-black text-white disabled:opacity-60"
        >
          {isWorking ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
          Confirmar segundo factor
        </button>
      </div>
    </section>
  );
}
