"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MessageCircle, Navigation, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CheckoutFormData, DeliveryLocation, DeliveryQuote, SavedOrder, Store } from "@/types";
import { clearCart, getCart, getCartSubtotal } from "@/lib/cart";
import { formatBaseCurrency, formatBs } from "@/lib/currency";
import {
  clearCustomerBrowserProfile,
  getCustomerBrowserProfile,
  saveCustomerBrowserProfile,
} from "@/lib/customer-browser-profile";
import {
  buildMapsUrl,
  buildRouteUrl,
  calculateDeliveryQuoteFromSettings,
  createDefaultDeliverySettings,
} from "@/lib/delivery";
import { isCashPaymentMethod } from "@/lib/payments";
import { checkoutNoteExample } from "@/lib/checkout-notes";
import { buildPaymentInfo } from "@/lib/payment-display";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { saveOrderToSupabase } from "@/lib/supabase/orders";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import { useLiveStoreOpenState } from "@/hooks/use-live-store-open-state";
import {
  getTableOrderContext,
  isPrepaidTablePaymentMethod,
  type TableOrderContext,
} from "@/lib/table-orders";

const LocationPicker = dynamic(
  () => import("@/components/public/LocationPicker").then((mod) => mod.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-[#EFE6D6] bg-[#F8F3E8] p-4 text-sm font-black text-[#746f69]">
        Cargando mapa...
      </div>
    ),
  }
);

const initialForm: CheckoutFormData = {
  customerName: "",
  customerPhone: "",
  deliveryType: "delivery",
  paymentMethod: "",
  paymentReference: "",
  deliveryReference: "",
  deliveryZoneId: "",
  nationalIdNumber: "V-",
  nationalShippingCity: "",
  orderDetails: "",
  notes: "",
  cashPaymentNote: "",
};

export function getOrderKey(storeSlug: string) {
  return `vendeplus_last_order_${storeSlug}`;
}

function getCustomerIdParts(value: string) {
  const normalized = String(value || "").trim().toUpperCase();
  const match = normalized.match(/^([VEJ])[-\s]?([0-9]*)$/);
  return {
    type: match?.[1] || "V",
    number: match?.[2] || normalized.replace(/[^0-9]/g, ""),
  };
}

