"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { usePanelAuth } from "@/components/panel/PanelAuthProvider";
import { GoogleLogo } from "@/components/shared/GoogleLogo";
import {
  completePanelOAuthSession,
  hasPanelOAuthReturn,
  savePanelToken,
  signInPanelWithGoogle,
  syncPanelServerSession,
} from "@/lib/panel/client-auth";
import { safeInternalPanelPath } from "@/lib/panel/safe-redirect";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const { refreshSession } = usePanelAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function redirectIfSessionExists() {
      if (typeof window === "undefined") return;
      if (hasPanelOAuthReturn()) return;

      try {
        const response = await fetch("/api/panel/context", {
          credentials: "same-origin",
        });

        if (!response.ok || !isMounted) return;

        const nextPath = new URLSearchParams(window.location.search).get("next") || "/panel";
        window.location.replace(safeInternalPanelPath(nextPath));
      } catch {
        // Si no hay sesión válida, permanece en login.
      }
    }

    async function completeOAuthLogin() {
      if (typeof window === "undefined") return;
      if (!hasPanelOAuthReturn()) return;

      setIsLoading(true);
      setError("");

      try {
        const accessToken = await completePanelOAuthSession();
        if (!accessToken || !isMounted) {
          throw new Error("No se pudo completar la sesion con Google.");
        }

        const nextPath = new URLSearchParams(window.location.search).get("next") || "/panel";
        window.location.replace(safeInternalPanelPath(nextPath));
      } catch (error: any) {
        if (isMounted) setError(error.message || "No se pudo completar el inicio con Google.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void redirectIfSessionExists();
    completeOAuthLogin();
    return () => {
      isMounted = false;
    };
  }, [refreshSession, router]);

  async function login() {
    setIsLoading(true);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();

      if (!supabase) {
        setError("El inicio de sesión no está disponible en este momento.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setError("No se pudo obtener la sesión.");
        return;
      }

      savePanelToken(accessToken);
      await syncPanelServerSession(accessToken);
      await refreshSession();
      const nextPath =
        typeof window === "undefined"
          ? "/panel"
          : new URLSearchParams(window.location.search).get("next") || "/panel";
      router.push(safeInternalPanelPath(nextPath));
    } catch (error: any) {
      const message = String(error?.message || error || "");

      if (
        message.includes("Unexpected token") ||
        message.includes("<!DOCTYPE") ||
        message.includes("not valid JSON")
      ) {
        setError(
          "El login recibió una página HTML en vez de una respuesta de Supabase. Revisa NEXT_PUBLIC_SUPABASE_URL y reinicia el servidor local."
        );
        return;
      }

      setError(message || "No se pudo iniciar sesión.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loginWithGoogle() {
    setIsLoading(true);
    setError("");

    try {
      await signInPanelWithGoogle("/panel/login");
    } catch (error: any) {
      setError(error.message || "No se pudo iniciar con Google.");
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F3E8] px-4 py-8 text-[#25262B]">
      <section className="mx-auto max-w-xl rounded-[40px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.10] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>

        <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
          Panel Somos
        </p>
        <h1 className="mt-2 text-4xl font-black">Iniciar sesión</h1>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Acceso privado para comercios. Cada usuario verá solo la información de sus negocios asignados.
        </p>

        <div className="mt-6 space-y-3 text-left">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
              Email
            </span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="admin@somos.app"
              className="mt-1 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
              Contraseña
            </span>
            <span className="relative mt-1 block">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Tu contraseña"
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 pr-12 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#746f69] hover:bg-[#F8F3E8] hover:text-[#2E3A79]"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={login}
          disabled={isLoading}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <CheckCircle2 size={18} />
          )}
          Entrar al panel
        </button>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-[#25262B]/10" />
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">o</span>
          <span className="h-px flex-1 bg-[#25262B]/10" />
        </div>

        <button
          type="button"
          onClick={loginWithGoogle}
          disabled={isLoading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#25262B]/10 bg-white px-5 py-4 text-sm font-black text-[#25262B] shadow-sm disabled:opacity-60"
        >
          <GoogleLogo />
          Continuar con Google
        </button>

        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}

        <p className="mt-5 text-xs font-bold text-[#746f69]">
          ¿Aún no tienes comercio?{" "}
          <Link href="/registro" className="font-black text-[#2E3A79]">
            Empieza gratis
          </Link>
        </p>
      </section>
    </main>
  );
}

