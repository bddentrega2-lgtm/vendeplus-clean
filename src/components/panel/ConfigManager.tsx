"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Lock,
  MapPin,
  RefreshCcw,
  Copy,
  ExternalLink,
  ImageIcon,
  Save,
  Upload,
} from "lucide-react";
import { PanelAccessGate, PanelModuleSkeleton } from "@/components/panel/PanelLoadingState";
import { LocationPicker } from "@/components/public/LocationPicker";
import {
  getPanelAccessToken,
  getPanelAuthHeaders,
  getSavedPanelPin,
  hasSavedPanelAuth,
  savePanelPin,
  shouldShowPanelInitialAccessGate,
} from "@/lib/panel/client-auth";
import { compressImageForUpload } from "@/lib/images/client-compress";
import type {
  BusinessDayKey,
  BusinessHours,
  DeliveryLocation,
  ManualOpenStatus,
  StorePaymentDetails,
} from "@/types";

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
  location_link?: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  opening_hours: string | null;
  delivery_estimate: string | null;
  pickup_estimate: string | null;
  payment_methods: string[] | null;
  payment_details: StorePaymentDetails | null;
  usd_to_bs: number | string | null;
  base_currency?: "USD" | "EUR" | string | null;
  business_hours?: BusinessHours | null;
  manual_open_status?: ManualOpenStatus | string | null;
  manual_open_note?: string | null;
  exchange_rate_source?: string | null;
  exchange_rate_updated_at?: string | null;
  whatsapp_message_note: string | null;
  primary_color: string | null;
  accent_color: string | null;
  button_text_color: string | null;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  is_active: boolean;
};

