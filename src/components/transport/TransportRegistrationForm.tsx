"use client";

import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, MessageCircle, Send } from "lucide-react";
import { AuthCaptcha } from "@/components/shared/AuthCaptcha";
import { buildSomosWhatsAppUrl } from "@/lib/whatsapp";

export function TransportRegistrationForm() {
  const [form, setForm] = useState({
    name: "",
    rif: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [saved, setSaved] = useState(false);
  const [officialWhatsappUrl, setOfficialWhatsappUrl] = useState("");

  function update(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    if (form.password !== form.confirmPassword) {
      setMessage("Las claves no coinciden.");
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/transport/agencies/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, captchaToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo registrar.");
      const whatsappUrl = buildSomosWhatsAppUrl([
        "Hola Somos, acabo de registrar una empresa delivery.",
        `Empresa: ${form.name.trim()}`,
        form.rif.trim() ? `RIF: ${form.rif.trim()}` : "",
        `Responsable: ${form.contactName.trim()}`,
        `Teléfono: ${form.contactPhone.trim()}`,
        `Correo: ${form.contactEmail.trim()}`,
      ].filter(Boolean).join("\n"));
      setSaved(true);
      setOfficialWhatsappUrl(whatsappUrl);
      setMessage(data.message || "Solicitud recibida.");
      setCaptchaToken("");
      window.location.assign(whatsappUrl);
    } catch (error: any) {
      setMessage(error.message || "No se pudo registrar.");
    } finally {
      setIsSaving(false);
    }
  }

  if (saved) {
    return (
      <section className="rounded-[32px] bg-white p-6 text-center shadow-xl shadow-[#25262B]/10 ring-1 ring-[#25262B]/10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-green-100 text-green-700">
          <CheckCircle2 size={28} />
        </div>
        <h2 className="mt-4 text-2xl font-black text-[#25262B]">Solicitud recibida</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">{message}</p>
        <a
          href={officialWhatsappUrl}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-black text-[#143D42]"
        >
          <MessageCircle size={17} /> Enviar registro a Somos
        </a>
        <a
          href="/transporte"
          className="mt-3 inline-flex items-center justify-center rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
        >
          Volver a transporte
        </a>
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10 ring-1 ring-[#25262B]/10"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Nombre comercial" value={form.name} onChange={(value) => update("name", value)} required />
        <Input label="RIF opcional" value={form.rif} onChange={(value) => update("rif", value)} />
        <Input label="Telefono" value={form.contactPhone} onChange={(value) => update("contactPhone", value)} required />
        <Input label="Responsable" value={form.contactName} onChange={(value) => update("contactName", value)} required />
        <Input label="Correo" type="email" value={form.contactEmail} onChange={(value) => update("contactEmail", value)} required />
        <Input
          label="Clave de ingreso"
          type={showPassword ? "text" : "password"}
          value={form.password}
          onChange={(value) => update("password", value)}
          required
          minLength={8}
          trailingButton={
            <PasswordToggle
              isVisible={showPassword}
              onClick={() => setShowPassword((current) => !current)}
            />
          }
        />
        <Input
          label="Confirmar clave"
          type={showConfirmPassword ? "text" : "password"}
          value={form.confirmPassword}
          onChange={(value) => update("confirmPassword", value)}
          required
          minLength={8}
          trailingButton={
            <PasswordToggle
              isVisible={showConfirmPassword}
              onClick={() => setShowConfirmPassword((current) => !current)}
            />
          }
        />
      </div>

      <p className="mt-2 text-xs font-bold text-[#746f69]">
        Usa 8 caracteres o más. Combinar varias palabras suele ser fácil de recordar y más seguro.
      </p>

      <AuthCaptcha action="transport_agency_apply" onToken={setCaptchaToken} />

      <button
        type="submit"
        disabled={isSaving}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60 sm:w-auto"
      >
        {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        Enviar solicitud
      </button>

      <p className="mt-3 text-xs font-bold leading-5 text-[#746f69]">
        Al completar el registro abriremos el WhatsApp oficial de Somos con tus datos prellenados. Tú confirmarás el envío.
      </p>

      {message ? <p className="mt-3 text-sm font-black text-red-600">{message}</p> : null}
    </form>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  minLength,
  trailingButton,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  trailingButton?: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">{label}</span>
      <span className="relative block">
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          minLength={minLength}
          className={[
            "w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]",
            trailingButton ? "pr-12" : "",
          ].join(" ")}
        />
        {trailingButton}
      </span>
    </label>
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
      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#746f69] hover:bg-[#F8F3E8] hover:text-[#2E3A79]"
      aria-label={isVisible ? "Ocultar clave" : "Mostrar clave"}
    >
      {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}
