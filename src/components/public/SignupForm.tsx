"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, ImageUp, Loader2, Lock, MessageCircle, Store } from "lucide-react";
import { AuthCaptcha } from "@/components/shared/AuthCaptcha";
import { BUSINESS_TYPES, businessTypeLabel } from "@/lib/business-types";
import { buildSomosWhatsAppUrl } from "@/lib/whatsapp";


export function SignupForm() {
  const [storeName, setStoreName] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [representativeIdNumber, setRepresentativeIdNumber] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [businessType, setBusinessType] = useState("food");
  const [cityId, setCityId] = useState("");
  const [cities, setCities] = useState<Array<{ id: string; name: string; state_name: string }>>([]);
  const [referralCode, setReferralCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [success, setSuccess] = useState<{
    slug: string;
    trialEndsAt: string;
    message: string;
    requiresEmailConfirmation: boolean;
    whatsappUrl: string;
  } | null>(null);

  useEffect(() => {
    const referral = new URLSearchParams(window.location.search).get("ref");
    if (referral) setReferralCode(referral);
  }, []);

  useEffect(() => {
    fetch("/api/cities")
      .then((response) => response.json())
      .then((data) => setCities(data.cities || []))
      .catch(() => setCities([]));
  }, []);

  async function createAccount() {
    setIsSaving(true);
    setError("");
    setSuccess(null);

    if (representativeName.trim().length < 3) {
      setError("Ingresa el nombre completo del representante.");
      setIsSaving(false);
      return;
    }
    if (!/^(?:[VEJGP]-?)?\d{5,12}$/i.test(representativeIdNumber.trim())) {
      setError("Ingresa una cédula válida, por ejemplo V-12345678.");
      setIsSaving(false);
      return;
    }
    if (!logo) {
      setError("Sube el logo del comercio.");
      setIsSaving(false);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(logo.type) || logo.size > 2 * 1024 * 1024) {
      setError("El logo debe ser JPG, PNG o WebP y pesar máximo 2 MB.");
      setIsSaving(false);
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      setIsSaving(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      setIsSaving(false);
      return;
    }
    if (!cityId) {
      setError("Selecciona la ciudad donde opera el comercio.");
      setIsSaving(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.set("storeName", storeName);
      formData.set("representativeName", representativeName);
      formData.set("representativeIdNumber", representativeIdNumber);
      formData.set("email", email);
      formData.set("password", password);
      formData.set("confirmPassword", confirmPassword);
      formData.set("whatsapp", whatsapp);
      formData.set("businessType", businessType);
      formData.set("cityId", cityId);
      formData.set("captchaToken", captchaToken);
      formData.set("referralCode", referralCode);
      if (logo) formData.set("logo", logo);

      const response = await fetch("/api/signup", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo crear la cuenta.");
      }

      const officialWhatsappUrl = buildSomosWhatsAppUrl([
        "Hola Somos, acabo de registrar un comercio.",
        `Comercio: ${storeName.trim()}`,
        `Rubro: ${businessTypeLabel(businessType)}`,
        `Representante: ${representativeName.trim()}`,
        `WhatsApp: ${whatsapp.trim()}`,
        `Correo: ${email.trim()}`,
        data.store?.slug ? `Catálogo: ${window.location.origin}/${data.store.slug}` : "",
      ].filter(Boolean).join("\n"));

      setSuccess({
        slug: data.store?.slug || "",
        trialEndsAt: data.trialEndsAt,
        message: data.message || "Cuenta creada.",
        requiresEmailConfirmation: Boolean(data.requiresEmailConfirmation),
        whatsappUrl: officialWhatsappUrl,
      });
      setPassword("");
      setConfirmPassword("");
      setCaptchaToken("");
      window.location.assign(officialWhatsappUrl);
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
            <a
              href={success.whatsappUrl}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-4 text-sm font-black text-[#143D42] sm:col-span-2"
            >
              <MessageCircle size={18} /> Enviar registro a Somos
            </a>
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
          <h1 className="mt-6 text-4xl font-black">Vende sin pagar mensualidad</h1>
          <p className="mt-3 text-sm font-bold leading-relaxed text-white/70">
            Crea tu catálogo, recibe pedidos por WhatsApp y cobra directamente en tu cuenta.
          </p>
          <div className="mt-5 rounded-[26px] bg-[#FFB547] p-5 text-[#25262B]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2E3A79]">Una sola tarifa clara</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-black">$0.10</span>
              <span className="pb-1 text-xs font-black opacity-65">por pedido recibido</span>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {[
              "Sin mensualidad ni comisión porcentual",
              "Tú eliges: asumir el fee o cobrarlo al cliente",
              "Pagos directos a tu cuenta",
              "Mantienes tus precios reales",
              "Tus clientes siguen siendo tuyos",
            ].map((benefit) => (
              <p key={benefit} className="flex items-center gap-3 text-sm font-bold text-white/85">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-[#FFB547]">
                  <Check size={14} />
                </span>
                {benefit}
              </p>
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
                Nombre del representante
              </span>
              <input
                value={representativeName}
                onChange={(event) => setRepresentativeName(event.target.value)}
                placeholder="Nombre y apellido"
                autoComplete="name"
                required
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Cédula del representante
              </span>
              <input
                value={representativeIdNumber}
                onChange={(event) => setRepresentativeIdNumber(event.target.value.toUpperCase())}
                placeholder="V-12345678"
                inputMode="text"
                required
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Logo del comercio
              </span>
              <span className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-[#2E3A79]/30 bg-[#F8F3E8] px-4 py-4 text-sm font-bold text-[#2E3A79]">
                <ImageUp size={22} />
                {logo ? logo.name : "Subir logo en JPG, PNG o WebP (máximo 2 MB)"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  className="sr-only"
                  onChange={(event) => setLogo(event.target.files?.[0] || null)}
                />
              </span>
            </label>

            <label className="relative space-y-1 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Ciudad donde opera</span>
              <select value={cityId} onChange={(event) => setCityId(event.target.value)} required className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]">
                <option value="">Selecciona tu ciudad</option>
                {cities.map((city) => <option key={city.id} value={city.id}>{city.name}, {city.state_name}</option>)}
              </select>
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
                {BUSINESS_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Código de referido (opcional)
              </span>
              <input
                value={referralCode}
                onChange={(event) => setReferralCode(event.target.value)}
                placeholder="Slug del comercio que te invitó"
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
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

          <p className="mt-2 text-xs font-bold text-[#746f69]">
            Usa 8 caracteres o más. Combinar varias palabras suele ser fácil de recordar y más seguro.
          </p>

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

          <p className="mt-3 text-center text-xs font-bold leading-5 text-[#746f69]">
            Al completar el registro abriremos el WhatsApp oficial de Somos con tus datos prellenados. Tú confirmarás el envío.
          </p>

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
