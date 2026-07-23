"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  RefreshCcw,
  Save,
  Trash2,
  Truck,
} from "lucide-react";
import { PanelAccessGate, PanelModuleSkeleton } from "@/components/panel/PanelLoadingState";
import { TransportMarketplaceSection } from "@/components/panel/TransportMarketplaceSection";
import {
  findOverlappingDistanceRange,
  formatDistanceRange,
  normalizeDistanceRangeInput,
} from "@/lib/distance-ranges";
import {
  getPanelAccessToken,
  getPanelAuthHeaders,
  getSavedPanelPin,
  hasSavedPanelAuth,
  savePanelPin,
  shouldShowPanelInitialAccessGate,
} from "@/lib/panel/client-auth";

type DeliveryProvider = "own_delivery" | "entrega2" | "manual_quote" | "transport_agency" | "disabled";
type PricingType = "fixed" | "fixed_distance" | "distance_ranges" | "zones" | "free_over_amount" | "manual";
type DeliveryPromoDiscountType = "free" | "amount" | "percent";

type DeliverySettingsRow = {
  store: { id: string; name: string };
  settings: {
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    deliveryProvider: DeliveryProvider;
    pricingType: PricingType;
    fixedFeeUsd: number;
    freeDeliveryMinUsd: number | null;
    deliveryPromoEnabled: boolean;
    deliveryPromoMinSubtotalUsd: number | null;
    deliveryPromoDiscountType: DeliveryPromoDiscountType;
    deliveryPromoDiscountValue: number;
    maxDistanceKm: number | null;
    distanceFactor: number | null;
    manualQuoteMessage: string;
    zones: Array<{
      id: string;
      name: string;
      description?: string;
      feeUsd: number;
      isActive: boolean;
      sortOrder: number;
    }>;
    distanceRates: Array<{
      id: string;
      minKm: number;
      maxKm: number | null;
      feeUsd: number;
      isActive: boolean;
      sortOrder: number;
    }>;
  };
};

type DeliveryBillingOrder = {
  id: string;
  orderId?: string | null;
  publicCode?: string | null;
  provider: "entrega2" | "transport_agency" | string;
  providerName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  feeUsd: number;
  deliveryDistanceKm?: number | string | null;
  deliveryZoneName?: string | null;
  status?: string | null;
  createdAt?: string | null;
  billable?: boolean;
};

const deliveryBillingRangeOptions = [
  { value: "this_week", label: "Esta semana" },
  { value: "last_week", label: "Semana pasada" },
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "custom", label: "Personalizado" },
];

