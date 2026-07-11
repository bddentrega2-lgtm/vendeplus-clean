"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Lock,
  PauseCircle,
  Save,
  Trash2,
} from "lucide-react";
import {
  getPanelAuthHeaders,
  getSavedPanelToken,
  hasSavedPanelAuth,
} from "@/lib/panel/client-auth";

type StoreDraft = {
  name: string;
  slug: string;
  business_type: string;
  whatsapp: string;
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  opening_hours: string;
  delivery_estimate: string;
  pickup_estimate: string;
  payment_methods: string;
  usd_to_bs: string;
  whatsapp_message_note: string;
  primary_color: string;
  accent_color: string;
  button_text_color: string;
  logo_url: string;
  cover_image_url: string;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  is_active: boolean;
  plan_type: string;
  trial_started_at: string;
  trial_ends_at: string;
  subscription_status: string;
  subscription_started_at: string;
  subscription_ends_at: string;
  next_payment_due_at: string;
  monthly_price_usd: string;
  billing_notes: string;
  last_payment_at: string;
  access_email: string;
  access_password: string;
  access_role: string;
};

const initialDraft: StoreDraft = {
  name: "",
  slug: "",
  business_type: "general",
  whatsapp: "",
  description: "",
  address: "",
  latitude: "",
  longitude: "",
  opening_hours: "Disponible hoy",
  delivery_estimate: "25-40 min",
  pickup_estimate: "15-25 min",
  payment_methods: "Pago movil, Transferencia, Efectivo, Binance",
  usd_to_bs: "600",
  whatsapp_message_note: "",
  primary_color: "#2E3A79",
  accent_color: "#FFB547",
  button_text_color: "#25262B",
  logo_url: "",
  cover_image_url: "",
  accepts_delivery: false,
  accepts_pickup: true,
  is_active: true,
  plan_type: "monthly",
  trial_started_at: "",
  trial_ends_at: "",
  subscription_status: "active",
  subscription_started_at: "",
  subscription_ends_at: "",
  next_payment_due_at: "",
  monthly_price_usd: "20",
  billing_notes: "",
  last_payment_at: "",
  access_email: "",
  access_password: "",
  access_role: "owner",
};

const businessTypes = [
  { value: "food", label: "Comida / Restaurante" },
  { value: "fashion", label: "Ropa / Moda" },
  { value: "accessories", label: "Accesorios" },
  { value: "tech", label: "Tecnologia" },
  { value: "desserts", label: "Dulces / Postres" },
  { value: "beauty", label: "Belleza" },
  { value: "general", label: "General / Otro" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toDateInput(value: unknown) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function addDaysToDateInput(value: string, days: number) {
  const base =
    value && new Date(value).getTime() > Date.now() ? new Date(value) : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function mapStoreToDraft(store: any): StoreDraft {
  return {
    ...initialDraft,
    name: store.name || "",
    slug: store.slug || "",
    business_type: store.business_type || "general",
    whatsapp: store.whatsapp || "",
    description: store.description || "",
    address: store.address || "",
    latitude: store.latitude === null || store.latitude === undefined ? "" : String(store.latitude),
    longitude: store.longitude === null || store.longitude === undefined ? "" : String(store.longitude),
    opening_hours: store.opening_hours || "Disponible hoy",
    delivery_estimate: store.delivery_estimate || "25-40 min",
    pickup_estimate: store.pickup_estimate || "15-25 min",
    payment_methods: Array.isArray(store.payment_methods)
      ? store.payment_methods.join(", ")
      : initialDraft.payment_methods,
    usd_to_bs: String(store.usd_to_bs || "600"),
    whatsapp_message_note: store.whatsapp_message_note || "",
    primary_color: store.primary_color || "#2E3A79",
    accent_color: store.accent_color || "#FFB547",
    button_text_color: store.button_text_color || "#25262B",
    logo_url: store.logo_url || "",
    cover_image_url: store.cover_image_url || "",
    accepts_delivery: store.accepts_delivery === true,
    accepts_pickup: store.accepts_pickup !== false,
    is_active: store.is_active !== false,
    plan_type: store.plan_type || "trial",
    trial_started_at: toDateInput(store.trial_started_at),
    trial_ends_at: toDateInput(store.trial_ends_at),
    subscription_status: store.subscription_status || (store.plan_type === "trial" ? "trial" : "active"),
    subscription_started_at: toDateInput(store.subscription_started_at),
    subscription_ends_at: toDateInput(store.subscription_ends_at),
    next_payment_due_at: toDateInput(store.next_payment_due_at),
    monthly_price_usd: String(store.monthly_price_usd ?? "0"),
    billing_notes: store.billing_notes || "",
    last_payment_at: toDateInput(store.last_payment_at),
  };
}

async function adminRequest(path: string, pin: string, options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getPanelAuthHeaders(pin)),
      ...(options?.headers || {}),
    },
  });
  const data = await response.json();

  if (!response.ok) throw new Error(data.error || "Error guardando comercio.");

  return data;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]";

