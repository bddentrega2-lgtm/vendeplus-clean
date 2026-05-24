"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCcw,
  Save,
  Settings,
  Store,
} from "lucide-react";

type StoreRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  business_type: string | null;
  whatsapp: string | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  opening_hours: string | null;
  delivery_estimate: string | null;
  pickup_estimate: string | null;
  payment_methods: string[] | null;
  usd_to_bs: number | string | null;
  whatsapp_message_note: string | null;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  is_active: boolean;
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

function getSavedToken() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("vendeplus_panel_token") || "";
}

function getSavedPin() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("vendeplus_panel_pin") || "";
}

async function apiRequest(pin: string, options?: RequestInit) {
  const token = getSavedToken();

  const response = await fetch("/api/panel/settings", {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : { "x-panel-pin": pin }),
      ...(options?.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error cargando configuración.");
  }

  return data;
}

function StoreSettingsCard({
  store,
  pin,
  onSaved,
}: {
  store: StoreRow;
  pin: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    id: store.id,
    name: store.name || "",
    description: store.description || "",
    business_type: store.business_type || "general",
    whatsapp: store.whatsapp || "",
    address: store.address || "",
    latitude: String(store.latitude || ""),
    longitude: String(store.longitude || ""),
    cover_image_url: store.cover_image_url || "",
    logo_url: store.logo_url || "",
    opening_hours: store.opening_hours || "Disponible hoy",
    delivery_estimate: store.delivery_estimate || "25-40 min",
    pickup_estimate: store.pickup_estimate || "15-25 min",
    payment_methods: Array.isArray(store.payment_methods)
      ? store.payment_methods.join(", ")
      : "Pago móvil, Transferencia, Efectivo, Binance",
    usd_to_bs: String(store.usd_to_bs || 600),
    whatsapp_message_note: store.whatsapp_message_note || "",
    accepts_delivery: store.accepts_delivery !== false,
    accepts_pickup: store.accepts_pickup !== false,
    is_active: store.is_active !== false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  function updateField(field: string, value: any) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveSettings() {
    setIsSaving(true);
    setMessage("");

    try {
      await apiRequest(pin, {
        method: "PATCH",
        body: JSON.stringify({
          ...draft,
          payment_methods: draft.payment_methods,
          usd_to_bs: Number(draft.usd_to_bs || 600),
        }),
      });

      setMessage("Configuración guardada correctamente.");
      onSaved();
    } catch (error: any) {
      setMessage(error.message || "No se pudo guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
            {store.slug}
          </p>
          <h2 className="mt-1 text-3xl font-black">{draft.name}</h2>
          <p className="mt-2 text-sm font-bold text-[#746f69]">
            Configuración multi-rubro del comercio.
          </p>
        </div>

        <button
          type="button"
          onClick={saveSettings}
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          Guardar cambios
        </button>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Nombre del comercio
          </span>
          <input
            value={draft.name}
            onChange={(event) => updateField("name", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Rubro
          </span>
          <select
            value={draft.business_type}
            onChange={(event) => updateField("business_type", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          >
            {businessTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4">
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Descripción
          </span>
          <textarea
            value={draft.description}
            onChange={(event) => updateField("description", event.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            WhatsApp receptor
          </span>
          <input
            value={draft.whatsapp}
            onChange={(event) => updateField("whatsapp", event.target.value)}
            placeholder="584245666025"
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Horario
          </span>
          <input
            value={draft.opening_hours}
            onChange={(event) => updateField("opening_hours", event.target.value)}
            placeholder="Lunes a sábado, 10am - 8pm"
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
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
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </label>
      </div>

      <div className="mt-4">
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Dirección
          </span>
          <input
            value={draft.address}
            onChange={(event) => updateField("address", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-4">
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Latitud
          </span>
          <input
            value={draft.latitude}
            onChange={(event) => updateField("latitude", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Longitud
          </span>
          <input
            value={draft.longitude}
            onChange={(event) => updateField("longitude", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Tiempo delivery
          </span>
          <input
            value={draft.delivery_estimate}
            onChange={(event) => updateField("delivery_estimate", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Tiempo pickup
          </span>
          <input
            value={draft.pickup_estimate}
            onChange={(event) => updateField("pickup_estimate", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
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
            placeholder="Pago móvil, Transferencia, Efectivo, Binance"
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Imagen de portada URL
          </span>
          <input
            value={draft.cover_image_url}
            onChange={(event) => updateField("cover_image_url", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </label>
      </div>

      <div className="mt-4">
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Nota interna para WhatsApp
          </span>
          <textarea
            value={draft.whatsapp_message_note}
            onChange={(event) => updateField("whatsapp_message_note", event.target.value)}
            rows={2}
            placeholder="Ej: Confirmar disponibilidad antes de preparar."
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateField("accepts_delivery", !draft.accepts_delivery)}
          className={[
            "rounded-full px-4 py-2 text-xs font-black",
            draft.accepts_delivery ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
          ].join(" ")}
        >
          {draft.accepts_delivery ? "Delivery activo" : "Delivery inactivo"}
        </button>

        <button
          type="button"
          onClick={() => updateField("accepts_pickup", !draft.accepts_pickup)}
          className={[
            "rounded-full px-4 py-2 text-xs font-black",
            draft.accepts_pickup ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700",
          ].join(" ")}
        >
          {draft.accepts_pickup ? "Pickup activo" : "Pickup inactivo"}
        </button>

        <button
          type="button"
          onClick={() => updateField("is_active", !draft.is_active)}
          className={[
            "rounded-full px-4 py-2 text-xs font-black",
            draft.is_active ? "bg-[#FFB547] text-[#25262B]" : "bg-red-100 text-red-700",
          ].join(" ")}
        >
          {draft.is_active ? "Comercio activo" : "Comercio oculto"}
        </button>
      </div>

      {message && <p className="mt-4 text-sm font-black text-[#2E3A79]">{message}</p>}
    </section>
  );
}

export function ConfigManager() {
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadConfig(currentPin: string) {
    setIsLoading(true);
    setError("");

    try {
      const data = await apiRequest(currentPin);
      setStores(data.stores || []);
      setIsUnlocked(true);

      if (currentPin) {
        sessionStorage.setItem("vendeplus_panel_pin", currentPin);
      }
    } catch (error: any) {
      setError(error.message || "No se pudo cargar la configuración.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const savedPin = getSavedPin();
    const savedToken = getSavedToken();

    if (savedPin || savedToken) {
      setPin(savedPin);
      loadConfig(savedPin);
    }
  }, []);

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso a configuración</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesión o usa el PIN temporal para editar comercios asignados.
        </p>

        <input
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="PIN de acceso"
          type="password"
          className="mt-5 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-center text-lg font-black outline-none focus:border-[#2E3A79]"
        />

        <button
          type="button"
          onClick={() => loadConfig(pin)}
          disabled={isLoading}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          Entrar
        </button>

        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[34px] bg-[#25262B] p-5 text-white shadow-xl shadow-[#25262B]/20">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
              Configuración multi-rubro
            </p>
            <h2 className="mt-2 text-3xl font-black">Comercios asignados</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-white/70">
              Edita datos comerciales, tipo de negocio, métodos de pago, tiempos y operación.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadConfig(pin)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
          >
            <RefreshCcw size={16} />
            Actualizar
          </button>
        </div>
      </section>

      {stores.map((store) => (
        <StoreSettingsCard
          key={store.id}
          store={store}
          pin={pin}
          onSaved={() => loadConfig(pin)}
        />
      ))}

      {stores.length === 0 && (
        <section className="rounded-[34px] bg-white p-6 text-sm font-bold text-[#746f69] shadow-xl shadow-[#2E3A79]/[0.07]">
          No tienes comercios asignados.
        </section>
      )}
    </div>
  );
}
