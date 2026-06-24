"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Loader2, Lock, Store } from "lucide-react";
import { plans, type PlanId } from "@/lib/plans";

const businessTypes = [
  { value: "fashion", label: "Ropa / Moda" },
  { value: "food", label: "Comida / Restaurante" },
  { value: "accessories", label: "Accesorios" },
  { value: "beauty", label: "Belleza" },
  { value: "tech", label: "Tecnología" },
  { value: "general", label: "General" },
];

export function SignupForm() {
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [businessType, setBusinessType] = useState("fashion");
  const [planId, setPlanId] = useState<PlanId>("trial");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    slug: string;
    trialEndsAt: string;
  } | null>(null);

  async function createAccount() {
    setIsSaving(true);
    setError("");
    setSuccess(null);

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName,
          email,
          password,
          whatsapp,
          businessType,
          planId,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo crear la cuenta.");
      }

      setSuccess({
        slug: data.store?.slug || "",
        trialEndsAt: data.trialEndsAt,
      });
      setPassword("");
    } catch (error: any) {
      setError(error.message || "No se pudo crear la cuenta.");
    } finally {
      setIsSaving(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[#F8F3E8] px-4 py-8 text-[#25262B]">
        <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.10] ring-1 ring-[#25262B]/[0.06]">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
            <Check size={28} />
          </div>
          <h1 className="mt-5 text-3xl font-black">Tu comercio está listo</h1>
          <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
            Tienes 15 días de prueba. Entra al panel para configurar portada, pagos, productos y delivery.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href="/panel/login"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
            >
              Entrar al panel
              <ArrowRight size={17} />
            </Link>
            {success.slug ? (
              <Link
                href={`/${success.slug}`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F8F3E8] px-5 py-4 text-sm font-black text-[#2E3A79]"
              >
                Ver catálogo
              </Link>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3E8] px-4 py-8 text-[#25262B]">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <section className="rounded-[36px] bg-[#25262B] p-6 text-white shadow-2xl shadow-[#25262B]/20">
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-[#FFB547] text-[#25262B]">
            <Store size={25} />
          </div>
          <h1 className="mt-6 text-4xl font-black">Empieza con 15 días gratis</h1>
          <p className="mt-3 text-sm font-bold leading-relaxed text-white/70">
            Crea tu comercio, publica productos, recibe pedidos por WhatsApp y ajusta el delivery antes de pagar.
          </p>

          <div className="mt-6 grid gap-3">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setPlanId(plan.id)}
                className={[
                  "rounded-[24px] p-4 text-left ring-1 transition",
                  planId === plan.id
                    ? "bg-white text-[#25262B] ring-white"
                    : "bg-white/8 text-white ring-white/10",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{plan.name}</p>
                    <p className="mt-1 text-xs font-bold opacity-70">
                      {plan.productLimit} productos · {plan.storeLimit} comercio{plan.storeLimit > 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="text-xl font-black">
                    ${plan.priceUsd}
                    <span className="text-xs font-bold opacity-70"> {plan.billingLabel}</span>
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[36px] bg-white p-6 shadow-2xl shadow-[#2E3A79]/[0.10] ring-1 ring-[#25262B]/[0.06]">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#2E3A79] text-[#FFB547]">
              <Lock size={20} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#746f69]">
                Registro comercio
              </p>
              <h2 className="text-2xl font-black">Crear cuenta</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Nombre del comercio
              </span>
              <input
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
                placeholder="Ej: Estilo Boutique"
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Rubro
              </span>
              <select
                value={businessType}
                onChange={(event) => setBusinessType(event.target.value)}
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              >
                {businessTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                WhatsApp
              </span>
              <input
                value={whatsapp}
                onChange={(event) => setWhatsapp(event.target.value)}
                placeholder="584245666025"
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Email
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="tu@email.com"
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Contraseña
              </span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </label>
          </div>

          {error ? (
            <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-black text-red-700 ring-1 ring-red-100">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={createAccount}
            disabled={isSaving}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            Crear comercio
          </button>

          <p className="mt-4 text-center text-xs font-bold text-[#746f69]">
            ¿Ya tienes cuenta?{" "}
            <Link href="/panel/login" className="font-black text-[#2E3A79]">
              Inicia sesión
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