export function AdminStoreForm({ storeId }: { storeId?: string }) {
  const router = useRouter();
  const isEditing = Boolean(storeId);
  const [draft, setDraft] = useState<StoreDraft>(initialDraft);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => hasSavedPanelAuth());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingStore, setIsDeletingStore] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createdStoreId, setCreatedStoreId] = useState("");

  function updateField(field: keyof StoreDraft, value: string | boolean) {
    setDraft((current) => {
      const next = { ...current, [field]: value };

      if (field === "name" && !current.slug) {
        next.slug = slugify(String(value));
      }
      if (field === "slug") {
        next.slug = slugify(String(value));
      }
      if (field === "plan_type") {
        if (value === "monthly") next.monthly_price_usd = "20";
        if (value === "per_service") next.monthly_price_usd = "0.07";
        if (value === "trial" || value === "founder") next.monthly_price_usd = "0";
        next.subscription_status = value === "trial" ? "trial" : "active";
      }

      return next;
    });
  }

  const unlock = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      if (isEditing) {
        const data = await adminRequest(`/api/admin/stores/${storeId}`, "");
        setDraft(mapStoreToDraft(data.store));
      } else {
        await adminRequest("/api/admin/summary", "");
      }

      setIsUnlocked(true);
    } catch (error: any) {
      setError(error.message || "No se pudo validar acceso.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }, [isEditing, storeId]);

  async function saveStore() {
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const path = isEditing ? `/api/admin/stores/${storeId}` : "/api/admin/stores";
      const method = isEditing ? "PATCH" : "POST";
      const data = await adminRequest(path, "", {
        method,
        body: JSON.stringify({
          ...draft,
          access_email: isEditing ? "" : draft.access_email,
          access_password: isEditing ? "" : draft.access_password,
          access_role: isEditing ? "owner" : draft.access_role,
          usd_to_bs: Number(draft.usd_to_bs || 600),
          monthly_price_usd: Number(draft.monthly_price_usd || 0),
        }),
      });

      setMessage(data.message || (isEditing ? "Comercio actualizado." : "Comercio creado."));

      if (!isEditing && data.store?.id) {
        setCreatedStoreId(data.store.id);
        router.push(`/admin/comercios/${data.store.id}`);
      }
    } catch (error: any) {
      setError(error.message || "No se pudo guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSubscription() {
    if (!isEditing || !storeId) return;

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await adminRequest(`/api/admin/stores/${storeId}/subscription`, "", {
        method: "PATCH",
        body: JSON.stringify({
          plan_type: draft.plan_type,
          subscription_status: draft.subscription_status,
          trial_started_at: draft.trial_started_at,
          trial_ends_at: draft.trial_ends_at,
          subscription_started_at: draft.subscription_started_at,
          subscription_ends_at: draft.subscription_ends_at,
          next_payment_due_at: draft.next_payment_due_at,
          monthly_price_usd: Number(draft.monthly_price_usd || 0),
          billing_notes: draft.billing_notes,
          last_payment_at: draft.last_payment_at,
        }),
      });

      setDraft(mapStoreToDraft(data.store));
      setMessage(data.message || "Suscripcion actualizada.");
    } catch (error: any) {
      setError(error.message || "No se pudo guardar la suscripcion.");
    } finally {
      setIsSaving(false);
    }
  }

  function extendPlan(days: number) {
    const nextDate = addDaysToDateInput(
      draft.subscription_ends_at || draft.next_payment_due_at,
      days
    );
    setDraft((current) => ({
      ...current,
      subscription_status: "active",
      subscription_started_at: current.subscription_started_at || new Date().toISOString().slice(0, 10),
      subscription_ends_at: nextDate,
      next_payment_due_at: nextDate,
      last_payment_at: new Date().toISOString().slice(0, 10),
    }));
  }

  async function toggleActive() {
    if (!isEditing || !storeId) return;

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await adminRequest(
        `/api/admin/stores/${storeId}/${draft.is_active ? "pause" : "activate"}`,
        "",
        { method: "POST" }
      );

      setDraft(mapStoreToDraft(data.store));
      setMessage(data.message || "Comercio actualizado.");
    } catch (error: any) {
      setError(error.message || "No se pudo actualizar el comercio.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteStorePermanently() {
    if (!isEditing || !storeId) return;

    const confirmed = window.confirm(
      `Vas a eliminar definitivamente "${draft.name}". Esta accion no se puede deshacer.`
    );

    if (!confirmed) return;

    setIsDeletingStore(true);
    setError("");
    setMessage("");

    try {
      const data = await adminRequest(`/api/admin/stores/${storeId}`, "", {
        method: "DELETE",
        body: JSON.stringify({ adminPassword: deletePassword }),
      });

      setMessage(data.message || "Comercio eliminado.");
      router.push("/admin/comercios");
    } catch (error: any) {
      setError(error.message || "No se pudo eliminar el comercio.");
    } finally {
      setIsDeletingStore(false);
    }
  }

  useEffect(() => {
    const savedToken = getSavedPanelToken();

    if (savedToken) {
      unlock();
    } else {
      setIsCheckingAccess(false);
    }
  }, [unlock]);

  if (isCheckingAccess) {
    return (
      <section className="rounded-[34px] bg-white p-6 text-center shadow-xl shadow-[#2E3A79]/[0.07]">
        <Loader2 size={22} className="mx-auto animate-spin text-[#25262B]" />
        <p className="mt-3 text-sm font-black text-[#746f69]">Validando acceso...</p>
      </section>
    );
  }

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#25262B] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso fundador</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesion con un email fundador para crear o editar comercios.
        </p>
        <a
          href="/panel/login"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
        >
          <CheckCircle2 size={18} />
          Iniciar sesion
        </a>
        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>
    );
  }

  return (
    <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
            {isEditing ? `/${draft.slug}` : "Nuevo comercio"}
          </p>
          <h2 className="mt-1 text-3xl font-black">
            {isEditing ? draft.name || "Editar comercio" : "Crear comercio"}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {isEditing && draft.slug ? (
            <a
              href={`/${draft.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white"
            >
              <ExternalLink size={17} />
              Ver catalogo
            </a>
          ) : null}
          {isEditing ? (
            <button
              type="button"
              onClick={toggleActive}
              disabled={isSaving}
              className={[
                "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black disabled:opacity-60",
                draft.is_active ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700",
              ].join(" ")}
            >
              {draft.is_active ? <PauseCircle size={17} /> : <CheckCircle2 size={17} />}
              {draft.is_active ? "Pausar" : "Reactivar"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={saveStore}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
            Guardar
          </button>
        </div>
      </div>

      <section className="mt-6 rounded-[28px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black">
              <CreditCard size={19} className="text-[#2E3A79]" />
              Plan y suscripcion
            </h3>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Control manual de trial, vencimiento, monto y estado comercial.
            </p>
          </div>
          {isEditing ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => extendPlan(30)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-green-100 px-4 py-3 text-sm font-black text-green-700"
              >
                Extender 30 días
              </button>
              <button
                type="button"
                onClick={() => extendPlan(365)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-100 px-4 py-3 text-sm font-black text-blue-700"
              >
                Extender 1 año
              </button>
            <button
              type="button"
              onClick={saveSubscription}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25262B] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              Guardar suscripcion
            </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-4">
          <Field label="Plan">
            <select value={draft.plan_type} onChange={(event) => updateField("plan_type", event.target.value)} className={inputClass}>
              <option value="trial">Trial</option>
              <option value="monthly">Mensual $20 / tienda</option>
              <option value="per_service">Por servicio $0.07</option>
              <option value="founder">Founder</option>
            </select>
          </Field>
          <Field label="Estado">
            <select value={draft.subscription_status} onChange={(event) => updateField("subscription_status", event.target.value)} className={inputClass}>
              <option value="trial">trial</option>
              <option value="active">active</option>
              <option value="past_due">past_due</option>
              <option value="paused">paused</option>
              <option value="cancelled">cancelled</option>
              <option value="expired">expired</option>
            </select>
          </Field>
          <Field label={draft.plan_type === "per_service" ? "Costo por servicio USD" : "Monto mensual USD"}>
            <input type="number" value={draft.monthly_price_usd} onChange={(event) => updateField("monthly_price_usd", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Proximo cobro">
            <input type="date" value={draft.next_payment_due_at} onChange={(event) => updateField("next_payment_due_at", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Inicio trial">
            <input type="date" value={draft.trial_started_at} onChange={(event) => updateField("trial_started_at", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Fin trial">
            <input type="date" value={draft.trial_ends_at} onChange={(event) => updateField("trial_ends_at", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Fin suscripcion">
            <input type="date" value={draft.subscription_ends_at} onChange={(event) => updateField("subscription_ends_at", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Ultimo pago">
            <input type="date" value={draft.last_payment_at} onChange={(event) => updateField("last_payment_at", event.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Notas internas de facturacion">
          <textarea value={draft.billing_notes} onChange={(event) => updateField("billing_notes", event.target.value)} rows={2} className={inputClass} />
        </Field>
      </section>

      {!isEditing ? (
        <section className="mt-5 rounded-[28px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
          <h3 className="text-lg font-black">Acceso del comercio</h3>
          <p className="mt-1 text-sm font-bold text-[#746f69]">
            Crea o asigna el usuario que entrara al panel privado de este negocio.
          </p>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Field label="Correo de acceso">
              <input value={draft.access_email} onChange={(event) => updateField("access_email", event.target.value)} type="email" placeholder="dueno@comercio.com" className={inputClass} />
            </Field>
            <Field label="Clave inicial">
              <input value={draft.access_password} onChange={(event) => updateField("access_password", event.target.value)} type="password" placeholder="Minimo 6 caracteres" className={inputClass} />
            </Field>
            <Field label="Rol">
              <select value={draft.access_role} onChange={(event) => updateField("access_role", event.target.value)} className={inputClass}>
                <option value="owner">Dueno</option>
                <option value="admin">Administrador</option>
                <option value="staff">Staff</option>
              </select>
            </Field>
          </div>
        </section>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Field label="Nombre del comercio">
          <input value={draft.name} onChange={(event) => updateField("name", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Slug publico">
          <input value={draft.slug} onChange={(event) => updateField("slug", event.target.value)} placeholder="mi-comercio" className={inputClass} />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Field label="Rubro">
          <select value={draft.business_type} onChange={(event) => updateField("business_type", event.target.value)} className={inputClass}>
            {businessTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="WhatsApp receptor">
          <input value={draft.whatsapp} onChange={(event) => updateField("whatsapp", event.target.value)} placeholder="584245666025" className={inputClass} />
        </Field>
        <Field label="Tasa USD a Bs">
          <input type="number" value={draft.usd_to_bs} onChange={(event) => updateField("usd_to_bs", event.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Descripcion">
          <textarea value={draft.description} onChange={(event) => updateField("description", event.target.value)} rows={3} className={inputClass} />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-3">
          <Field label="Direccion">
            <input value={draft.address} onChange={(event) => updateField("address", event.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Latitud">
          <input value={draft.latitude} onChange={(event) => updateField("latitude", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Longitud">
          <input value={draft.longitude} onChange={(event) => updateField("longitude", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Horario">
          <input value={draft.opening_hours} onChange={(event) => updateField("opening_hours", event.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Field label="Metodos de pago separados por coma">
          <input value={draft.payment_methods} onChange={(event) => updateField("payment_methods", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Nota interna WhatsApp">
          <input value={draft.whatsapp_message_note} onChange={(event) => updateField("whatsapp_message_note", event.target.value)} className={inputClass} />
        </Field>
      </div>

      <section className="mt-5 rounded-[28px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
        <h3 className="text-lg font-black">Identidad visual</h3>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {(["primary_color", "accent_color", "button_text_color"] as const).map((field) => (
            <Field
              key={field}
              label={
                field === "primary_color"
                  ? "Color principal"
                  : field === "accent_color"
                    ? "Color secundario"
                    : "Texto boton"
              }
            >
              <input type="color" value={draft[field]} onChange={(event) => updateField(field, event.target.value)} className="h-12 w-full rounded-2xl border border-[#25262B]/10 bg-white px-2 py-2 outline-none" />
            </Field>
          ))}
        </div>
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        {(["accepts_delivery", "accepts_pickup", "is_active"] as const).map((field) => (
          <button
            key={field}
            type="button"
            onClick={() => updateField(field, !draft[field])}
            className={[
              "rounded-full px-4 py-2 text-xs font-black",
              draft[field] ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
            ].join(" ")}
          >
            {field === "accepts_delivery"
              ? draft[field] ? "Delivery activo" : "Delivery inactivo"
              : field === "accepts_pickup"
                ? draft[field] ? "Retiro activo" : "Retiro inactivo"
                : draft[field] ? "Comercio activo" : "Comercio pausado"}
          </button>
        ))}
      </div>

      {isEditing ? (
        <section className="mt-5 rounded-[28px] bg-red-50 p-4 ring-1 ring-red-100">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-lg font-black text-red-700">Zona peligrosa</h3>
              <p className="mt-1 text-sm font-bold text-red-700/80">
                El borrado definitivo elimina catálogo, pedidos, clientes, delivery y accesos vinculados.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[220px_auto]">
              <input
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                placeholder="Clave admin"
                className={inputClass}
              />
              <button
                type="button"
                onClick={deleteStorePermanently}
                disabled={isDeletingStore || !deletePassword}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {isDeletingStore ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                Eliminar definitivo
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {message && (
        <p className="mt-4 text-sm font-black text-green-700">
          {message}{" "}
          {createdStoreId && (
            <Link href={`/admin/comercios/${createdStoreId}`} className="text-[#2E3A79]">
              Abrir edicion
            </Link>
          )}
        </p>
      )}
      {error && <p className="mt-4 text-sm font-black text-red-600">{error}</p>}
    </section>
  );
}
