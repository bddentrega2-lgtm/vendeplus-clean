"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Check, ImageUp, Loader2, Lock, MessageCircle, Store } from "lucide-react";
import { AuthCaptcha } from "@/components/shared/AuthCaptcha";
import { BUSINESS_TYPES, businessTypeLabel } from "@/lib/business-types";
import {
  getWeeklyOrderVolume,
  WEEKLY_ORDER_VOLUME_OPTIONS,
} from "@/lib/commerce-registration";
import { buildSomosWhatsAppUrl } from "@/lib/whatsapp";

type SuccessState = {
  requestCode: string;
  message: string;
  whatsappUrl: string;
};

export function SignupForm() {
  const [storeName, setStoreName] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [representativeIdNumber, setRepresentativeIdNumber] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [businessType, setBusinessType] = useState("food");
  const [cityId, setCityId] = useState("");
  const [cities, setCities] = useState<Array<{ id: string; name: string; state_name: string }>>([]);
  const [referralCode, setReferralCode] = useState("");
  const [weeklyOrderVolume, setWeeklyOrderVolume] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [success, setSuccess] = useState<SuccessState | null>(null);

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

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(logo.type) || logo.size > 2 * 1024 * 1024) {
      setError("El logo debe ser JPG, PNG o WebP y pesar máximo 2 MB.");
      setIsSaving(false);
      return;
    }
    if (!cityId) {
      setError("Selecciona la ciudad donde opera el comercio.");
      setIsSaving(false);
      return;
    }
    if (!weeklyOrderVolume) {
      setError("Indica cuántos pedidos recibes por WhatsApp en una semana.");
      setIsSaving(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.set("storeName", storeName);
      formData.set("representativeName", representativeName);
      formData.set("representativeIdNumber", representativeIdNumber);
      formData.set("email", email);
      formData.set("whatsapp", whatsapp);
      formData.set("businessType", businessType);
      formData.set("cityId", cityId);
      formData.set("captchaToken", captchaToken);
      formData.set("referralCode", referralCode);
      formData.set("weeklyOrderVolume", weeklyOrderVolume);
      formData.set("logo", logo);

      const response = await fetch("/api/signup", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo enviar la solicitud.");

      const requestCode = String(data.request?.request_code || "");
      const volumeLabel = getWeeklyOrderVolume(weeklyOrderVolume).label;
      const officialWhatsappUrl = buildSomosWhatsAppUrl([
        "Hola Somos, quiero enviar mi solicitud de comercio.",
        requestCode ? `Solicitud: ${requestCode}` : "",
        `Comercio: ${storeName.trim()}`,
        `Rubro: ${businessTypeLabel(businessType)}`,
        `Representante: ${representativeName.trim()}`,
        `Pedidos por WhatsApp: ${volumeLabel}`,
        `WhatsApp: ${whatsapp.trim()}`,
        `Correo: ${email.trim()}`,
      ].filter(Boolean).join("\n"));

      setSuccess({
        requestCode,
        message: data.message || "Solicitud guardada.",
        whatsappUrl: officialWhatsappUrl,
      });
      setCaptchaToken("");
      window.location.assign(officialWhatsappUrl);
    } catch (submitError: any) {
      setError(submitError.message || "No se pudo enviar la solicitud.");
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
          <h1 className="mt-5 text-3xl font-black">Solicitud recibida</h1>
          <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
            {success.message} Tu cuenta todavía no ha sido creada. Cuando Somos apruebe la solicitud,
            recibirás por correo el acceso para configurar tu catálogo.
          </p>
          {success.requestCode ? (
            <p className="mt-4 text-lg font-black text-[#2E3A79]">{success.requestCode}</p>
          ) : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <a
              href={success.whatsappUrl}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-4 text-sm font-black text-[#143D42] sm:col-span-2"
            >
              <MessageCircle size={18} /> Enviar solicitud a Somos
            </a>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F8F3E8] px-5 py-4 text-sm font-black text-[#2E3A79] sm:col-span-2"
            >
              Volver al inicio
            </Link>
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
            Envía tus datos a Somos. Revisaremos la solicitud antes de habilitar tu cuenta y tu catálogo.
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
              "Acceso habilitado después de la revisión de Somos",
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
              <h2 className="text-2xl font-black">Registro de comercio</h2>
            </div>
          </div>

          <form className="mt-6" onSubmit={submitRequest}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre del comercio" wide>
                <input value={storeName} onChange={(event) => setStoreName(event.target.value)} placeholder="Ej: Estilo Boutique" required className={inputClass} />
              </Field>
              <Field label="Nombre del representante">
                <input value={representativeName} onChange={(event) => setRepresentativeName(event.target.value)} placeholder="Nombre y apellido" autoComplete="name" required className={inputClass} />
              </Field>
              <Field label="Cédula del representante">
                <input value={representativeIdNumber} onChange={(event) => setRepresentativeIdNumber(event.target.value.toUpperCase())} placeholder="V-12345678" required className={inputClass} />
              </Field>
              <Field label="Logo del comercio" wide>
                <span className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-[#2E3A79]/30 bg-[#F8F3E8] px-4 py-4 text-sm font-bold text-[#2E3A79]">
                  <ImageUp size={22} />
                  {logo ? logo.name : "Subir logo en JPG, PNG o WebP (máximo 2 MB)"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" required className="sr-only" onChange={(event) => setLogo(event.target.files?.[0] || null)} />
                </span>
              </Field>
              <Field label="Ciudad donde opera" wide>
                <select value={cityId} onChange={(event) => setCityId(event.target.value)} required className={inputClass}>
                  <option value="">Selecciona tu ciudad</option>
                  {cities.map((city) => <option key={city.id} value={city.id}>{city.name}, {city.state_name}</option>)}
                </select>
              </Field>
              <Field label="Rubro">
                <select value={businessType} onChange={(event) => setBusinessType(event.target.value)} className={inputClass}>
                  {BUSINESS_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </Field>
              <Field label="WhatsApp">
                <input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="584245666025" required className={inputClass} />
              </Field>
              <Field label="Email" wide>
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="tu@email.com" required className={inputClass} />
              </Field>
              <Field label="¿Cuántos pedidos recibes actualmente por WhatsApp en una semana promedio?" wide>
                <select value={weeklyOrderVolume} onChange={(event) => setWeeklyOrderVolume(event.target.value)} required className={inputClass}>
                  <option value="">Selecciona una opción</option>
                  {WEEKLY_ORDER_VOLUME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="Código de referido (opcional)" wide>
                <input value={referralCode} onChange={(event) => setReferralCode(event.target.value)} placeholder="Comercio que te invitó" className={inputClass} />
              </Field>
            </div>

            {error ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-black text-red-700 ring-1 ring-red-100">{error}</p> : null}
            <AuthCaptcha action="commerce_signup" onToken={setCaptchaToken} />
            <button type="submit" disabled={isSaving} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60">
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              Enviar solicitud
            </button>
            <p className="mt-3 text-center text-xs font-bold leading-5 text-[#746f69]">
              Guardaremos tu solicitud y abriremos el WhatsApp oficial de Somos. La cuenta se crea únicamente después de la aprobación.
            </p>
            <p className="mt-4 text-center text-xs font-bold text-[#746f69]">
              ¿Ya tienes cuenta? <Link href="/panel/login" className="font-black text-[#2E3A79]">Inicia sesión</Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

const inputClass = "w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]";

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`space-y-1 ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">{label}</span>
      {children}
    </label>
  );
}
