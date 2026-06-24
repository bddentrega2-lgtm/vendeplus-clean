"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { usePanelAuth } from "@/components/panel/PanelAuthProvider";
import { savePanelToken } from "@/lib/panel/client-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const { refreshSession } = usePanelAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
      await refreshSession();
      router.push("/panel");
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

  return (
    <main className="min-h-screen bg-[#F8F3E8] px-4 py-8 text-[#25262B]">
      <section className="mx-auto max-w-xl rounded-[40px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.10] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>

        <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
          Panel Vende+
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
              placeholder="admin@vendeplus.com"
              className="mt-1 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
              Contraseña
            </span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Tu contraseña"
              className="mt-1 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />
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