function createOrderId() {
  const date = new Date();
  const dayCode = `${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `VP-${dayCode}-${random}`;
}

function createIdempotencyKey() {
  const bytes = new Uint8Array(16);
  const availableCrypto = globalThis.crypto;

  if (availableCrypto?.getRandomValues) {
    availableCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function localizeQuoteText(text: string | undefined, baseCurrency: "USD" | "EUR" | string) {
  if (!text) return "";
  const symbol = String(baseCurrency || "USD").toUpperCase() === "EUR" ? "€" : "$";
  return text.replace(/\$/g, symbol);
}

function formatCheckoutOptions(
  item: ReturnType<typeof getCart>[number],
  baseCurrency: "USD" | "EUR" | string
) {
  const groups = new Map<string, string[]>();

  for (const option of item.selectedOptions || []) {
    const current = groups.get(option.groupName) || [];
    current.push(
      option.priceDeltaUsd > 0
        ? `${option.valueName} (+${formatBaseCurrency(option.priceDeltaUsd, baseCurrency)})`
        : option.valueName
    );
    groups.set(option.groupName, current);
  }

  return Array.from(groups.entries())
    .map(([groupName, values]) => `${groupName}: ${values.join(", ")}`)
    .join(" · ");
}

export function CheckoutForm({ store }: { store: Store }) {
  const router = useRouter();
  const openState = useLiveStoreOpenState(store);
  const [items, setItems] = useState<ReturnType<typeof getCart>>([]);
  const [tableOrder, setTableOrder] = useState<TableOrderContext | null>(null);
  const [form, setForm] = useState<CheckoutFormData>(initialForm);
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [quote, setQuote] = useState<DeliveryQuote>({
    distanceKm: null,
    feeUsd: 0,
    label: "Pendiente por calcular",
    source: "pending",
    available: true,
  });
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState("");
  const [copiedPaymentLine, setCopiedPaymentLine] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberCustomer, setRememberCustomer] = useState(true);
  const [hasSavedCustomer, setHasSavedCustomer] = useState(false);
  const [customerProfileLoaded, setCustomerProfileLoaded] = useState(false);
  const lastQuoteRequestRef = useRef("");
  const idempotencyKeyRef = useRef(createIdempotencyKey());

  useEffect(() => {
    setItems(getCart(store.slug));
    const context = getTableOrderContext(store.slug);
    setTableOrder(context);
    if (context) {
      setForm((current) => ({
        ...current,
        deliveryType: "table",
        deliveryReference: context.tableName,
        paymentMethod: context.paymentMethods.includes(current.paymentMethod)
          ? current.paymentMethod
          : "",
      }));
    }
    router.prefetch(`/${store.slug}/confirmacion`);
  }, [router, store.slug]);

  useEffect(() => {
    const profile = getCustomerBrowserProfile();
    if (profile) {
      setForm((current) => ({
        ...current,
        customerName: current.customerName || profile.name,
        customerPhone: current.customerPhone || profile.phone,
        nationalIdNumber: store.requestCustomerIdNumber && profile.idNumber
          ? `${getCustomerIdParts(profile.idNumber).type}-${getCustomerIdParts(profile.idNumber).number}`
          : current.nationalIdNumber,
      }));
      setHasSavedCustomer(true);
    }
    setCustomerProfileLoaded(true);
  }, [store.requestCustomerIdNumber]);

  const subtotalUsd = useMemo(() => getCartSubtotal(items), [items]);
  const deliverySettings = useMemo(
    () => store.deliverySettings || createDefaultDeliverySettings(),
    [store.deliverySettings]
  );
  const canShareLocation =
    form.deliveryType === "delivery" &&
    deliverySettings.deliveryEnabled &&
    !["manual_quote", "disabled"].includes(deliverySettings.deliveryProvider);
  const needsLocation =
    canShareLocation &&
    (deliverySettings.pricingType === "zones" ||
      deliverySettings.pricingType === "fixed_distance" ||
      deliverySettings.pricingType === "distance_ranges" ||
      deliverySettings.deliveryProvider === "entrega2");
  const needsZone =
    form.deliveryType === "delivery" &&
    deliverySettings.deliveryEnabled &&
    deliverySettings.deliveryProvider !== "entrega2" &&
    deliverySettings.pricingType === "zones";
  const activeDeliveryZones = useMemo(
    () => deliverySettings.zones.filter((zone) => zone.isActive),
    [deliverySettings.zones]
  );
  const deliveryPartnerName =
    deliverySettings.transportAgencyName ||
    (deliverySettings.deliveryProvider === "entrega2" ? "Entrega2 App" : "");
  const deliveryOptionLabel = deliveryPartnerName
    ? `Delivery — ${deliveryPartnerName}`
    : "Delivery";
  const deliveryModeCopy = useMemo(() => {
    if (deliverySettings.deliveryProvider === "entrega2") {
      return `Comparte tu ubicación para cotizar el delivery con ${deliveryPartnerName || "la empresa delivery"}.`;
    }
    if (deliverySettings.pricingType === "zones") {
      return "Selecciona tu zona y carga tu ubicación GPS para el repartidor.";
    }
    if (deliverySettings.pricingType === "fixed_distance") {
      return "Comparte tu ubicación o toca el mapa.";
    }
    if (deliverySettings.pricingType === "distance_ranges") {
      return "Comparte tu ubicación o toca el mapa.";
    }
    return "Indica una referencia clara para facilitar la entrega.";
  }, [deliveryPartnerName, deliverySettings.deliveryProvider, deliverySettings.pricingType]);

  useEffect(() => {
    setForm((current) => {
      if (tableOrder) {
        return current.deliveryType === "table"
          ? current
          : { ...current, deliveryType: "table" };
      }
      const availableTypes: CheckoutFormData["deliveryType"][] = [
        deliverySettings.deliveryEnabled ? "delivery" : null,
        deliverySettings.pickupEnabled ? "pickup" : null,
        deliverySettings.nationalShippingEnabled ? "national_shipping" : null,
      ].filter(Boolean) as CheckoutFormData["deliveryType"][];

      if (!availableTypes.length || availableTypes.includes(current.deliveryType)) {
        return current;
      }

      return { ...current, deliveryType: availableTypes[0] };
    });
  }, [
    tableOrder,
    deliverySettings.deliveryEnabled,
    deliverySettings.pickupEnabled,
    deliverySettings.nationalShippingEnabled,
  ]);

  useEffect(() => {
    let active = true;

    async function calculate() {
      if (form.deliveryType !== "delivery" || !needsLocation) {
        setQuote(
          calculateDeliveryQuoteFromSettings({
            settings: deliverySettings,
            deliveryType: form.deliveryType,
            subtotalUsd,
            distanceKm: null,
            zoneId: form.deliveryZoneId || null,
            source:
              form.deliveryType === "pickup"
                ? "pickup"
                : form.deliveryType === "national_shipping"
                  ? "national_shipping"
                  : "manual",
          })
        );
        setIsCalculating(false);
        return;
      }

      if (!location) {
        setQuote(
          calculateDeliveryQuoteFromSettings({
            settings: deliverySettings,
            deliveryType: "delivery",
            subtotalUsd,
            distanceKm: null,
            zoneId: form.deliveryZoneId || null,
            source: "pending",
          })
        );
        setIsCalculating(false);
        return;
      }

      setIsCalculating(true);
      const requestKey = [
        store.id,
        location.latitude.toFixed(6),
        location.longitude.toFixed(6),
        subtotalUsd.toFixed(2),
      ].join(":");
      lastQuoteRequestRef.current = requestKey;

      try {
        const response = await fetch("/api/delivery/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId: store.id,
            latitude: location.latitude,
            longitude: location.longitude,
            subtotalUsd,
            zoneId: form.deliveryZoneId || null,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!active || lastQuoteRequestRef.current !== requestKey) return;
        if (!response.ok || !data?.quote) {
          const message = data?.error || "No pudimos cotizar el delivery. Intenta de nuevo.";
          setQuote({
            distanceKm: null,
            feeUsd: 0,
            label: message,
            source: "pending",
            available: false,
            provider: deliverySettings.deliveryProvider,
            pricingType: deliverySettings.pricingType,
            message,
          });
          return;
        }
        setQuote(data.quote);
      } catch {
        if (!active || lastQuoteRequestRef.current !== requestKey) return;
        const message = "No pudimos cotizar el delivery. Intenta de nuevo.";
        setQuote({
          distanceKm: null,
          feeUsd: 0,
          label: message,
          source: "pending",
          available: false,
          provider: deliverySettings.deliveryProvider,
          pricingType: deliverySettings.pricingType,
          message,
        });
      } finally {
        if (active) setIsCalculating(false);
      }
    }

    calculate();
    return () => {
      active = false;
    };
  }, [
    deliverySettings,
    form.deliveryType,
    form.deliveryZoneId,
    location,
    needsLocation,
    store.id,
    store.latitude,
    store.longitude,
    subtotalUsd,
  ]);

  const deliveryUsd = form.deliveryType === "delivery" ? quote.feeUsd : 0;
  const showPricesInBs = store.showPricesInBs !== false;
  const baseCurrency = store.baseCurrency || "USD";
  const isEntrega2Provider = deliverySettings.deliveryProvider === "entrega2";
  const fulfillmentOptions = [
    tableOrder ? { value: "table" as const, label: tableOrder.tableName } : null,
    deliverySettings.deliveryEnabled
      ? { value: "delivery" as const, label: deliveryOptionLabel }
      : null,
    deliverySettings.pickupEnabled ? { value: "pickup" as const, label: "Retiro (pick up)" } : null,
    deliverySettings.nationalShippingEnabled
      ? { value: "national_shipping" as const, label: "Envio nacional" }
      : null,
  ].filter(Boolean) as Array<{ value: CheckoutFormData["deliveryType"]; label: string }>;
  const fulfillmentLabel =
    form.deliveryType === "table"
      ? tableOrder?.tableName || "Mesa"
      : form.deliveryType === "delivery"
      ? deliveryOptionLabel
      : form.deliveryType === "national_shipping"
        ? "Envio nacional"
        : "Retiro (pick up)";
  const isEntrega2Delivery =
    form.deliveryType === "delivery" && isEntrega2Provider;
  const isManualQuoteDelivery =
    form.deliveryType === "delivery" &&
    deliverySettings.deliveryProvider !== "entrega2" &&
    (deliverySettings.deliveryProvider === "manual_quote" ||
      deliverySettings.pricingType === "manual");
  const deliveryAmountLabel =
    form.deliveryType !== "delivery"
      ? "Sin delivery"
      : quote.available === false
        ? "No disponible"
      : isCalculating
        ? "Calculando..."
      : quote.source === "pending"
        ? isEntrega2Delivery
          ? location
            ? "Cotizando..."
            : "Falta ubicación"
          : "Por calcular"
        : isManualQuoteDelivery && deliveryUsd === 0
          ? "Por confirmar"
          : formatBaseCurrency(quote.originalFeeUsd ?? deliveryUsd, baseCurrency);
  const serviceFeeUsd =
    store.planType === "per_service" &&
    store.serviceFeePayer === "customer"
      ? Number(store.serviceFeeUsd || 0)
      : 0;
  const totalUsd = subtotalUsd + deliveryUsd + serviceFeeUsd;
  const totalBs = totalUsd * (store.usdToBs || 600);
  const availablePaymentMethods = tableOrder
    ? tableOrder.paymentMethods.filter(isPrepaidTablePaymentMethod)
    : store.paymentMethods;
  const isCashPayment = isCashPaymentMethod(form.paymentMethod);
  const paymentInfo = form.paymentMethod
    ? buildPaymentInfo({
        store,
        paymentMethod: form.paymentMethod,
        totals: { subtotalUsd, deliveryUsd, serviceFeeUsd, totalUsd, totalBs },
        customerPaymentNote: form.cashPaymentNote,
        paymentReference: form.paymentReference,
      })
    : null;

  const mapsUrl = location ? buildMapsUrl(location.latitude, location.longitude) : null;
  const quoteLabel = localizeQuoteText(quote.label, baseCurrency);
  const quoteMessage = localizeQuoteText(quote.message, baseCurrency);
  const routeUrl = location
    ? buildRouteUrl({
        originLat: store.latitude,
        originLng: store.longitude,
        destinationLat: location.latitude,
        destinationLng: location.longitude,
      })
    : null;

  function updateField<K extends keyof CheckoutFormData>(field: K, value: CheckoutFormData[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateCustomerId(type: string, number: string) {
    const safeType = ["V", "E", "J"].includes(type) ? type : "V";
    const safeNumber = number.replace(/[^0-9]/g, "").slice(0, 12);
    updateField("nationalIdNumber", `${safeType}-${safeNumber}`);
  }

  function validate() {
    if (items.length === 0) return "Tu carrito está vacío.";
    if (!openState.isOpen) {
      return `${openState.label}. El comercio no está recibiendo pedidos en este momento.`;
    }
    if (!form.customerName.trim()) return "Escribe el nombre del cliente.";
    if (!form.customerPhone.trim()) return "Escribe el teléfono del cliente.";
    if (store.requestCustomerIdNumber && !/^[VEJ]-\d+$/.test(form.nationalIdNumber)) {
      return "Escribe la cédula del cliente.";
    }
    if (!form.paymentMethod.trim()) return "Selecciona un método de pago.";
    if (tableOrder && !availablePaymentMethods.includes(form.paymentMethod)) {
      return "Selecciona un método de pago previo disponible para pedidos en mesa.";
    }
    if (form.deliveryType === "delivery" && quote.available === false) {
      return quote.message || quote.label || "Delivery no disponible.";
    }
    if (form.deliveryType === "national_shipping" && !/^[VEJ]-\d+$/.test(form.nationalIdNumber)) {
      return "Escribe la cedula para el envio nacional.";
    }
    if (form.deliveryType === "national_shipping" && !form.nationalShippingCity.trim()) {
      return "Escribe la ciudad de destino para el envio nacional.";
    }
    if (needsZone && activeDeliveryZones.length > 0 && !form.deliveryZoneId) return "Selecciona tu zona de entrega.";
    if (needsLocation && !location) return "Selecciona la ubicación de entrega usando GPS o tocando el mapa.";
    if (isEntrega2Delivery && (isCalculating || quote.source === "pending")) {
      return "Espera unos segundos mientras cotizamos el delivery con Entrega2 App.";
    }
    return "";
  }

  function buildOrder(): SavedOrder | null {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return null;
    }

    const orderId = createOrderId();
    const totals = { subtotalUsd, deliveryUsd, serviceFeeUsd, totalUsd, totalBs };
    const whatsappMessage = buildOrderMessage({
      orderId,
      store,
      items,
      form,
      location: form.deliveryType === "delivery" ? location : null,
      quote,
      totals,
      mapsUrl: form.deliveryType === "delivery" ? mapsUrl : null,
      routeUrl: form.deliveryType === "delivery" ? routeUrl : null,
    });

    const whatsappUrl = buildWhatsAppUrl(store.whatsappPhone, whatsappMessage);

    return {
      id: orderId,
      storeSlug: store.slug,
      storeName: store.name,
      createdAt: new Date().toISOString(),
      items,
      form,
      location: form.deliveryType === "delivery" ? location : null,
      quote,
      totals,
      mapsUrl: form.deliveryType === "delivery" ? mapsUrl : null,
      routeUrl: form.deliveryType === "delivery" ? routeUrl : null,
      whatsappMessage,
      whatsappUrl,
      tableOrder,
    };
  }

  async function copyPaymentLine(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedPaymentLine(`${label}-${value}`);
    window.setTimeout(() => setCopiedPaymentLine(""), 1800);
  }

  async function sendOrder() {
    if (isSubmitting) return;

    const order = buildOrder();
    if (!order) return;

    setIsSubmitting(true);
    setError("");

    try {
      const saveResult = await saveOrderToSupabase(
        order,
        store,
        idempotencyKeyRef.current
      );

      if (!saveResult.ok || !saveResult.order) {
        setError(saveResult.error || "No se pudo guardar el pedido.");
        return;
      }

      localStorage.setItem(getOrderKey(store.slug), JSON.stringify(saveResult.order));
      if (rememberCustomer) {
        const saved = saveCustomerBrowserProfile(
          saveResult.order.form.customerName,
          saveResult.order.form.customerPhone,
          store.requestCustomerIdNumber ? saveResult.order.form.nationalIdNumber : ""
        );
        setHasSavedCustomer(saved);
      } else {
        clearCustomerBrowserProfile();
        setHasSavedCustomer(false);
      }
      clearCart(store.slug);
      setItems([]);
      if (saveResult.order.form.deliveryType === "table") {
        router.replace(`/${store.slug}/confirmacion`);
        return;
      }
      window.history.replaceState(null, "", `/${store.slug}/confirmacion`);
      window.location.href = saveResult.order.whatsappUrl;
      return;
    } catch (error: any) {
      setError(error.message || "No se pudo guardar el pedido.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="vp-container pb-10 pt-5">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href={`/${store.slug}/carrito`} className="vp-button-soft px-4 py-3">
            <ArrowLeft size={18} /> Volver al carrito
          </Link>
          <span className="text-sm font-black text-[#2E3A79]">{store.name}</span>
        </div>

        <section className="mb-5 rounded-[28px] bg-[#2E3A79] px-5 py-4 text-white shadow-lg shadow-[#2E3A79]/15 sm:px-6">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Finaliza tu pedido</h1>
          <p className="mt-1 text-sm font-semibold text-white/75">Completa tus datos y revisa el total.</p>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            <section className="vp-card p-4 sm:p-5">
              <h2 className="text-xl font-black text-[#25262B]">1. Datos del cliente</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="vp-label">Nombre</span>
                  <input className="vp-input" value={form.customerName} onChange={(event) => updateField("customerName", event.target.value)} placeholder="Ej: Ana Rodríguez" />
                </label>
                <label>
                  <span className="vp-label">Teléfono</span>
                  <input className="vp-input" value={form.customerPhone} onChange={(event) => updateField("customerPhone", event.target.value)} placeholder="Ej: 0412-0000000" />
                </label>
                {store.requestCustomerIdNumber ? (
                  <label>
                    <span className="vp-label">Cédula</span>
                    <div className="flex overflow-hidden rounded-2xl border border-[#25262B]/10 bg-white focus-within:border-[#2E3A79]">
                      <select
                        aria-label="Tipo de cédula"
                        value={getCustomerIdParts(form.nationalIdNumber).type}
                        onChange={(event) => updateCustomerId(event.target.value, getCustomerIdParts(form.nationalIdNumber).number)}
                        className="border-r border-[#25262B]/10 bg-[#F6F4EF] px-3 py-3 text-sm font-black outline-none"
                      >
                        <option value="V">V</option>
                        <option value="E">E</option>
                        <option value="J">J</option>
                      </select>
                      <input inputMode="numeric" className="min-w-0 flex-1 px-4 py-3 text-sm font-bold outline-none" value={getCustomerIdParts(form.nationalIdNumber).number} onChange={(event) => updateCustomerId(getCustomerIdParts(form.nationalIdNumber).type, event.target.value)} placeholder="12345678" />
                    </div>
                  </label>
                ) : null}
              </div>
              {customerProfileLoaded ? (
                <div className="mt-4 rounded-2xl bg-[#F6F4EF] px-4 py-3 ring-1 ring-[#25262B]/10">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={rememberCustomer}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setRememberCustomer(checked);
                        if (!checked && hasSavedCustomer) {
                          clearCustomerBrowserProfile();
                          setHasSavedCustomer(false);
                        }
                      }}
                      className="mt-1 h-4 w-4 accent-[#2E3A79]"
                    />
                    <span className="text-sm font-bold leading-relaxed text-[#5F635E]">
                      Recordar mis datos para próximos pedidos.
                    </span>
                  </label>
                  {hasSavedCustomer ? (
                    <p className="mt-2 flex items-center gap-2 text-xs font-black text-[#2E3A79]">
                      <ShieldCheck size={15} />
                      Datos anteriores cargados. Puedes editarlos.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="vp-card p-4 sm:p-5">
              <span className="vp-label">2. ¿Cómo deseas recibir tu pedido?</span>
              {tableOrder ? (
                <div className="mt-3 rounded-[22px] bg-[#FFB547] p-4 text-[#25262B]">
                  <p className="text-xs font-black uppercase">
                    {tableOrder.fulfillmentMode === "counter_pickup" ? "Entrega" : "Recibir en"}
                  </p>
                  <p className="mt-1 text-lg font-black">{tableOrder.tableName}{tableOrder.tableZone ? ` · ${tableOrder.tableZone}` : ""}</p>
                </div>
              ) : <div className="mt-2">
                <select
                  className="vp-input"
                  value={form.deliveryType}
                  onChange={(event) =>
                    updateField("deliveryType", event.target.value as CheckoutFormData["deliveryType"])
                  }
                >
                  {fulfillmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>}
              {form.deliveryType === "delivery" && deliveryModeCopy ? (
                <p className="mt-3 text-sm font-bold text-[#746f69]">{deliveryModeCopy}</p>
              ) : null}
            </section>

            {form.deliveryType === "table" && tableOrder ? (
              <section className="vp-card p-4 sm:p-5">
                <h2 className="text-xl font-black text-[#25262B]">
                  3. {tableOrder.fulfillmentMode === "counter_pickup" ? "Retiro en barra" : "Entrega en mesa"}
                </h2>
                <p className="mt-2 rounded-[24px] bg-[#FFF8F0] p-4 text-sm font-bold leading-relaxed text-[#746f69]">
                  {tableOrder.fulfillmentMode === "counter_pickup"
                    ? "Prepararemos el pedido después de verificar tu pago. Te avisaremos cuando esté listo para retirar en la barra."
                    : `Prepararemos el pedido después de verificar tu pago y lo llevaremos a ${tableOrder.tableName}.`}
                </p>
              </section>
            ) : form.deliveryType === "delivery" ? (
              <section className="vp-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[#25262B]">3. Ubicación para Delivery</h2>
                  </div>
                  {isCalculating ? <Loader2 className="animate-spin text-[#2E3A79]" /> : <Navigation className="text-[#FFB547]" />}
                </div>
                {needsZone && activeDeliveryZones.length > 0 ? (
                  <label className="mt-4 block">
                    <span className="vp-label">Zona de entrega</span>
                    <select
                      className="vp-input"
                      value={form.deliveryZoneId}
                      onChange={(event) => updateField("deliveryZoneId", event.target.value)}
                    >
                      <option value="">Seleccionar zona</option>
                      {activeDeliveryZones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.name} · {formatBaseCurrency(zone.feeUsd, baseCurrency)}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
                {needsZone && activeDeliveryZones.length === 0 ? (
                  <p className="mt-4 rounded-2xl bg-[#FFF8F0] p-3 text-sm font-black text-[#746f69]">
                    El comercio no tiene zonas activas. Confirma el delivery por WhatsApp.
                  </p>
                ) : null}
                {deliveryPartnerName ? (
                  <aside
                    aria-label="Información sobre la empresa delivery"
                    className="mt-4 flex items-center gap-3 border-l-2 border-[#FFB547] py-1 pl-3"
                  >
                    {deliverySettings.transportAgencyLogoUrl ? (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#F8F3E8] ring-2 ring-white shadow-sm">
                        <OptimizedImage
                          src={deliverySettings.transportAgencyLogoUrl}
                          alt={deliveryPartnerName}
                          fill
                          sizes="48px"
                          className="object-cover"
                          fallback={
                            <div className="grid h-full w-full place-items-center text-sm font-black text-[#2E3A79]">
                              {deliveryPartnerName.slice(0, 1).toUpperCase()}
                            </div>
                          }
                        />
                      </div>
                    ) : (
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F8F3E8] text-sm font-black text-[#2E3A79]">
                        {deliveryPartnerName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">
                        Tu entrega será coordinada por
                      </p>
                      <p className="mt-0.5 text-sm font-black text-[#25262B]">{deliveryPartnerName}</p>
                    </div>
                  </aside>
                ) : null}
                {canShareLocation ? (
                  <div className="mt-4">
                    <LocationPicker
                      storeLatitude={store.latitude}
                      storeLongitude={store.longitude}
                      storeName={store.name}
                      value={location}
                      onChange={setLocation}
                    />
                    {!needsLocation ? (
                      <p className="mt-2 rounded-2xl bg-[#FFF8F0] p-3 text-xs font-black text-[#746f69]">
                        Compartir ubicación es opcional, pero ayuda al comercio y al repartidor a llegar más rápido.
                      </p>
                    ) : location ? null : (
                      <p className="mt-2 rounded-2xl bg-[#FFF8F0] p-3 text-xs font-black text-[#746f69]">
                        Comparte tu ubicación para que el repartidor llegue sin perderse.
                      </p>
                    )}
                  </div>
                ) : null}
                <label className="mt-4 block">
                  <span className="vp-label">Dirección o referencia</span>
                  <textarea className="vp-input min-h-24 resize-none" value={form.deliveryReference} onChange={(event) => updateField("deliveryReference", event.target.value)} placeholder="Ej: casa azul, portón negro, frente a la panadería..." />
                </label>
                {quote.available === false ? (
                  <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-black text-red-700">
                    {quoteMessage || quoteLabel}
                  </p>
                ) : null}
              </section>
            ) : form.deliveryType === "national_shipping" ? (
              <section className="vp-card p-4 sm:p-5">
                <h2 className="text-xl font-black text-[#25262B]">3. Envio nacional</h2>
                <p className="mt-1 text-sm font-bold text-[#746f69]">El comercio coordinará los detalles por WhatsApp.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {!store.requestCustomerIdNumber ? <label>
                    <span className="vp-label">Cedula</span>
                    <div className="flex overflow-hidden rounded-2xl border border-[#25262B]/10 bg-white focus-within:border-[#2E3A79]">
                      <select aria-label="Tipo de cédula" value={getCustomerIdParts(form.nationalIdNumber).type} onChange={(event) => updateCustomerId(event.target.value, getCustomerIdParts(form.nationalIdNumber).number)} className="border-r border-[#25262B]/10 bg-[#F6F4EF] px-3 py-3 text-sm font-black outline-none">
                        <option value="V">V</option><option value="E">E</option><option value="J">J</option>
                      </select>
                      <input inputMode="numeric" className="min-w-0 flex-1 px-4 py-3 text-sm font-bold outline-none" value={getCustomerIdParts(form.nationalIdNumber).number} onChange={(event) => updateCustomerId(getCustomerIdParts(form.nationalIdNumber).type, event.target.value)} placeholder="12345678" />
                    </div>
                  </label> : null}
                  <label>
                    <span className="vp-label">Ciudad de destino</span>
                    <input className="vp-input" value={form.nationalShippingCity} onChange={(event) => updateField("nationalShippingCity", event.target.value)} placeholder="Ej: Valencia" />
                  </label>
                </div>
              </section>
            ) : (
              <section className="vp-card p-4 sm:p-5">
                <h2 className="text-xl font-black text-[#25262B]">3. Retiro (pick up)</h2>
                <p className="mt-2 rounded-[24px] bg-[#FFF8F0] p-4 text-sm font-bold leading-relaxed text-[#746f69]">
                  Retiras directamente en {store.name}. Direccion: {store.address || "por confirmar"}.
                </p>
              </section>
            )}

            <section className="vp-card p-4 sm:p-5">
              <h2 className="text-xl font-black text-[#25262B]">4. ¿Cómo vas a pagar?</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="vp-label">Método de pago</span>
                  <select className="vp-input" value={form.paymentMethod} onChange={(event) => updateField("paymentMethod", event.target.value)}>
                    <option value="">Seleccionar</option>
                    {availablePaymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                  </select>
                </label>
              </div>
              {isCashPayment ? (
                <label className="mt-4 block">
                  <span className="vp-label text-[#25262B]">¿Cómo vas a pagar en efectivo?</span>
                  <span className="mt-1 block text-xs font-bold text-[#746f69]">
                    Indica la moneda o si necesitas cambio.
                  </span>
                  <textarea
                    className="vp-input mt-2 min-h-20 resize-none"
                    value={form.cashPaymentNote}
                    onChange={(event) => updateField("cashPaymentNote", event.target.value)}
                    placeholder="Ej: pago en dólares al recibir o necesito cambio de $20..."
                  />
                </label>
              ) : null}
              {paymentInfo ? (
                <div className="mt-4 rounded-[26px] bg-[#2E3A79] p-4 text-white">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFB547]">
                        Datos para pagar
                      </p>
                      <h3 className="mt-1 text-xl font-black">{paymentInfo.title}</h3>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {paymentInfo.lines.length ? (
                      paymentInfo.lines
                        .filter((line) => line.label !== "Referencia")
                        .map((line) => {
                          const copiedKey = `${line.label}-${line.value}`;

                          return (
                            <div
                              key={`${line.label}-${line.value}`}
                              className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-3 text-sm"
                            >
                              <div className="min-w-0">
                                <span className="block font-bold text-white/70">{line.label}</span>
                                <span className="block break-words font-black">{line.value}</span>
                              </div>
                              {line.copyable ? (
                                <button
                                  type="button"
                                  onClick={() => copyPaymentLine(line.label, line.value)}
                                  className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-[#2E3A79]"
                                >
                                  {copiedPaymentLine === copiedKey ? "Copiado" : "Copiar"}
                                </button>
                              ) : null}
                            </div>
                          );
                        })
                    ) : (
                      <p className="rounded-2xl bg-white/10 p-3 text-sm font-bold text-white/75">
                        El comercio te confirmará los datos de pago por WhatsApp.
                      </p>
                    )}
                  </div>

                  {!paymentInfo.hasConfiguredData && paymentInfo.lines.length > 0 ? (
                    <p className="mt-3 rounded-2xl bg-white/10 p-3 text-xs font-black text-white">
                      No hay datos de pago guardados para este método. Confírmalos por WhatsApp con el comercio.
                    </p>
                  ) : null}

                  {!isCashPayment ? (
                    <label className="mt-4 block">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-white/70">
                        Referencia de pago
                      </span>
                      <input
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm font-bold text-[#25262B] outline-none"
                        value={form.paymentReference}
                        onChange={(event) => updateField("paymentReference", event.target.value)}
                        placeholder="Ej: 123456 o captura enviada por WhatsApp"
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-[30px] border border-[#FFB547]/45 bg-[#FFF8F0] p-4 shadow-sm shadow-[#FFB547]/10 sm:p-5">
              <h2 className="text-xl font-black text-[#25262B]">5. Indicaciones del pedido (opcional)</h2>
              <label className="mt-4 block">
                <textarea
                  aria-label="Indicaciones del pedido"
                  className="vp-input mt-2 min-h-24 resize-none border-[#FFB547]/60 bg-white focus:border-[#F27533]"
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  placeholder={checkoutNoteExample(store.category, store.checkoutNotePlaceholder)}
                />
              </label>
            </section>
          </div>

          <aside className="lg:sticky lg:top-5 lg:self-start">
            <section className="rounded-[36px] bg-[#25262B] p-3 text-white shadow-2xl shadow-[#25262B]/25">
              <div className="rounded-[30px] bg-white p-5 text-[#25262B]">
                <h2 className="text-xl font-black">Revisa tu pedido</h2>
                <div className="mt-4 space-y-3">
                  {items.map((item, index) => (
                    <div key={`${item.productId}-${index}`} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 font-bold text-[#746f69]">
                        {item.quantity}x {item.productName}
                        {item.selectedOptions?.length ? (
                          <span className="mt-1 block text-xs font-semibold">
                            {formatCheckoutOptions(item, baseCurrency)}
                          </span>
                        ) : null}
                      </span>
                      <span className="font-black">{formatBaseCurrency(item.unitPriceUsd * item.quantity, baseCurrency)}</span>
                    </div>
                  ))}
                </div>

                <div className="my-4 h-px bg-[#25262B]/10" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="font-bold text-[#746f69]">Subtotal</span><span className="font-black">{formatBaseCurrency(subtotalUsd, baseCurrency)}</span></div>
                  {form.deliveryType === "delivery" ? (
                    <div className="flex justify-between">
                      <span className="font-bold text-[#746f69]">{fulfillmentLabel}</span>
                      <span className="font-black">{deliveryAmountLabel}</span>
                    </div>
                  ) : null}
                  {form.deliveryType === "delivery" && Number(quote.discountUsd || 0) > 0 ? (
                    <div className="flex justify-between text-green-700">
                      <span className="font-bold">Promo delivery</span>
                      <span className="font-black">-{formatBaseCurrency(quote.discountUsd || 0, baseCurrency)}</span>
                    </div>
                  ) : null}
                  {serviceFeeUsd > 0 ? <div className="flex justify-between"><span className="font-bold text-[#746f69]">Fee</span><span className="font-black">{formatBaseCurrency(serviceFeeUsd, baseCurrency)}</span></div> : null}
                  {showPricesInBs ? (
                    <div className="flex justify-between"><span className="font-bold text-[#746f69]">Tasa usada</span><span className="font-black">{formatBs(store.usdToBs || 600)}</span></div>
                  ) : null}
                  {form.deliveryType === "delivery" ? (
                    <p className="rounded-2xl bg-[#FFF8F0] p-3 text-xs font-black text-[#746f69]">
                      {quoteMessage || quoteLabel} {quote.source === "fallback" ? "· estimado aproximado" : ""}
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 rounded-[24px] bg-[#2E3A79] p-4 text-white">
                  <div className="flex items-end justify-between gap-3">
                    <span className="font-bold text-white/70">Total</span>
                    <div className="text-right">
                      <p className="text-3xl font-black">{formatBaseCurrency(totalUsd, baseCurrency)}</p>
                      {showPricesInBs ? (
                        <p className="text-sm font-black text-[#FFB547]">{formatBs(totalBs)}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                {!openState.isOpen ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{openState.label}. El comercio no está recibiendo pedidos en este momento.</p> : null}
                {error ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
                <div className="mt-4 grid gap-3">
                  <button
              type="button"
              onClick={sendOrder}
              disabled={isSubmitting || !openState.isOpen}
              className={`vp-button-mango w-full disabled:cursor-not-allowed disabled:opacity-70 ${
                !isSubmitting && openState.isOpen ? "vp-confirm-order-attention" : ""
              }`}
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : form.deliveryType === "table" ? (
                <ShieldCheck size={18} />
              ) : (
                <MessageCircle size={18} />
              )}
              {isSubmitting
                ? "Guardando pedido..."
                : !openState.isOpen
                  ? "Comercio cerrado"
                  : form.deliveryType === "table"
                    ? "Confirmar pedido"
                    : "Confirmar pedido por WhatsApp"}
            </button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}








