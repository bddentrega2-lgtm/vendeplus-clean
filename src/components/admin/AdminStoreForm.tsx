"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
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
  payment_methods: "Pago móvil, Transferencia, Efectivo, Binance",
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
  access_email: "",
  access_password: "",
  access_role: "owner",
};

const businessTypes = [
  { value: "food", label: "Comida / Restaurante" },
  { value: "fashion", label: "Ropa / Moda" },
  { value: "accessories", label: "Accesorios" },
  { value: "tech", label: "Tecnología" },
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

function mapStoreToDraft(store: any): StoreDraft {
  return {
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
    access_email: "",
    access_password: "",
    access_role: "owner",
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

export function AdminStoreForm({ storeId }: { storeId?: string }) {
  const router = useRouter();
  const isEditing = Boolean(storeId);
  const [draft, setDraft] = useState<StoreDraft>(initialDraft);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => hasSavedPanelAuth());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createdStoreId, setCreatedStoreId] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  function updateField(field: keyof StoreDraft, value: string | boolean) {
    setDraft((current) => {
      const next = { ...current, [field]: value };

      if (field === "name" && !current.slug) {
        next.slug = slugify(String(value));
      }

      if (field === "slug") {
        next.slug = slugify(String(value));
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

  async function deleteStore() {
    if (!isEditing || !storeId || deleteConfirm.trim() !== draft.slug) {
      setError("Para eliminar, escribe exactamente el slug del comercio.");
      return;
    }

    setIsDeleting(true);
    setError("");
    setMessage("");

    try {
      const data = await adminRequest(`/api/admin/stores/${storeId}`, "", {
        method: "DELETE",
        body: JSON.stringify({ confirmSlug: deleteConfirm.trim() }),
      });

      setMessage(data.message || "Comercio eliminado.");
      router.push("/admin/comercios");
    } catch (error: any) {
      setError(error.message || "No se pudo eliminar el comercio.");
    } finally {
      setIsDeleting(false);
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
          Inicia sesión con un email fundador para crear o editar comercios.
        </p>
        <a
          href="/panel/login"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
        >
          <CheckCircle2 size={18} />
          Iniciar sesión
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
          {isEditing && draft.slug && (
            <a
              href={`/${draft.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white"
            >
              <ExternalLink size={17} />
              Ver catálogo
            </a>
          )}
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

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Nombre del comercio
          </span>
          <input
            value={draft.name}
            onChange={(event) => updateField("name", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Slug público
          </span>
          <input
            value={draft.slug}
            onChange={(event) => updateField("slug", event.target.value)}
            placeholder="mi-comercio"
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
          />
        </label>
      </div>

      {!isEditing ? (
        <section className="mt-5 rounded-[28px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-start">
            <div>
              <h3 className="text-lg font-black">Acceso del comercio</h3>
              <p className="mt-1 text-sm font-bold text-[#746f69]">
                Crea el usuario que entrara al panel privado de este negocio.
              </p>
            </div>
            <span className="w-fit rounded-full bg-white px-3 py-2 text-xs font-black text-[#2E3A79]">
              /panel/login
            </span>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Correo de acceso
              </span>
              <input
                value={draft.access_email}
                onChange={(event) => updateField("access_email", event.target.value)}
                type="email"
                placeholder="dueno@comercio.com"
                className="w-full rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Clave inicial
              </span>
              <input
                value={draft.access_password}
                onChange={(event) => updateField("access_password", event.target.value)}
                type="password"
                placeholder="Minimo 6 caracteres"
                className="w-full rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Rol
              </span>
              <select
                value={draft.access_role}
                onChange={(event) => updateField("access_role", event.target.value)}
                className="w-full rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
              >
                <option value="owner">Dueno</option>
                <option value="admin">Administrador</option>
                <option value="operator">Operador</option>
              </select>
            </label>
          </div>
        </section>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Rubro
          </span>
          <select
            value={draft.business_type}
            onChange={(event) => updateField("business_type", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
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
            WhatsApp receptor
          </span>
          <input
            value={draft.whatsapp}
            onChange={(event) => updateField("whatsapp", event.target.value)}
            placeholder="584245666025"
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Tasa USD a Bs
          </span>
          <input
            type="number"
            value={draft.usd_to_bs}
            onChange={(event) => updateField("usd_to_bs", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
          />
        </label>
      </div>

      <label className="mt-4 block space-y-1">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
          Descripción
        </span>
        <textarea
          value={draft.description}
          onChange={(event) => updateField("description", event.target.value)}
          rows={3}
          className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
        />
      </label>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <label className="space-y-1 xl:col-span-3">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Dirección
          </span>
          <input
            value={draft.address}
            onChange={(event) => updateField("address", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Latitud
          </span>
          <input
            value={draft.latitude}
            onChange={(event) => updateField("latitude", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Longitud
          </span>
          <input
            value={draft.longitude}
            onChange={(event) => updateField("longitude", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Horario
          </span>
          <input
            value={draft.opening_hours}
            onChange={(event) => updateField("opening_hours", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Métodos de pago separados por coma
          </span>
          <input
            value={draft.payment_methods}
            onChange={(event) => updateField("payment_methods", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Nota interna WhatsApp
          </span>
          <input
            value={draft.whatsapp_message_note}
            onChange={(event) => updateField("whatsapp_message_note", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
          />
        </label>
      </div>

      <section className="mt-5 rounded-[28px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
        <h3 className="text-lg font-black">Identidad visual</h3>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {(["primary_color", "accent_color", "button_text_color"] as const).map((field) => (
            <label key={field} className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                {field === "primary_color"
                  ? "Color principal"
                  : field === "accent_color"
                    ? "Color secundario"
                    : "Texto botón"}
              </span>
              <input
                type="color"
                value={draft[field]}
                onChange={(event) => updateField(field, event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#25262B]/10 bg-white px-2 py-2 outline-none"
              />
            </label>
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
                ? draft[field] ? "Retiro (pick up) activo" : "Retiro (pick up) inactivo"
                : draft[field] ? "Comercio activo" : "Comercio oculto"}
          </button>
        ))}
      </div>

      {isEditing ? (
        <section className="mt-6 rounded-[28px] border border-red-200 bg-red-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-black text-red-700">
                <AlertTriangle size={19} />
                Eliminar comercio
              </h3>
              <p className="mt-1 max-w-2xl text-sm font-bold leading-relaxed text-red-700/80">
                Esta acci&oacute;n elimina el comercio, productos, categor&iacute;as,
                pedidos, clientes, configuraci&oacute;n de delivery y asignaciones.
                Los usuarios de acceso no se borran de Auth.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-red-700">
              Permanente
            </span>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-red-700">
                Escribe el slug para confirmar: {draft.slug}
              </span>
              <input
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-red-500"
                placeholder={draft.slug}
              />
            </label>

            <button
              type="button"
              onClick={deleteStore}
              disabled={isDeleting || deleteConfirm.trim() !== draft.slug}
              className="inline-flex items-center justify-center gap-2 self-end rounded-full bg-red-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isDeleting ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
              Eliminar definitivamente
            </button>
          </div>
        </section>
      ) : null}

      {message && (
        <p className="mt-4 text-sm font-black text-green-700">
          {message}{" "}
          {createdStoreId && (
            <Link href={`/admin/comercios/${createdStoreId}`} className="text-[#2E3A79]">
              Abrir edición
            </Link>
          )}
        </p>
      )}
      {error && <p className="mt-4 text-sm font-black text-red-600">{error}</p>}
    </section>
  );
}
