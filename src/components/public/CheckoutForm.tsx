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
  calculateRouteDistanceKm,
  createDefaultDeliverySettings,
} from "@/lib/delivery";
import { isCashPaymentMethod } from "@/lib/payments";
import { buildPaymentInfo } from "@/lib/payment-display";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { saveOrderToSupabase } from "@/lib/supabase/orders";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import { useLiveStoreOpenState } from "@/hooks/use-live-store-open-state";

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
  nationalIdNumber: "",
  nationalShippingCity: "",
  orderDetails: "",
  notes: "",
};

export function getOrderKey(storeSlug: string) {
  return `vendeplus_last_order_${storeSlug}`;
}

function createOrderId() {
  const date = new Date();
  const dayCode = `${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `VP-${dayCode}-${random}`;
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

  useEffect(() => {
    setItems(getCart(store.slug));
    router.prefetch(`/${store.slug}/confirmacion`);
  }, [router, store.slug]);

  useEffect(() => {
    const profile = getCustomerBrowserProfile();
    if (profile) {
      setForm((current) => ({
        ...current,
        customerName: current.customerName || profile.name,
        customerPhone: current.customerPhone || profile.phone,
      }));
      setHasSavedCustomer(true);
    }
    setCustomerProfileLoaded(true);
  }, []);

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
      if (deliverySettings.deliveryProvider === "entrega2") {
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
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (!active || lastQuoteRequestRef.current !== requestKey) return;
          if (!response.ok || !data?.quote) {
            setQuote({
              distanceKm: null,
              feeUsd: 0,
              label: data?.error || "No pudimos cotizar el delivery con Entrega2 App.",
              source: "pending",
              available: false,
              provider: "entrega2",
              pricingType: "manual",
              message: data?.error || "No pudimos cotizar el delivery con Entrega2 App.",
            });
            return;
          }
          setQuote(data.quote);
        } catch {
          if (!active || lastQuoteRequestRef.current !== requestKey) return;
          setQuote({
            distanceKm: null,
            feeUsd: 0,
            label: "No pudimos cotizar el delivery con Entrega2 App.",
            source: "pending",
            available: false,
            provider: "entrega2",
            pricingType: "manual",
            message: "No pudimos cotizar el delivery con Entrega2 App. Intenta de nuevo.",
          });
        } finally {
          if (active) setIsCalculating(false);
        }
        return;
      }

      const result = await calculateRouteDistanceKm({
        originLat: store.latitude,
        originLng: store.longitude,
        destinationLat: location.latitude,
        destinationLng: location.longitude,
      });

      if (!active) return;
      setQuote(
        calculateDeliveryQuoteFromSettings({
          settings: deliverySettings,
          deliveryType: "delivery",
          subtotalUsd,
          distanceKm: result.distanceKm,
          zoneId: form.deliveryZoneId || null,
          source: result.source,
        })
      );
      setIsCalculating(false);
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
    deliverySettings.deliveryEnabled
      ? { value: "delivery" as const, label: deliveryOptionLabel }
      : null,
    deliverySettings.pickupEnabled ? { value: "pickup" as const, label: "Retiro (pick up)" } : null,
    deliverySettings.nationalShippingEnabled
      ? { value: "national_shipping" as const, label: "Envio nacional" }
      : null,
  ].filter(Boolean) as Array<{ value: CheckoutFormData["deliveryType"]; label: string }>;
  const fulfillmentLabel =
    form.deliveryType === "delivery"
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
    ["per_service", "custom"].includes(String(store.planType || "")) &&
    store.serviceFeePayer === "customer"
      ? Number(store.serviceFeeUsd || 0)
      : 0;
  const totalUsd = subtotalUsd + deliveryUsd + serviceFeeUsd;
  const totalBs = totalUsd * (store.usdToBs || 600);
  const isCashPayment = isCashPaymentMethod(form.paymentMethod);
  const paymentInfo = form.paymentMethod
    ? buildPaymentInfo({
        store,
        paymentMethod: form.paymentMethod,
        totals: { subtotalUsd, deliveryUsd, serviceFeeUsd, totalUsd, totalBs },
        customerPaymentNote: form.notes,
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

  function validate() {
    if (items.length === 0) return "Tu carrito está vacío.";
    if (!openState.isOpen) {
      return `${openState.label}. El comercio no está recibiendo pedidos en este momento.`;
    }
    if (!form.customerName.trim()) return "Escribe el nombre del cliente.";
    if (!form.customerPhone.trim()) return "Escribe el teléfono del cliente.";
    if (!form.paymentMethod.trim()) return "Selecciona un método de pago.";
    if (form.deliveryType === "delivery" && quote.available === false) {
      return quote.message || quote.label || "Delivery no disponible.";
    }
    if (form.deliveryType === "national_shipping" && !form.nationalIdNumber.trim()) {
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
      const saveResult = await saveOrderToSupabase(order, store);

      if (!saveResult.ok || !saveResult.order) {
        setError(saveResult.error || "No se pudo guardar el pedido.");
        return;
      }

      localStorage.setItem(getOrderKey(store.slug), JSON.stringify(saveResult.order));
      if (rememberCustomer) {
        const saved = saveCustomerBrowserProfile(
          saveResult.order.form.customerName,
          saveResult.order.form.customerPhone
        );
        setHasSavedCustomer(saved);
      } else {
        clearCustomerBrowserProfile();
        setHasSavedCustomer(false);
      }
      clearCart(store.slug);
      setItems([]);
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
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link href={`/${store.slug}/carrito`} className="vp-button-soft px-4 py-3">
            <ArrowLeft size={18} /> Volver al carrito
          </Link>
          <div className="rounded-full bg-[#2E3A79] px-4 py-3 text-sm font-black text-white">Finalizar pedido</div>
        </div>

        <section className="mb-5 overflow-hidden rounded-[36px] bg-[#2E3A79] text-white shadow-2xl shadow-[#2E3A79]/20">
          <div className="relative p-5 sm:p-7">
            <div className="absolute right-5 top-5 rounded-full bg-[#FFB547] px-4 py-2 text-sm font-black text-[#25262B]">Somos</div>
            <p className="text-sm font-bold text-white/65">{store.name}</p>
            <h1 className="mt-2 max-w-xl text-3xl font-black tracking-tight sm:text-5xl">Confirma tu pedido</h1>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-white/72">
              Revisa el total, agrega como recibirlo y confirma el pedido por WhatsApp.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-2 text-xs font-black text-white">
                <ShieldCheck size={15} className="text-[#FFB547]" />
                Total claro antes de pagar
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-2 text-xs font-black text-white">
                <MessageCircle size={15} className="text-[#FFB547]" />
                Confirmación por WhatsApp
              </span>
            </div>
          </div>
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
                      Recordar mi nombre y teléfono en este dispositivo para mis próximos pedidos en Somos.
                    </span>
                  </label>
                  {hasSavedCustomer ? (
                    <p className="mt-2 flex items-center gap-2 text-xs font-black text-[#2E3A79]">
                      <ShieldCheck size={15} />
                      Usamos los datos guardados de tu pedido anterior. Puedes editarlos.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="vp-card p-4 sm:p-5">
              <span className="vp-label">2. ¿Cómo deseas recibir tu pedido?</span>
              <div className="mt-2">
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
              </div>
              <p className="mt-3 rounded-2xl bg-[#FFF8F0] p-3 text-sm font-bold text-[#746f69]">
                {form.deliveryType === "delivery"
                  ? deliveryModeCopy
                  : form.deliveryType === "national_shipping"
                    ? "Indica cedula y ciudad. El comercio coordinara el envio nacional por WhatsApp."
                    : "Retiras directamente en el comercio."}
              </p>
            </section>

            {form.deliveryType === "delivery" ? (
              <section className="vp-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[#25262B]">3. Ubicación para Delivery</h2>
                    <p className="mt-1 text-sm font-bold text-[#746f69]">Carga la ubicación donde quieres recibir el pedido.</p>
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
                  <div className="mt-4 flex items-center gap-3 rounded-3xl border border-[#EFE6D6] bg-[#FFF8F0] p-3">
                    {deliverySettings.transportAgencyLogoUrl ? (
                      <OptimizedImage
                        src={deliverySettings.transportAgencyLogoUrl}
                        alt={deliveryPartnerName}
                        width={44}
                        height={44}
                        sizes="44px"
                        className="h-11 w-11 rounded-2xl bg-white object-contain p-1"
                        fallback={
                          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-sm font-black text-[#2E3A79]">
                            {deliveryPartnerName.slice(0, 1).toUpperCase()}
                          </div>
                        }
                      />
                    ) : (
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-sm font-black text-[#2E3A79]">
                        {deliveryPartnerName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-black text-[#25262B]">
                        Delivery gestionado por {deliveryPartnerName}
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-[#746f69]">
                        La empresa delivery recibirá los datos necesarios para coordinar la entrega.
                      </p>
                    </div>
                  </div>
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
                <p className="mt-2 rounded-[24px] bg-[#FFF8F0] p-4 text-sm font-bold leading-relaxed text-[#746f69]">
                  El comercio coordinara agencia, costo y detalles finales por WhatsApp. Por ahora deja estos datos para identificar el envio.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="vp-label">Cedula</span>
                    <input className="vp-input" value={form.nationalIdNumber} onChange={(event) => updateField("nationalIdNumber", event.target.value)} placeholder="Ej: V-12345678" />
                  </label>
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
                    {store.paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                  </select>
                </label>
              </div>
              <label className="mt-4 block">
                <span className="vp-label">
                  {isCashPayment ? "¿Cómo vas a cancelar?" : "Nota adicional"}
                </span>
                <textarea
                  className="vp-input min-h-24 resize-none"
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  placeholder={
                    isCashPayment
                      ? "Ej: pago en dólares al recibir, pago en Bs al retirar, necesito cambio de $20..."
                      : "Cualquier instrucción extra para el comercio u operadora."
                  }
                />
              </label>
              {isCashPayment ? (
                <p className="mt-2 rounded-2xl bg-[#FFF8F0] p-3 text-xs font-black text-[#746f69]">
                  Esta información llegará al comercio junto con tu pedido.
                </p>
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

                  {!paymentInfo.hasConfiguredData ? (
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
                  <div className="flex justify-between">
                    <span className="font-bold text-[#746f69]">
                      {fulfillmentLabel}
                    </span>
                    <span className="font-black">
                      {deliveryAmountLabel}
                    </span>
                  </div>
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
              ) : (
                <MessageCircle size={18} />
              )}
              {isSubmitting ? "Guardando pedido..." : !openState.isOpen ? "Comercio cerrado" : "Confirmar pedido por WhatsApp"}
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