type GeocodeResult = {
  label: string;
  latitude: number;
  longitude: number;
  source: string;
  locationLink: string;
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

const businessDayOptions: Array<{ key: BusinessDayKey; label: string }> = [
  { key: "mon", label: "Lun" },
  { key: "tue", label: "Mar" },
  { key: "wed", label: "Mié" },
  { key: "thu", label: "Jue" },
  { key: "fri", label: "Vie" },
  { key: "sat", label: "Sáb" },
  { key: "sun", label: "Dom" },
];

function normalizeBusinessHours(value: unknown): BusinessHours {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as BusinessHours;
}

function getBusinessDayRange(hours: BusinessHours, day: BusinessDayKey) {
  const range = hours[day]?.[0];
  return {
    enabled: range?.enabled === true,
    open: range?.open || "09:00",
    close: range?.close || "18:00",
  };
}

const defaultPaymentMethodOptions = [
  "Pago móvil",
  "Transferencia",
  "Efectivo",
  "Binance",
  "Zelle",
];

const emptyPaymentDetails: StorePaymentDetails = {
  pagoMovil: {
    bank: "",
    phone: "",
    idNumber: "",
    holder: "",
  },
  transferencia: {
    bank: "",
    accountNumber: "",
    idNumber: "",
    holder: "",
  },
  zelle: {
    contact: "",
    holder: "",
  },
  binance: {
    contact: "",
    holder: "",
  },
  efectivo: {
    note: "",
  },
};

function mergePaymentDetails(value?: StorePaymentDetails | null): StorePaymentDetails {
  return {
    pagoMovil: {
      ...emptyPaymentDetails.pagoMovil,
      ...(value?.pagoMovil || {}),
    },
    transferencia: {
      ...emptyPaymentDetails.transferencia,
      ...(value?.transferencia || {}),
    },
    zelle: {
      ...emptyPaymentDetails.zelle,
      ...(value?.zelle || {}),
    },
    binance: {
      ...emptyPaymentDetails.binance,
      ...(value?.binance || {}),
    },
    efectivo: {
      ...emptyPaymentDetails.efectivo,
      ...(value?.efectivo || {}),
    },
  };
}

async function apiRequest(pin: string, options?: RequestInit) {
  const response = await fetch("/api/panel/settings", {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getPanelAuthHeaders(pin)),
      ...(options?.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error cargando configuración.");
  }

  return data;
}

async function uploadStoreAsset(
  file: File,
  storeId: string,
  assetName: string,
  pin: string
) {
  const uploadFile = await compressImageForUpload(file);
  const formData = new FormData();
  formData.append("file", uploadFile);
  formData.append("store_id", storeId);
  formData.append("product_id", assetName);

  const response = await fetch("/api/panel/uploads", {
    method: "POST",
    headers: await getPanelAuthHeaders(pin),
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "No se pudo subir la imagen.");
  }

  return data as { path: string; publicUrl: string };
}

function StoreSettingsCard({
  store,
  pin,
  paymentDetailsAvailable,
  onSaved,
}: {
  store: StoreRow;
  pin: string;
  paymentDetailsAvailable: boolean;
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
      ? store.payment_methods
      : ["Pago móvil", "Transferencia", "Efectivo", "Binance"],
    payment_details: mergePaymentDetails(store.payment_details),
    usd_to_bs: String(store.usd_to_bs || 600),
    base_currency:
      String(store.base_currency || "USD").toUpperCase() === "EUR" ? "EUR" : "USD",
    business_hours: normalizeBusinessHours(store.business_hours),
    manual_open_status:
      store.manual_open_status === "open" || store.manual_open_status === "closed"
        ? store.manual_open_status
        : "auto",
    manual_open_note: store.manual_open_note || "",
    exchange_rate_source: store.exchange_rate_source || "",
    exchange_rate_updated_at: store.exchange_rate_updated_at || "",
    location_link: store.location_link || "",
    whatsapp_message_note: store.whatsapp_message_note || "",
    primary_color: store.primary_color || "#2E3A79",
    accent_color: store.accent_color || "#FFB547",
    button_text_color: store.button_text_color || "#25262B",
    accepts_delivery: store.accepts_delivery === true,
    accepts_pickup: store.accepts_pickup !== false,
    is_active: store.is_active !== false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [addressResults, setAddressResults] = useState<GeocodeResult[]>([]);
  const [message, setMessage] = useState("");
  const [customPaymentMethod, setCustomPaymentMethod] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  function updateField(field: string, value: any) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateBusinessDay(day: BusinessDayKey, patch: Partial<{ enabled: boolean; open: string; close: string }>) {
    setDraft((current) => {
      const existing = getBusinessDayRange(current.business_hours, day);
      const next = { ...existing, ...patch };

      return {
        ...current,
        business_hours: {
          ...current.business_hours,
          [day]: next.enabled ? [next] : [],
        },
      };
    });
  }

  function updatePaymentDetail(
    section: keyof StorePaymentDetails,
    field: string,
    value: string
  ) {
    setDraft((current) => ({
      ...current,
      payment_details: {
        ...current.payment_details,
        [section]: {
          ...(current.payment_details?.[section] || {}),
          [field]: value,
        },
      },
    }));
  }

  function togglePaymentMethod(method: string) {
    setDraft((current) => {
      const exists = current.payment_methods.includes(method);
      return {
        ...current,
        payment_methods: exists
          ? current.payment_methods.filter((item) => item !== method)
          : [...current.payment_methods, method],
      };
    });
  }

  function addCustomPaymentMethod() {
    const method = customPaymentMethod.trim();
    if (!method) return;

    setDraft((current) => ({
      ...current,
      payment_methods: current.payment_methods.includes(method)
        ? current.payment_methods
        : [...current.payment_methods, method],
    }));
    setCustomPaymentMethod("");
  }

  function removePaymentMethod(method: string) {
    setDraft((current) => ({
      ...current,
      payment_methods: current.payment_methods.filter((item) => item !== method),
    }));
  }

  async function copyStoreLink() {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${baseUrl}/${store.slug}`;

    await navigator.clipboard.writeText(url);
    setMessage("Link público copiado.");
  }

  async function saveSettings() {
    setIsSaving(true);
    setMessage("");

    try {
      const data = await apiRequest(pin, {
        method: "PATCH",
        body: JSON.stringify({
          ...draft,
          primary_color: "#2E3A79",
          accent_color: "#FFB547",
          button_text_color: "#25262B",
          payment_methods: draft.payment_methods,
          payment_details: draft.payment_details,
          usd_to_bs: Number(draft.usd_to_bs || 600),
          base_currency: draft.base_currency,
          exchange_rate_source: draft.exchange_rate_source,
          exchange_rate_updated_at: draft.exchange_rate_updated_at,
          location_link: draft.location_link,
        }),
      });

      setMessage(data.warning || "Configuración guardada correctamente.");
      onSaved();
    } catch (error: any) {
      setMessage(error.message || "No se pudo guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadLogo(file?: File) {
    if (!file) return;

    setIsUploadingLogo(true);
    setMessage("Subiendo logo...");

    try {
      const data = await uploadStoreAsset(file, store.id, "store-logo", pin);
      setDraft((current) => ({ ...current, logo_url: data.publicUrl }));
      setMessage("Logo subido. Presiona Guardar cambios para aplicarlo.");
    } catch (error: any) {
      setMessage(error.message || "No se pudo subir el logo.");
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function refreshExchangeRate() {
    setIsFetchingRate(true);
    setMessage("Consultando tasa automática...");

    try {
      const response = await fetch(
        `/api/panel/exchange-rate?currency=${draft.base_currency}`,
        { headers: await getPanelAuthHeaders(pin) }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo consultar la tasa.");
      }

      setDraft((current) => ({
        ...current,
        usd_to_bs: String(Number(data.rate || current.usd_to_bs).toFixed(2)),
        exchange_rate_source: data.source || "api",
        exchange_rate_updated_at: data.updatedAt || new Date().toISOString(),
      }));
      setMessage("Tasa actualizada. Presiona Guardar cambios para aplicarla.");
    } catch (error: any) {
      setMessage(error.message || "No se pudo actualizar la tasa.");
    } finally {
      setIsFetchingRate(false);
    }
  }

  async function searchAddress() {
    const query = draft.address.trim();

    if (query.length < 3) {
      setMessage("Escribe al menos 3 caracteres para buscar una dirección.");
      return;
    }

    setIsSearchingAddress(true);
    setMessage("Buscando direcciones...");

    try {
      const response = await fetch(
        `/api/panel/geocode?q=${encodeURIComponent(query)}`,
        { headers: await getPanelAuthHeaders(pin) }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo buscar la dirección.");
      }

      setAddressResults(data.results || []);
      setMessage(
        data.results?.length
          ? "Elige una ubicación sugerida para llenar el mapa."
          : "No encontré sugerencias. Puedes pegar un link de Maps o colocar coordenadas."
      );
    } catch (error: any) {
      setMessage(error.message || "No se pudo buscar la dirección.");
    } finally {
      setIsSearchingAddress(false);
    }
  }

  function applyAddressResult(result: GeocodeResult) {
    setDraft((current) => ({
      ...current,
      address: result.label,
      latitude: String(result.latitude),
      longitude: String(result.longitude),
      location_link: result.locationLink,
    }));
    setAddressResults([]);
    setMessage("Ubicación aplicada. Presiona Guardar cambios para dejarla activa.");
  }

  async function uploadCover(file?: File) {
    if (!file) return;

    setIsUploadingCover(true);
    setMessage("Subiendo portada...");

    try {
      const data = await uploadStoreAsset(file, store.id, "store-cover", pin);
      setDraft((current) => ({ ...current, cover_image_url: data.publicUrl }));
      setMessage("Portada subida. Presiona Guardar cambios para aplicarla.");
    } catch (error: any) {
      setMessage(error.message || "No se pudo subir la portada.");
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  const parsedLatitude = Number(draft.latitude);
  const parsedLongitude = Number(draft.longitude);
  const hasStoreLocation =
    Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude);
  const mapLatitude = hasStoreLocation ? parsedLatitude : 10.4806;
  const mapLongitude = hasStoreLocation ? parsedLongitude : -66.9036;
  const selectedStoreLocation: DeliveryLocation | null = hasStoreLocation
    ? {
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        label: draft.address || "Ubicacion del negocio",
        source: "map",
      }
    : null;
  const activeBusinessDaysCount = businessDayOptions.filter(
    (day) => getBusinessDayRange(draft.business_hours, day.key).enabled
  ).length;

  function applyStoreLocation(location: DeliveryLocation) {
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;

    setDraft((current) => ({
      ...current,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      address: current.address || location.label,
      location_link: mapsLink,
    }));
    setMessage("Ubicacion del negocio aplicada. Presiona Guardar cambios para dejarla activa.");
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
            Configuración del negocio.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`/${store.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white"
          >
            <ExternalLink size={17} />
            Ver catálogo público
          </a>

          <button
            type="button"
            onClick={copyStoreLink}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F8F3E8] px-5 py-3 text-sm font-black text-[#2E3A79]"
          >
            <Copy size={17} />
            Copiar link
          </button>

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
          <span className="block text-[11px] font-bold text-[#746f69]">
            Este texto se muestra al cliente. El cierre automatico por horario requiere el modulo de horarios.
          </span>
        </label>

        <div className="rounded-2xl border border-[#25262B]/10 p-3">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Estado del negocio
          </span>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              ["auto", "Según horario"],
              ["open", "Forzar abierto"],
              ["closed", "Cerrar ahora"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => updateField("manual_open_status", value)}
                className={[
                  "rounded-full px-3 py-2 text-xs font-black",
                  draft.manual_open_status === value
                    ? "bg-[#2E3A79] text-white"
                    : "bg-[#F8F3E8] text-[#746f69]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            value={draft.manual_open_note}
            onChange={(event) => updateField("manual_open_note", event.target.value)}
            placeholder="Nota visible: Cerramos por lluvia, volvemos a las 5pm..."
            className="mt-3 w-full rounded-xl border border-[#25262B]/10 px-3 py-2 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </div>

        <div className="rounded-2xl border border-[#25262B]/10 p-3">
          <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Moneda
              </span>
              <select
                value={draft.base_currency}
                onChange={(event) => updateField("base_currency", event.target.value)}
                className="w-full rounded-xl border border-[#25262B]/10 px-3 py-2 text-sm font-black outline-none focus:border-[#2E3A79]"
              >
                <option value="USD">Dólar</option>
                <option value="EUR">Euro</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Tasa a Bs
              </span>
              <input
                type="number"
                value={draft.usd_to_bs}
                onChange={(event) => updateField("usd_to_bs", event.target.value)}
                className="w-full rounded-xl border border-[#25262B]/10 px-3 py-2 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={refreshExchangeRate}
            disabled={isFetchingRate}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-4 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            {isFetchingRate ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCcw size={14} />
            )}
            Actualizar tasa BCV
          </button>
          {draft.exchange_rate_updated_at ? (
            <p className="mt-2 truncate text-[11px] font-bold text-[#746f69]">
              Fuente API: {draft.exchange_rate_source || "configurada"}
            </p>
          ) : null}
        </div>
      </div>

      <section className="mt-4 rounded-[28px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
        <div className="grid gap-4 md:grid-cols-[120px_1fr] md:items-center">
          <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-3xl bg-white">
            {draft.logo_url ? (
              <img
                src={draft.logo_url}
                alt={`Logo de ${draft.name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon size={30} className="text-[#746f69]" />
            )}
          </div>

          <div>
            <h3 className="text-lg font-black text-[#25262B]">Logo del comercio</h3>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Sube una imagen desde tu equipo y luego guarda los cambios.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => uploadLogo(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={isUploadingLogo}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
              >
                {isUploadingLogo ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                Subir logo
              </button>
              {draft.logo_url && (
                <button
                  type="button"
                  onClick={() => updateField("logo_url", "")}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#2E3A79]"
                >
                  Quitar logo
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4">
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Dirección
          </span>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              value={draft.address}
              onChange={(event) => updateField("address", event.target.value)}
              placeholder="Ej: C.C. Las Américas, Maracay"
              className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />
            <button
              type="button"
              onClick={searchAddress}
              disabled={isSearchingAddress}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {isSearchingAddress ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <MapPin size={16} />
              )}
              Buscar
            </button>
          </div>
        </label>

        {addressResults.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {addressResults.map((result) => (
              <button
                key={`${result.latitude}-${result.longitude}-${result.label}`}
                type="button"
                onClick={() => applyAddressResult(result)}
                className="rounded-2xl bg-[#F8F3E8] p-3 text-left text-sm font-bold leading-relaxed text-[#25262B] ring-1 ring-[#25262B]/[0.06] transition hover:bg-white"
              >
                <span className="block font-black">{result.label}</span>
                <span className="text-xs text-[#746f69]">
                  {result.latitude.toFixed(6)}, {result.longitude.toFixed(6)}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
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
            Tiempo de Delivery
          </span>
          <input
            value={draft.delivery_estimate}
            onChange={(event) => updateField("delivery_estimate", event.target.value)}
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </label>

      </div>

      <details className="group mt-4 rounded-[28px] bg-white p-4 ring-1 ring-[#25262B]/10">
        <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-[#25262B]">Horario automático</h3>
            <p className="text-sm font-bold text-[#746f69]">
              {activeBusinessDaysCount
                ? `${activeBusinessDaysCount} día${activeBusinessDaysCount === 1 ? "" : "s"} activo${activeBusinessDaysCount === 1 ? "" : "s"}`
                : "Sin horario automático configurado"}
            </p>
          </div>
          <span className="inline-flex items-center justify-center rounded-full bg-[#F8F3E8] px-4 py-2 text-xs font-black text-[#2E3A79]">
            Configurar horario
          </span>
        </summary>
        <div className="mt-4 border-t border-[#25262B]/10 pt-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-[#746f69]">
              Activa solo los días donde el negocio debe recibir pedidos.
            </p>
            <span className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black text-[#746f69]">
              Hora Venezuela
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {businessDayOptions.map((day) => {
              const range = getBusinessDayRange(draft.business_hours, day.key);
              return (
                <div
                  key={day.key}
                  className="grid gap-2 rounded-2xl bg-[#F8F3E8] p-3 sm:grid-cols-[74px_1fr_1fr_auto] sm:items-center"
                >
                  <span className="text-sm font-black text-[#25262B]">{day.label}</span>
                  <input
                    type="time"
                    value={range.open}
                    onChange={(event) => updateBusinessDay(day.key, { open: event.target.value, enabled: true })}
                    className="rounded-xl border border-[#25262B]/10 bg-white px-3 py-2 text-sm font-black outline-none"
                  />
                  <input
                    type="time"
                    value={range.close}
                    onChange={(event) => updateBusinessDay(day.key, { close: event.target.value, enabled: true })}
                    className="rounded-xl border border-[#25262B]/10 bg-white px-3 py-2 text-sm font-black outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateBusinessDay(day.key, { enabled: !range.enabled })}
                    className={[
                      "rounded-full px-4 py-2 text-xs font-black",
                      range.enabled
                        ? "bg-green-100 text-green-700"
                        : "bg-white text-[#746f69]",
                    ].join(" ")}
                  >
                    {range.enabled ? "Activo" : "Inactivo"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </details>

      <section className="mt-4 rounded-[28px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-[#25262B]">Ubicacion en mapa</h3>
            <p className="text-sm font-bold text-[#746f69]">
              Usa GPS o toca el punto exacto del negocio para calcular rutas y delivery.
            </p>
          </div>
          {hasStoreLocation ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#2E3A79]">
              {parsedLatitude.toFixed(5)}, {parsedLongitude.toFixed(5)}
            </span>
          ) : null}
        </div>
        <div className="mt-3">
          <LocationPicker
            mode="store"
            storeLatitude={mapLatitude}
            storeLongitude={mapLongitude}
            value={selectedStoreLocation}
            onChange={applyStoreLocation}
          />
        </div>
      </section>

      <section className="mt-4 rounded-[28px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
        <h3 className="text-lg font-black text-[#25262B]">Métodos de pago activos</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {defaultPaymentMethodOptions.map((method) => {
            const active = draft.payment_methods.includes(method);
            return (
              <button
                key={method}
                type="button"
                onClick={() => togglePaymentMethod(method)}
                className={[
                  "rounded-full px-4 py-2 text-xs font-black",
                  active ? "bg-[#2E3A79] text-white" : "bg-white text-[#746f69]",
                ].join(" ")}
              >
                {active ? "Activo · " : "Agregar · "}
              {method}
            </button>
          );
        })}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={customPaymentMethod}
            onChange={(event) => setCustomPaymentMethod(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomPaymentMethod();
              }
            }}
            placeholder="Agregar otro método: Reserve, punto de venta, PayPal..."
            className="rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
          <button
            type="button"
            onClick={addCustomPaymentMethod}
            className="rounded-2xl bg-[#2E3A79] px-5 py-3 text-sm font-black text-white"
          >
            Agregar método
          </button>
        </div>
        {draft.payment_methods.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.payment_methods.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => removePaymentMethod(method)}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#746f69]"
              >
                Quitar · {method}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-[28px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
        <div className="grid gap-4 md:grid-cols-[180px_1fr] md:items-center">
          <div className="overflow-hidden rounded-3xl bg-white">
            {draft.cover_image_url ? (
              <img
                src={draft.cover_image_url}
                alt={`Portada de ${draft.name}`}
                className="h-32 w-full object-cover"
              />
            ) : (
              <div className="grid h-32 place-items-center text-[#746f69]">
                <ImageIcon size={30} />
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-black text-[#25262B]">Imagen de portada</h3>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Sube una portada desde tu equipo para el catálogo público.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => uploadCover(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploadingCover}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
              >
                {isUploadingCover ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Subir portada
              </button>
              {draft.cover_image_url && (
                <button
                  type="button"
                  onClick={() => updateField("cover_image_url", "")}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#2E3A79]"
                >
                  Quitar portada
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4">
        <label className="space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            Link de ubicación
          </span>
          <input
            value={draft.location_link}
            onChange={(event) => updateField("location_link", event.target.value)}
            placeholder="Pega aquí un enlace de Google Maps con el punto del comercio"
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </label>
        <p className="mt-2 text-xs font-bold text-[#746f69]">
          Al guardar, si el enlace trae coordenadas, Vende+ actualizará latitud y longitud automáticamente.
        </p>
      </div>

      <section className="mt-4 rounded-[28px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-2 xl:flex-row xl:items-start">
          <div>
            <h3 className="text-xl font-black text-[#25262B]">Datos de pago</h3>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Agrega tus datos de pago para que tus clientes puedan pagar más rápido.
            </p>
          </div>
          <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#2E3A79]">
            Se muestran después de confirmar el pedido
          </span>
        </div>

        {!paymentDetailsAvailable ? (
          <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-black leading-relaxed text-red-700 ring-1 ring-red-100">
            Los datos de pago todavía no se pueden guardar porque falta aplicar la migración de pagos en Supabase. Puedes editar otros datos del comercio, pero estos datos seguirán sin aparecer en el checkout hasta aplicar esa migración y volver a guardar.
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] bg-white p-4">
            <h4 className="text-lg font-black text-[#25262B]">Pago móvil</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={draft.payment_details.pagoMovil?.bank || ""}
                onChange={(event) => updatePaymentDetail("pagoMovil", "bank", event.target.value)}
                placeholder="Banco"
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
              <input
                value={draft.payment_details.pagoMovil?.phone || ""}
                onChange={(event) => updatePaymentDetail("pagoMovil", "phone", event.target.value)}
                placeholder="Teléfono"
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
              <input
                value={draft.payment_details.pagoMovil?.idNumber || ""}
                onChange={(event) => updatePaymentDetail("pagoMovil", "idNumber", event.target.value)}
                placeholder="Cédula/RIF"
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
              <input
                value={draft.payment_details.pagoMovil?.holder || ""}
                onChange={(event) => updatePaymentDetail("pagoMovil", "holder", event.target.value)}
                placeholder="Titular"
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </div>
          </div>

          <div className="rounded-[24px] bg-white p-4">
            <h4 className="text-lg font-black text-[#25262B]">Transferencia</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={draft.payment_details.transferencia?.bank || ""}
                onChange={(event) => updatePaymentDetail("transferencia", "bank", event.target.value)}
                placeholder="Banco"
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
              <input
                value={draft.payment_details.transferencia?.accountNumber || ""}
                onChange={(event) => updatePaymentDetail("transferencia", "accountNumber", event.target.value)}
                placeholder="Número de cuenta"
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
              <input
                value={draft.payment_details.transferencia?.idNumber || ""}
                onChange={(event) => updatePaymentDetail("transferencia", "idNumber", event.target.value)}
                placeholder="Cédula/RIF"
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
              <input
                value={draft.payment_details.transferencia?.holder || ""}
                onChange={(event) => updatePaymentDetail("transferencia", "holder", event.target.value)}
                placeholder="Titular"
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </div>
          </div>

          <div className="rounded-[24px] bg-white p-4">
            <h4 className="text-lg font-black text-[#25262B]">Zelle</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={draft.payment_details.zelle?.contact || ""}
                onChange={(event) => updatePaymentDetail("zelle", "contact", event.target.value)}
                placeholder="Correo o teléfono"
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
              <input
                value={draft.payment_details.zelle?.holder || ""}
                onChange={(event) => updatePaymentDetail("zelle", "holder", event.target.value)}
                placeholder="Titular"
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </div>
          </div>

          <div className="rounded-[24px] bg-white p-4">
            <h4 className="text-lg font-black text-[#25262B]">Binance</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={draft.payment_details.binance?.contact || ""}
                onChange={(event) => updatePaymentDetail("binance", "contact", event.target.value)}
                placeholder="Binance Pay ID o correo"
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
              <input
                value={draft.payment_details.binance?.holder || ""}
                onChange={(event) => updatePaymentDetail("binance", "holder", event.target.value)}
                placeholder="Titular"
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </div>
          </div>

          <div className="rounded-[24px] bg-white p-4 xl:col-span-2">
            <h4 className="text-lg font-black text-[#25262B]">Efectivo</h4>
            <textarea
              value={draft.payment_details.efectivo?.note || ""}
              onChange={(event) => updatePaymentDetail("efectivo", "note", event.target.value)}
              rows={2}
              placeholder="Ej: Paga al retirar o al recibir. Confirmar monto con el comercio."
              className="mt-3 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />
          </div>
        </div>
      </section>

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
          {draft.accepts_pickup ? "Retiro (pick up) activo" : "Retiro (pick up) inactivo"}
        </button>

        <button
          type="button"
          onClick={() => updateField("is_active", !draft.is_active)}
          className={[
            "rounded-full px-4 py-2 text-xs font-black",
            draft.is_active ? "bg-[#FFB547] text-[#25262B]" : "bg-red-100 text-red-700",
          ].join(" ")}
        >
          {draft.is_active ? "Visible en la web" : "Oculto en la web"}
        </button>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={saveSettings}
          disabled={isSaving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60 sm:w-auto"
        >
          {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          Guardar cambios
        </button>
      </div>

      {message && (
        <p
          className={[
            "mt-4 rounded-2xl p-3 text-sm font-black",
            message.includes("NO quedaron guardados")
              ? "bg-red-50 text-red-700 ring-1 ring-red-100"
              : "bg-[#F8F3E8] text-[#2E3A79]",
          ].join(" ")}
        >
          {message}
        </p>
      )}
    </section>
  );
}

export function ConfigManager() {
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [paymentDetailsAvailable, setPaymentDetailsAvailable] = useState(true);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => shouldShowPanelInitialAccessGate());
  const [isLoading, setIsLoading] = useState(() => hasSavedPanelAuth());
  const [error, setError] = useState("");

  async function loadConfig(currentPin: string) {
    setIsLoading(true);
    setError("");

    try {
      const data = await apiRequest(currentPin);
      setStores(data.stores || []);
      setPaymentDetailsAvailable(data.paymentDetailsAvailable !== false);
      setIsUnlocked(true);

      if (currentPin) {
        savePanelPin(currentPin);
      }
    } catch (error: any) {
      setError(error.message || "No se pudo cargar la configuración.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootPanel() {
      const savedPin = getSavedPanelPin();
      const savedToken = await getPanelAccessToken();

      if (!active) return;

      if (savedPin || savedToken) {
        setPin(savedPin);
        loadConfig(savedPin);
      } else {
        setIsCheckingAccess(false);
        setIsLoading(false);
      }
    }

    bootPanel();

    return () => {
      active = false;
    };
  }, []);

  if (isCheckingAccess) {
    return <PanelAccessGate />;
  }

  if (!isUnlocked && isLoading) {
    return <PanelModuleSkeleton label="Cargando configuración..." />;
  }

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso a configuración</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesión con tu usuario autorizado para continuar.
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
    <div className="space-y-5">
      <section className="rounded-[34px] bg-[#25262B] p-5 text-white shadow-xl shadow-[#25262B]/20">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
              Configuración del negocio
            </p>
            <h2 className="mt-2 text-3xl font-black">Configuración</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-white/70">
              Edita datos comerciales, ubicación, métodos de pago y operación.
            </p>
          </div>
        </div>
      </section>

      {stores.map((store) => (
        <StoreSettingsCard
          key={store.id}
          store={store}
          pin={pin}
          paymentDetailsAvailable={paymentDetailsAvailable}
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