async function deliveryRequest(pin: string, options?: RequestInit) {
  const response = await fetch("/api/panel/delivery-settings", {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getPanelAuthHeaders(pin)),
      ...(options?.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error cargando delivery.");
  }

  return data;
}

function moneyLabel(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function deliveryDetail(order: DeliveryBillingOrder) {
  if (order.deliveryZoneName) return `Zona: ${order.deliveryZoneName}`;
  const distance = Number(order.deliveryDistanceKm);
  if (Number.isFinite(distance) && distance > 0) return `${distance.toFixed(2)} km`;
  return "Sin km/zona";
}

function shortServiceId(order: DeliveryBillingOrder) {
  return order.publicCode || order.orderId?.slice(0, 8) || order.id.slice(0, 8);
}

function DeliveryBillingSection({
  rows,
  pin,
}: {
  rows: DeliverySettingsRow[];
  pin: string;
}) {
  const [billing, setBilling] = useState<any>(null);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [range, setRange] = useState("this_week");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const activeStoreId = selectedStoreId || rows[0]?.store.id || "";
  const orders: DeliveryBillingOrder[] = billing?.orders || [];

  async function loadBilling(storeId = activeStoreId, overrideRange = range) {
    setIsLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (storeId) params.set("storeId", storeId);
      params.set("range", overrideRange);
      if (overrideRange === "custom") {
        if (startDate) params.set("start", startDate);
        if (endDate) params.set("end", endDate);
      }

      const response = await fetch(`/api/panel/transport/billing?${params.toString()}`, {
        headers: await getPanelAuthHeaders(pin),
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "No se pudo cargar facturación.");
      setBilling(next);
    } catch (error: any) {
      setMessage(error.message || "No se pudo cargar facturación.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!rows.length) return;
    loadBilling(activeStoreId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStoreId, rows.length]);

  return (
    <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.07]">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2E3A79]">
            Facturación delivery
          </p>
          <h2 className="mt-1 text-2xl font-black text-[#25262B]">Cuenta de delivery</h2>
          <p className="mt-1 text-sm font-bold text-[#746f69]">
            Servicios no cancelados. El delivery se cobra separado de las ventas del comercio.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {rows.length > 1 ? (
            <select
              value={activeStoreId}
              onChange={(event) => setSelectedStoreId(event.target.value)}
              className="rounded-full border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-black text-[#25262B]"
            >
              {rows.map((row) => (
                <option key={row.store.id} value={row.store.id}>
                  {row.store.name}
                </option>
              ))}
            </select>
          ) : null}
          <select
            value={range}
            onChange={(event) => {
              const nextRange = event.target.value;
              setRange(nextRange);
              if (nextRange !== "custom") void loadBilling(activeStoreId, nextRange);
            }}
            className="rounded-full border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-black text-[#25262B]"
          >
            {deliveryBillingRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadBilling(activeStoreId)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Actualizar
          </button>
        </div>
      </div>

      {range === "custom" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none"
          />
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none"
          />
          <button
            type="button"
            onClick={() => loadBilling(activeStoreId, "custom")}
            disabled={isLoading}
            className="rounded-2xl bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            Aplicar fechas
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[#F8F3E8] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Período</p>
          <p className="mt-1 text-sm font-black text-[#25262B]">
            {billing?.range?.startDate || billing?.week?.startDate || "--"} a{" "}
            {billing?.range?.endDate || billing?.week?.endDate || "--"}
          </p>
        </div>
        <div className="rounded-2xl bg-[#F8F3E8] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Servicios</p>
          <p className="mt-1 text-2xl font-black text-[#25262B]">{orders.length}</p>
        </div>
        <div className="rounded-2xl bg-[#2E3A79] p-4 text-white">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/65">Total a pagar</p>
          <p className="mt-1 text-2xl font-black text-[#FFB547]">
            {moneyLabel(Number(billing?.totalUsd || 0))}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowDetail((current) => !current)}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[#F8F3E8] px-5 py-3 text-sm font-black text-[#25262B]"
      >
        {showDetail ? "Ocultar detalle" : "Ver detalle"}
      </button>

      {showDetail ? (
        <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-[#25262B]/10">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-[#F8F3E8] text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Fecha y hora</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Zona o km</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#25262B]/10 bg-white">
              {orders.map((order) => (
                <tr key={`${order.provider}-${order.id}`} className="font-bold text-[#25262B]">
                  <td className="px-4 py-3">{shortServiceId(order)}</td>
                  <td className="px-4 py-3">{formatDateTime(order.createdAt)}</td>
                  <td className="px-4 py-3">{order.customerName || "Cliente"}</td>
                  <td className="px-4 py-3 font-black text-[#2E3A79]">{moneyLabel(order.feeUsd)}</td>
                  <td className="px-4 py-3">{deliveryDetail(order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!orders.length && !isLoading ? (
        <p className="mt-4 rounded-2xl bg-[#F8F3E8] p-4 text-sm font-bold text-[#746f69]">
          Aún no hay servicios delivery registrados en este período.
        </p>
      ) : null}

      {message ? (
        <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-black text-red-700">{message}</p>
      ) : null}
    </section>
  );
}

function validateRateDraft(
  draft: { minKm: string; maxKm: string },
  ranges: DeliverySettingsRow["settings"]["distanceRates"],
  excludeId?: string
) {
  const normalized = normalizeDistanceRangeInput({
    minKm: draft.minKm,
    maxKm: draft.maxKm,
  });

  if (normalized.error || !normalized.range) return normalized.error || "Rango invalido.";

  const conflict = findOverlappingDistanceRange({
    candidate: normalized.range,
    ranges,
    excludeId,
  });

  return conflict
    ? `Ese rango se cruza con ${formatDistanceRange(conflict)}. Ajusta los kilometros para que no se solapen.`
    : "";
}

function DeliveryStoreCard({
  row,
  pin,
  onSaved,
}: {
  row: DeliverySettingsRow;
  pin: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    ...row.settings,
    fixedFeeUsd: String(row.settings.fixedFeeUsd ?? 0),
    freeDeliveryMinUsd:
      row.settings.freeDeliveryMinUsd === null
        ? ""
        : String(row.settings.freeDeliveryMinUsd),
    deliveryPromoEnabled: row.settings.deliveryPromoEnabled || false,
    deliveryPromoMinSubtotalUsd:
      row.settings.deliveryPromoMinSubtotalUsd === null
        ? ""
        : String(row.settings.deliveryPromoMinSubtotalUsd),
    deliveryPromoDiscountType: row.settings.deliveryPromoDiscountType || "free",
    deliveryPromoDiscountValue: String(row.settings.deliveryPromoDiscountValue ?? 0),
    maxDistanceKm:
      row.settings.maxDistanceKm === null ? "" : String(row.settings.maxDistanceKm),
  });
  const [zoneDraft, setZoneDraft] = useState({
    name: "",
    feeUsd: "",
    description: "",
  });
  const [rateDraft, setRateDraft] = useState({
    minKm: "",
    maxKm: "",
    feeUsd: "",
  });
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isEntrega2 = draft.deliveryProvider === "entrega2";
  const isTransportAgency = draft.deliveryProvider === "transport_agency";
  const isExternalDeliveryLocked = isEntrega2 || isTransportAgency;
  const isAgencyLocked = isTransportAgency;
  const isOwnDelivery = draft.deliveryProvider === "own_delivery" && draft.deliveryEnabled;
  const normalizedPricingType: PricingType =
    draft.pricingType === "fixed" ||
    (draft.deliveryProvider === "own_delivery" &&
      (draft.pricingType === "manual" || draft.pricingType === "free_over_amount"))
      ? "fixed_distance"
      : draft.pricingType;
  const effectivePricingType: PricingType = isEntrega2 ? "manual" : normalizedPricingType;

  function updateDraft(field: string, value: unknown) {
    setDraft((current) => {
      const next = { ...current, [field]: value };

      if (field === "deliveryProvider" && value === "entrega2") {
        next.deliveryEnabled = true;
        next.pricingType = "distance_ranges";
        next.manualQuoteMessage =
          "Entrega2 App cotiza y confirma el delivery real. Si aun no esta activa, confirma el precio por WhatsApp.";
      }

      if (field === "deliveryProvider" && value === "manual_quote") {
        next.deliveryEnabled = true;
        next.pricingType = "manual";
        next.manualQuoteMessage =
          "Confirma el precio de tu delivery por WhatsApp con el comercio.";
      }

      if (field === "deliveryProvider" && value === "transport_agency") {
        next.deliveryEnabled = true;
        if (next.pricingType === "manual" || next.pricingType === "fixed") {
          next.pricingType = "fixed_distance";
        }
        next.manualQuoteMessage =
          "La empresa delivery afiliada calcula o confirma el delivery segun su tarifa activa.";
      }

      if (field === "deliveryProvider" && value === "disabled") {
        next.deliveryEnabled = false;
        next.pricingType = "manual";
        next.manualQuoteMessage =
          "Este comercio no tiene delivery activo en este momento.";
      }

      if (field === "deliveryProvider" && value === "own_delivery") {
        next.deliveryEnabled = true;
        if (next.pricingType === "manual" || next.pricingType === "fixed") {
          next.pricingType = "fixed_distance";
        }
        next.manualQuoteMessage =
          "Confirma el precio de tu delivery por WhatsApp con el comercio.";
      }

      return next;
    });
  }
  async function saveSettings() {
    const hasActiveDistanceRates = row.settings.distanceRates.some((rate) => rate.isActive);

    if (
      draft.deliveryProvider === "own_delivery" &&
      effectivePricingType === "fixed_distance" &&
      draft.maxDistanceKm === ""
    ) {
      setMessage("Indica el maximo de km para la tarifa plana.");
      return;
    }

    if (
      draft.deliveryProvider === "own_delivery" &&
      effectivePricingType === "distance_ranges" &&
      !hasActiveDistanceRates
    ) {
      setMessage("Agrega al menos un rango activo para calcular el delivery.");
      return;
    }

    if (
      draft.deliveryProvider === "own_delivery" &&
      effectivePricingType === "zones" &&
      !row.settings.zones.some((zone) => zone.isActive)
    ) {
      setMessage("Agrega al menos una zona activa para que el cliente pueda ver el precio.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      await deliveryRequest(pin, {
        method: "PATCH",
        body: JSON.stringify({
          storeId: row.store.id,
          ...draft,
          pricingType: effectivePricingType,
          fixedFeeUsd: Number(draft.fixedFeeUsd || 0),
          freeDeliveryMinUsd:
            draft.deliveryPromoMinSubtotalUsd === "" ? null : Number(draft.deliveryPromoMinSubtotalUsd),
          deliveryPromoEnabled: Boolean(draft.deliveryPromoEnabled),
          deliveryPromoMinSubtotalUsd:
            draft.deliveryPromoMinSubtotalUsd === "" ? null : Number(draft.deliveryPromoMinSubtotalUsd),
          deliveryPromoDiscountType: draft.deliveryPromoDiscountType,
          deliveryPromoDiscountValue: Number(draft.deliveryPromoDiscountValue || 0),
          maxDistanceKm:
            draft.maxDistanceKm === "" ? null : Number(draft.maxDistanceKm),
          distanceFactor: null,
        }),
      });
      setMessage("Delivery guardado.");
      onSaved();
    } catch (error: any) {
      setMessage(error.message || "No se pudo guardar delivery.");
    } finally {
      setIsSaving(false);
    }
  }

  async function createZone() {
    if (!zoneDraft.name.trim()) return;
    await deliveryRequest(pin, {
      method: "POST",
      body: JSON.stringify({
        action: "zone",
        storeId: row.store.id,
        name: zoneDraft.name,
        feeUsd: Number(zoneDraft.feeUsd || 0),
        description: zoneDraft.description,
        sortOrder: row.settings.zones.length + 1,
      }),
    });
    setZoneDraft({ name: "", feeUsd: "", description: "" });
    onSaved();
  }

  async function updateZone(
    zone: DeliverySettingsRow["settings"]["zones"][number],
    patch: Record<string, unknown>
  ) {
    await deliveryRequest(pin, {
      method: "PATCH",
      body: JSON.stringify({
        action: "zone",
        storeId: row.store.id,
        id: zone.id,
        name: zone.name,
        description: zone.description || "",
        feeUsd: zone.feeUsd,
        isActive: zone.isActive,
        sortOrder: zone.sortOrder,
        ...patch,
      }),
    });
    onSaved();
  }

  async function createRate() {
    const validationMessage = validateRateDraft(rateDraft, row.settings.distanceRates);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    await deliveryRequest(pin, {
      method: "POST",
      body: JSON.stringify({
        action: "rate",
        storeId: row.store.id,
        minKm: Number(rateDraft.minKm || 0),
        maxKm: rateDraft.maxKm === "" ? null : Number(rateDraft.maxKm),
        feeUsd: Number(rateDraft.feeUsd || 0),
        sortOrder: row.settings.distanceRates.length + 1,
      }),
    });
    setRateDraft({ minKm: "", maxKm: "", feeUsd: "" });
    onSaved();
  }

  async function updateRate(
    rate: DeliverySettingsRow["settings"]["distanceRates"][number],
    patch: Record<string, unknown>
  ) {
    if (patch.isActive !== false) {
      const validationMessage = validateRateDraft(
        {
          minKm: String(patch.minKm ?? rate.minKm),
          maxKm: patch.maxKm === null ? "" : String(patch.maxKm ?? rate.maxKm ?? ""),
        },
        row.settings.distanceRates,
        rate.id
      );
      if (validationMessage) {
        setMessage(validationMessage);
        return;
      }
    }

    await deliveryRequest(pin, {
      method: "PATCH",
      body: JSON.stringify({
        action: "rate",
        storeId: row.store.id,
        id: rate.id,
        minKm: rate.minKm,
        maxKm: rate.maxKm,
        feeUsd: rate.feeUsd,
        isActive: rate.isActive,
        sortOrder: rate.sortOrder,
        ...patch,
      }),
    });
    onSaved();
  }

  async function deleteRule(action: "zone" | "rate", id: string) {
    await deliveryRequest(pin, {
      method: "DELETE",
      body: JSON.stringify({ action, storeId: row.store.id, id }),
    });
    onSaved();
  }

  return (
    <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
            Delivery
          </p>
          <h2 className="mt-1 text-2xl font-black">{row.store.name}</h2>
          <p className="mt-2 max-w-2xl text-sm font-bold text-[#746f69]">
            Configura retiro, delivery propio, empresas delivery afiliadas, zonas, rangos y promociones
            de delivery desde un solo modulo.
          </p>
        </div>
        <button
          type="button"
          onClick={saveSettings}
          disabled={isSaving || isExternalDeliveryLocked}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar delivery
        </button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => updateDraft("deliveryEnabled", !draft.deliveryEnabled)}
          disabled={isExternalDeliveryLocked}
          className={`rounded-2xl px-4 py-3 text-sm font-black ${
            draft.deliveryEnabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          } disabled:opacity-60`}
        >
          {draft.deliveryEnabled ? "Delivery activo" : "Delivery oculto"}
        </button>
        <button
          type="button"
          onClick={() => updateDraft("pickupEnabled", !draft.pickupEnabled)}
          disabled={isExternalDeliveryLocked}
          className={`rounded-2xl px-4 py-3 text-sm font-black ${
            draft.pickupEnabled ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
          } disabled:opacity-60`}
        >
          {draft.pickupEnabled ? "Retiro activo" : "Retiro oculto"}
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="rounded-[24px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            1. Tipo de delivery
          </span>
          <select
            value={draft.deliveryProvider}
            onChange={(event) => updateDraft("deliveryProvider", event.target.value)}
            disabled={isExternalDeliveryLocked}
            className="mt-2 w-full rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79] disabled:bg-white/60 disabled:text-[#746f69]"
          >
            <option value="own_delivery">Propio del comercio</option>
            {isEntrega2 ? (
              <option value="entrega2" disabled>
                Entrega2 App activa
              </option>
            ) : null}
            {isTransportAgency ? (
              <option value="transport_agency" disabled>
                Empresa delivery afiliada activa
              </option>
            ) : null}
            <option value="manual_quote">Cotizar por WhatsApp</option>
            <option value="disabled">No ofrecer delivery</option>
          </select>
          <p className="mt-2 text-xs font-bold text-[#746f69]">
            Agrega la modalidad real del comercio. Las empresas se solicitan abajo, en Afiliarse a una empresa delivery.
          </p>
        </label>

        <label className="rounded-[24px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
            2. Forma de cobrar
          </span>
          <select
            value={effectivePricingType}
            onChange={(event) => updateDraft("pricingType", event.target.value)}
            disabled={
              isEntrega2 ||
              isTransportAgency ||
              draft.deliveryProvider === "manual_quote" ||
              draft.deliveryProvider === "disabled"
            }
            className="mt-2 w-full rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79] disabled:bg-white/60 disabled:text-[#746f69]"
          >
            <option value="fixed_distance">Tarifa plana hasta X km</option>
            <option value="zones">Por zonas</option>
            <option value="distance_ranges">Rangos de km</option>
            {draft.deliveryProvider === "manual_quote" || draft.deliveryProvider === "disabled" ? (
              <option value="manual">No aplica</option>
            ) : null}
          </select>
          <p className="mt-2 text-xs font-bold text-[#746f69]">
            Cada modalidad despliega solo su propia configuracion.
          </p>
        </label>
      </div>

      {isEntrega2 ? (
        <div className="mt-4 rounded-2xl bg-[#FFF8F0] p-4 text-sm font-bold leading-relaxed text-[#746f69] ring-1 ring-[#FFB547]/30">
          Conexion activa con Entrega2 App. Las zonas, rangos y promos de delivery propio quedan bloqueadas porque
          el checkout cotiza directo con Entrega2 App. El comercio decide cuando enviar cada pedido desde Pedidos.
        </div>
      ) : null}
      {isTransportAgency ? (
        <div className="mt-4 rounded-2xl bg-[#FFF8F0] p-4 text-sm font-bold leading-relaxed text-[#746f69] ring-1 ring-[#FFB547]/30">
          Este comercio tiene una empresa delivery activa. Las tarifas de delivery quedan bloqueadas y el checkout usa los precios de la empresa afiliada.
          Para cambiar a delivery propio primero hay que gestionar la desafiliacion con la empresa.
        </div>
      ) : null}
      <div className="mt-4 grid gap-3">
        {effectivePricingType === "fixed_distance" && isOwnDelivery ? (
          <div className="rounded-[24px] bg-white p-4 ring-1 ring-[#25262B]/10">
            <h3 className="text-sm font-black text-[#25262B]">Tarifa plana hasta X km</h3>
            <p className="mt-1 text-xs font-bold text-[#746f69]">
              El cliente comparte ubicacion; si esta dentro del rango, se suma esta tarifa.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">Monto delivery USD</span>
                <input
                  type="number"
                  value={draft.fixedFeeUsd}
                  onChange={(event) => updateDraft("fixedFeeUsd", event.target.value)}
                  placeholder="Ej: 2.50"
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">Máximo km</span>
                <input
                  type="number"
                  value={draft.maxDistanceKm}
                  onChange={(event) => updateDraft("maxDistanceKm", event.target.value)}
                  placeholder="Ej: 5"
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>
            </div>
          </div>
        ) : null}

        {effectivePricingType === "distance_ranges" && isOwnDelivery ? (
          <div className="rounded-[24px] bg-white p-4 ring-1 ring-[#25262B]/10">
            <h3 className="text-sm font-black text-[#25262B]">Rangos de km</h3>
            <p className="mt-1 text-xs font-bold text-[#746f69]">
              El cliente comparte ubicacion y Somos aplica el rango que corresponda.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">Distancia máxima opcional</span>
                <input
                  type="number"
                  value={draft.maxDistanceKm}
                  onChange={(event) => updateDraft("maxDistanceKm", event.target.value)}
                  placeholder="Ej: 8"
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>
              <div className="rounded-2xl bg-[#F8F3E8] p-3 text-xs font-bold leading-relaxed text-[#746f69]">
                La tarifa saldra solo de los rangos activos. Si falta un tramo, el checkout pedira ajustar la cobertura.
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="sr-only">
        La promo se aplica sobre la tarifa calculada, zonas o rangos. Dejalo vacio
        si el comercio no ofrece descuento de delivery por compra minima.
      </div>

      {!isEntrega2 ? (
      <details open={draft.deliveryPromoEnabled} className="mt-3 rounded-[24px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
        <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-black text-[#25262B]">Promo de delivery</h3>
            <p className="text-xs font-bold text-[#746f69]">
              Aplica un descuento sobre la tarifa calculada por fija, zona o distancia.
            </p>
          </div>
          <button
            type="button"
            onClick={() => updateDraft("deliveryPromoEnabled", !draft.deliveryPromoEnabled)}
            className={[
              "rounded-full px-4 py-2 text-xs font-black",
              draft.deliveryPromoEnabled
                ? "bg-green-100 text-green-700"
                : "bg-white text-[#746f69]",
            ].join(" ")}
          >
            {draft.deliveryPromoEnabled ? "Promo activa" : "Activar promo"}
          </button>
        </div>
        </summary>

        {draft.deliveryPromoEnabled ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_150px_1fr]">
            <input
              type="number"
              value={draft.deliveryPromoMinSubtotalUsd}
              onChange={(event) => updateDraft("deliveryPromoMinSubtotalUsd", event.target.value)}
              placeholder="Compra minima"
              className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />
            <select
              value={draft.deliveryPromoDiscountType}
              onChange={(event) => updateDraft("deliveryPromoDiscountType", event.target.value)}
              className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
            >
              <option value="free">Gratis</option>
              <option value="amount">Monto</option>
              <option value="percent">Porcentaje</option>
            </select>
            <input
              type="number"
              value={draft.deliveryPromoDiscountValue}
              onChange={(event) => updateDraft("deliveryPromoDiscountValue", event.target.value)}
              placeholder={draft.deliveryPromoDiscountType === "percent" ? "% descuento" : "Descuento"}
              disabled={draft.deliveryPromoDiscountType === "free"}
              className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79] disabled:bg-white/60 disabled:text-[#746f69]"
            />
          </div>
        ) : null}
      </details>
      ) : null}

      <textarea
        value={draft.manualQuoteMessage}
        onChange={(event) => updateDraft("manualQuoteMessage", event.target.value)}
        disabled={isExternalDeliveryLocked}
        rows={2}
        className="mt-3 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
        placeholder="Mensaje cuando la tarifa se confirma manualmente"
      />

      <div
        className={[
          "mt-4 grid gap-4 xl:grid-cols-2",
          !isEntrega2 && (effectivePricingType === "zones" || effectivePricingType === "distance_ranges")
            ? ""
            : "hidden",
        ].join(" ")}
      >
        <details open={effectivePricingType === "zones"} className={effectivePricingType === "zones" ? "rounded-[24px] bg-[#F8F3E8] p-4" : "hidden"}>
          <summary className="cursor-pointer list-none font-black">
            Zonas ({row.settings.zones.length})
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_110px_auto]">
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">Nombre zona</span>
              <input
                value={zoneDraft.name}
                onChange={(event) =>
                  setZoneDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Ej: Centro"
                className="w-full rounded-2xl border border-[#25262B]/10 px-3 py-2 text-sm font-bold"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">Tarifa USD</span>
              <input
                type="number"
                value={zoneDraft.feeUsd}
                onChange={(event) =>
                  setZoneDraft((current) => ({ ...current, feeUsd: event.target.value }))
                }
                placeholder="2.00"
                className="w-full rounded-2xl border border-[#25262B]/10 px-3 py-2 text-sm font-bold"
              />
            </label>
            <button
              type="button"
              onClick={createZone}
              className="rounded-2xl bg-[#2E3A79] px-4 py-2 text-sm font-black text-white"
            >
              Agregar
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {row.settings.zones.map((zone) => (
              <div
                key={zone.id}
                className="grid gap-2 rounded-2xl bg-white p-3 text-sm font-bold sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className={zone.isActive ? "" : "text-[#746f69] line-through"}>
                    {zone.name} - {moneyLabel(zone.feeUsd)}
                  </p>
                  <p className="text-xs text-[#746f69]">Orden {zone.sortOrder}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => updateZone(zone, { sortOrder: zone.sortOrder - 1 })}
                    className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black"
                  >
                    Subir
                  </button>
                  <button
                    type="button"
                    onClick={() => updateZone(zone, { sortOrder: zone.sortOrder + 1 })}
                    className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black"
                  >
                    Bajar
                  </button>
                  <button
                    type="button"
                    onClick={() => updateZone(zone, { isActive: !zone.isActive })}
                    className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black"
                  >
                    {zone.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRule("zone", zone.id)}
                    className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>

        <details open={effectivePricingType === "distance_ranges" && !isEntrega2} className={effectivePricingType === "distance_ranges" && !isEntrega2 ? "rounded-[24px] bg-[#F8F3E8] p-4" : "hidden"}>
          <summary className="cursor-pointer list-none font-black">
            Rangos por distancia ({row.settings.distanceRates.length})
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">Desde km</span>
              <input
                type="number"
                value={rateDraft.minKm}
                onChange={(event) =>
                  setRateDraft((current) => ({ ...current, minKm: event.target.value }))
                }
                placeholder="0"
                className="w-full rounded-2xl border border-[#25262B]/10 px-3 py-2 text-sm font-bold"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">Hasta km</span>
              <input
                type="number"
                value={rateDraft.maxKm}
                onChange={(event) =>
                  setRateDraft((current) => ({ ...current, maxKm: event.target.value }))
                }
                placeholder="3"
                className="w-full rounded-2xl border border-[#25262B]/10 px-3 py-2 text-sm font-bold"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">Tarifa USD</span>
              <input
                type="number"
                value={rateDraft.feeUsd}
                onChange={(event) =>
                  setRateDraft((current) => ({ ...current, feeUsd: event.target.value }))
                }
                placeholder="2.00"
                className="w-full rounded-2xl border border-[#25262B]/10 px-3 py-2 text-sm font-bold"
              />
            </label>
            <button
              type="button"
              onClick={createRate}
              className="rounded-2xl bg-[#2E3A79] px-4 py-2 text-sm font-black text-white"
            >
              Agregar
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {row.settings.distanceRates.map((rate) => (
              <div
                key={rate.id}
                className="grid gap-2 rounded-2xl bg-white p-3 text-sm font-bold sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className={rate.isActive ? "" : "text-[#746f69] line-through"}>
                    {rate.minKm}-{rate.maxKm ?? "sin limite"} km - {moneyLabel(rate.feeUsd)}
                  </p>
                  <p className="text-xs text-[#746f69]">Orden {rate.sortOrder}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => updateRate(rate, { sortOrder: rate.sortOrder - 1 })}
                    className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black"
                  >
                    Subir
                  </button>
                  <button
                    type="button"
                    onClick={() => updateRate(rate, { sortOrder: rate.sortOrder + 1 })}
                    className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black"
                  >
                    Bajar
                  </button>
                  <button
                    type="button"
                    onClick={() => updateRate(rate, { isActive: !rate.isActive })}
                    className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black"
                  >
                    {rate.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRule("rate", rate.id)}
                    className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={saveSettings}
          disabled={isSaving || isAgencyLocked}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60 sm:w-auto"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar delivery
        </button>
      </div>

      {message ? (
        <p className="mt-3 rounded-2xl bg-[#F8F3E8] p-3 text-sm font-black text-[#2E3A79]">
          {message}
        </p>
      ) : null}
    </section>
  );
}

export function DeliveryManager() {
  const [pin, setPin] = useState("");
  const [rows, setRows] = useState<DeliverySettingsRow[]>([]);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() =>
    shouldShowPanelInitialAccessGate()
  );
  const [isLoading, setIsLoading] = useState(() => hasSavedPanelAuth());
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDelivery(currentPin: string) {
    setIsLoading(true);
    setMessage("");

    try {
      const data = await deliveryRequest(currentPin);
      setRows(data.stores || []);
      setIsUnlocked(true);
      savePanelPin(currentPin);
    } catch (error: any) {
      setMessage(error.message || "No se pudo cargar delivery.");
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
        loadDelivery(savedPin);
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

  if (isCheckingAccess) return <PanelAccessGate />;
  if (!isUnlocked && isLoading) {
    return <PanelModuleSkeleton label="Cargando modulo de delivery..." />;
  }

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso a delivery</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesion con tu usuario autorizado para continuar.
        </p>
        <a
          href="/panel/login"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
        >
          <CheckCircle2 size={18} />
          Iniciar sesion
        </a>
        {message ? <p className="mt-3 text-sm font-black text-red-600">{message}</p> : null}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[34px] bg-[#25262B] p-5 text-white shadow-xl shadow-[#25262B]/20">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
              Operacion de delivery
            </p>
            <h2 className="mt-2 text-3xl font-black">Delivery y retiro</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-white/70">
              Controla tarifas, promociones, zonas y rangos sin mezclarlo con
              los datos generales del negocio.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadDelivery(pin)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Actualizar
          </button>
        </div>
      </section>

      {rows.map((row) => (
        <DeliveryStoreCard
          key={row.store.id}
          row={row}
          pin={pin}
          onSaved={() => loadDelivery(pin)}
        />
      ))}

      {rows.length ? <DeliveryBillingSection rows={rows} pin={pin} /> : null}

      {rows.some((row) => row.settings.deliveryProvider === "entrega2") ? (
        <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.07]">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2E3A79] text-[#FFB547]">
              <Lock size={20} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2E3A79]">
                Entrega2 App activa
              </p>
              <h3 className="mt-1 text-xl font-black text-[#25262B]">
                Afiliaciones delivery bloqueadas
              </h3>
              <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
                Este comercio ya está conectado a Entrega2 App. Para proteger esa integración,
                no se muestran otras empresas delivery ni solicitudes de afiliación desde este módulo.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <TransportMarketplaceSection pin={pin} onChanged={() => loadDelivery(pin)} />
      )}

      {!rows.length ? (
        <section className="rounded-[34px] bg-white p-6 text-sm font-bold text-[#746f69] shadow-xl shadow-[#2E3A79]/[0.07]">
          No tienes comercios asignados.
        </section>
      ) : null}
    </div>
  );
}
