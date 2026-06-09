"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";
import { clearPanelAuthStorage } from "@/lib/panel/client-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function cleanRecoveryUrl() {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", "/panel/update-password");
}

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function readRecoverySession() {
      setIsCheckingSession(true);
      setError("");

      try {
        const supabase = createSupabaseBrowserClient();

        if (!supabase) {
          setError("Supabase no está configurado.");
          return;
        }

        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const code = url.searchParams.get("code");

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;

          setHasRecoverySession(Boolean(data.session));
          cleanRecoveryUrl();
          return;
        }

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) throw error;

          setHasRecoverySession(Boolean(data.session));
          cleanRecoveryUrl();
          return;
        }

        const { data } = await supabase.auth.getSession();
        setHasRecoverySession(Boolean(data.session));
      } catch (error: any) {
        setError(
          error.message ||
            "El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo."
        );
        setHasRecoverySession(false);
      } finally {
        setIsCheckingSession(false);
      }
    }

    readRecoverySession();
  }, []);

  async function updatePassword() {
    setError("");

    if (!hasRecoverySession) {
      setError("No hay una sesión de recuperación activa. Abre el enlace desde tu email.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (!supabase) {
        setError("Supabase no está configurado.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      clearPanelAuthStorage();
      await supabase.auth.signOut();
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      setError(error.message || "No se pudo actualizar la contraseña.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F3E8] px-4 py-8 text-[#25262B]">
      <section className="mx-auto max-w-xl rounded-[40px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.10] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          {success ? <ShieldCheck size={28} /> : <KeyRound size={28} />}
        </div>

        <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
          Panel Vende+
        </p>
        <h1 className="mt-2 text-4xl font-black">Actualizar contraseña</h1>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Escribe una nueva contraseña para recuperar el acceso a tu panel.
        </p>

        {isCheckingSession ? (
          <div className="mt-6 rounded-3xl bg-[#F8F3E8] p-5 text-sm font-black text-[#746f69]">
            <Loader2 size={18} className="mx-auto mb-2 animate-spin text-[#2E3A79]" />
            Validando enlace de recuperación...
          </div>
        ) : success ? (
          <div className="mt-6">
            <div className="rounded-3xl bg-green-50 p-5 text-sm font-black text-green-700">
              Tu contraseña fue actualizada correctamente. Ya puedes iniciar sesión.
            </div>
            <Link
              href="/panel/login"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
            >
              <CheckCircle2 size={18} />
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-3 text-left">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                  Nueva contraseña
                </span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  className="mt-1 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                  Confirmar contraseña
                </span>
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  placeholder="Repite la contraseña"
                  className="mt-1 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={updatePassword}
              disabled={isSaving || !hasRecoverySession}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
              Guardar nueva contraseña
            </button>

            {!hasRecoverySession && !error && (
              <p className="mt-3 text-sm font-black text-red-600">
                Abre esta página desde el enlace de recuperación enviado a tu email.
              </p>
            )}
          </>
        )}

        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>
    </main>
  );
}
