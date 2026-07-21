"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, Loader2, Lock, Store } from "lucide-react";
import { plans } from "@/lib/plans";
import { AuthCaptcha } from "@/components/shared/AuthCaptcha";

const businessTypes = [
  { value: "fashion", label: "Ropa / Moda" },
  { value: "food", label: "Comida / Restaurante" },
  { value: "accessories", label: "Accesorios" },
  { value: "beauty", label: "Belleza" },
  { value: "tech", label: "Tecnología" },
  { value: "general", label: "General" },
];

function planCapacityLabel(plan: (typeof plans)[number]) {
  if (plan.id === "custom") return "Adaptado a tu necesidad";
  return `${plan.productLimit} productos · ${plan.storeLimit} comercio${plan.storeLimit > 1 ? "s" : ""}`;
}

function planPriceLabel(plan: (typeof plans)[number]) {
  if (plan.id === "custom") return "Por confirmar";
  return `$${plan.priceUsd}`;
}

export function SignupForm() {
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [businessType, setBusinessType] = useState("fashion");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [success, setSuccess] = useState<{
    slug: string;
    trialEndsAt: string;
    message: string;
    requiresEmailConfirmation: boolean;
  } | null>(null);

  async function createAccount() {
    setIsSaving(true);
    setError("");
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName,
          email,
          password,
          confirmPassword,
          whatsapp,
          businessType,
          captchaToken,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo crear la cuenta.");
      }

      setSuccess({
        slug: data.store?.slug || "",
        trialEndsAt: data.trialEndsAt,
        message: data.message || "Cuenta creada.",
        requiresEmailConfirmation: Boolean(data.requiresEmailConfirmation),
      });
      setPassword("");
      setConfirmPassword("");
      setCaptchaToken("");
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
          <h1 className="mt-5 text-3xl font-black">
            {success.requiresEmailConfirmation ? "Confirma tu correo" : "Tu comercio está listo"}
          </h1>
          <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
            {success.message} Tienes 15 días de prueba para configurar portada, pagos,
            productos y delivery.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href="/panel/login"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
            >
              {success.requiresEmailConfirmation ? "Ir al login" : "Entrar al panel"}
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
          <p className="mt-3 rounded-2xl bg-white/10 p-3 text-sm font-black text-[#FFB547] ring-1 ring-white/10">
            Todos empiezan en Prueba gratis por 15 días. Al vencer, el comercio elige cómo pagar.
          </p>

          <div className="mt-6 grid gap-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="rounded-[24px] bg-white/8 p-4 text-left text-white ring-1 ring-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{plan.name}</p>
                    <p className="mt-1 text-xs font-bold opacity-70">
                      {planCapacityLabel(plan)}
                    </p>
                  </div>
                  <p className="text-xl font-black">
                    {planPriceLabel(plan)}
                    {plan.id !== "custom" ? (
                      <span className="text-xs font-bold opacity-70"> {plan.billingLabel}</span>
                    ) : null}
                  </p>
                </div>
              </div>
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

            <label className="relative space-y-1">
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

            <label className="relative space-y-1">
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

            <label className="relative space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Contraseña
              </span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 pr-12 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
              <PasswordToggle
                isVisible={showPassword}
                onClick={() => setShowPassword((current) => !current)}
              />
            </label>

            <label className="relative space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Confirmar clave
              </span>
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repite tu clave"
                minLength={8}
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 pr-12 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
              <PasswordToggle
                isVisible={showConfirmPassword}
                onClick={() => setShowConfirmPassword((current) => !current)}
              />
            </label>
          </div>

          {error ? (
            <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-black text-red-700 ring-1 ring-red-100">
              {error}
            </p>
          ) : null}

          <AuthCaptcha action="commerce_signup" onToken={setCaptchaToken} />

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

function PasswordToggle({
  isVisible,
  onClick,
}: {
  isVisible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-3 top-[38px] rounded-full p-1 text-[#746f69] hover:bg-[#F8F3E8] hover:text-[#2E3A79]"
      aria-label={isVisible ? "Ocultar clave" : "Mostrar clave"}
    >
      {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}
