"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Copy, Loader2, MessageCircle, Navigation, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CheckoutFormData, DeliveryLocation, DeliveryQuote, SavedOrder, Store } from "@/types";
import { clearCart, getCart, getCartSubtotal } from "@/lib/cart";
import { formatBs, formatUsd } from "@/lib/currency";
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
import { LocationPicker } from "@/components/public/LocationPicker";

const initialForm: CheckoutFormData = {
  customerName: "",
  customerPhone: "",
  deliveryType: "delivery",
  paymentMethod: "",
  paymentReference: "",
  deliveryReference: "",
  deliveryZoneId: "",
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

function formatCheckoutOptions(item: ReturnType<typeof getCart>[number]) {
  const groups = new Map<string, string[]>();

  for (const option of item.selectedOptions || []) {
    const current = groups.get(option.groupName) || [];
    current.push(
      option.priceDeltaUsd > 0
        ? `${option.valueName} (+${formatUsd(option.priceDeltaUsd)})`
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
  const [copied, setCopied] = useState(false);
  const [copiedPaymentLine, setCopiedPaymentLine] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setItems(getCart(store.slug));
  }, [store.slug]);

  const subtotalUsd = useMemo(() => getCartSubtotal(items), [items]);
  const deliverySettings = useMemo(
    () => store.deliverySettings || createDefaultDeliverySettings(),
    [store.deliverySettings]
  );
  const canShareLocation =
    form.deliveryType === "delivery" &&
    deliverySettings.deliveryEnabled &&
    !["manual_quote", "disabled"].includes(deliverySettings.deliveryProvider) &&
    deliverySettings.pricingType !== "zones";
  const needsLocation =
    canShareLocation &&
    (deliverySettings.pricingType === "fixed_distance" ||
      deliverySettings.pricingType === "distance_ranges" ||
      deliverySettings.deliveryProvider === "entrega2");
  const needsZone =
    form.deliveryType === "delivery" &&
    deliverySettings.deliveryEnabled &&
    deliverySettings.pricingType === "zones";
  const activeDeliveryZones = useMemo(
    () => deliverySettings.zones.filter((zone) => zone.isActive),
    [deliverySettings.zones]
  );
  const deliveryModeCopy = useMemo(() => {
    if (deliverySettings.deliveryProvider === "entrega2") {
      return "Comparte tu ubicacion para calcular la tarifa con Entrega2.";
    }
    if (deliverySettings.pricingType === "zones") {
      return "Elige tu zona para sumar el delivery al pedido.";
    }
    if (deliverySettings.pricingType === "fixed_distance") {
      return "Comparte tu ubicacion o toca el mapa para validar la tarifa plana.";
    }
    if (deliverySettings.pricingType === "distance_ranges") {
      return "Comparte tu ubicacion o toca el mapa para calcular el rango de delivery.";
    }
    return "Indica una referencia clara para facilitar la entrega.";
  }, [deliverySettings.deliveryProvider, deliverySettings.pricingType]);

  useEffect(() => {
    setForm((current) => {
      if (!deliverySettings.deliveryEnabled && deliverySettings.pickupEnabled) {
        return { ...current, deliveryType: "pickup" };
      }
      if (deliverySettings.deliveryEnabled && !deliverySettings.pickupEnabled) {
        return { ...current, deliveryType: "delivery" };
      }
      return current;
    });
  }, [deliverySettings.deliveryEnabled, deliverySettings.pickupEnabled]);

  useEffect(() => {
    let active = true;

    async function calculate() {
      if (form.deliveryType === "pickup" || !needsLocation) {
        setQuote(
          calculateDeliveryQuoteFromSettings({
            settings: deliverySettings,
            deliveryType: form.deliveryType,
            subtotalUsd,
            distanceKm: null,
            zoneId: form.deliveryZoneId || null,
            source: form.deliveryType === "pickup" ? "pickup" : "manual",
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
    store.latitude,
    store.longitude,
    subtotalUsd,
  ]);

  const deliveryUsd = form.deliveryType === "delivery" ? quote.feeUsd : 0;
  const deliveryAmountLabel =
    form.deliveryType === "pickup"
      ? "Sin delivery"
      : quote.source === "pending"
        ? "Por calcular"
        : quote.source === "manual" && deliveryUsd === 0
          ? "Por confirmar"
          : formatUsd(quote.originalFeeUsd ?? deliveryUsd);
  const totalUsd = subtotalUsd + deliveryUsd;
  const totalBs = totalUsd * (store.usdToBs || 600);
  const isCashPayment = isCashPaymentMethod(form.paymentMethod);
  const paymentInfo = form.paymentMethod
    ? buildPaymentInfo({
        store,
        paymentMethod: form.paymentMethod,
        totals: { subtotalUsd, deliveryUsd, totalUsd, totalBs },
        customerPaymentNote: form.notes,
        paymentReference: form.paymentReference,
      })
    : null;

  const mapsUrl = location ? buildMapsUrl(location.latitude, location.longitude) : null;
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
    if (store.openState && !store.openState.isOpen) {
      return `${store.openState.label}. El comercio no está recibiendo pedidos en este momento.`;
    }
    if (!form.customerName.trim()) return "Escribe el nombre del cliente.";
    if (!form.customerPhone.trim()) return "Escribe el teléfono del cliente.";
    if (!form.paymentMethod.trim()) return "Selecciona un método de pago.";
    if (form.deliveryType === "delivery" && quote.available === false) {
      return quote.message || quote.label || "Delivery no disponible.";
    }
    if (needsZone && activeDeliveryZones.length > 0 && !form.deliveryZoneId) return "Selecciona tu zona de entrega.";
    if (needsLocation && !location) return "Selecciona la ubicación de entrega usando GPS o tocando el mapa.";
    return "";
  }

  function buildOrder(): SavedOrder | null {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return null;
    }

    const orderId = createOrderId();
    const totals = { subtotalUsd, deliveryUsd, totalUsd, totalBs };
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

  async function copyOrder() {
    const order = buildOrder();
    if (!order) return;
    await navigator.clipboard.writeText(order.whatsappMessage);
    localStorage.setItem(getOrderKey(store.slug), JSON.stringify(order));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
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
      clearCart(store.slug);
      window.open(saveResult.order.whatsappUrl, "_blank", "noopener,noreferrer");
      router.push(`/${store.slug}/confirmacion`);
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
            <div className="absolute right-5 top-5 rounded-full bg-[#FFB547] px-4 py-2 text-sm font-black text-[#25262B]">Vende+</div>
            <p className="text-sm font-bold text-white/65">{store.name}</p>
            <h1 className="mt-2 max-w-xl text-3xl font-black tracking-tight sm:text-5xl">Confirma tu pedido</h1>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-white/72">
              Revisa el total, elige cómo recibirlo y confirma el pedido por WhatsApp.
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
            </section>

            <section className="vp-card p-4 sm:p-5">
              <span className="vp-label">2. ¿Cómo deseas recibir tu pedido?</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {deliverySettings.deliveryEnabled ? (
                  <button
                    type="button"
                    onClick={() => updateField("deliveryType", "delivery")}
                    className={[
                      "rounded-2xl px-4 py-3 text-sm font-black ring-1",
                      form.deliveryType === "delivery"
                        ? "bg-[#2E3A79] text-white ring-[#2E3A79]"
                        : "bg-white text-[#746f69] ring-[#25262B]/10",
                    ].join(" ")}
                  >
                    Delivery
                  </button>
                ) : null}
                {deliverySettings.pickupEnabled ? (
                  <button
                    type="button"
                    onClick={() => updateField("deliveryType", "pickup")}
                    className={[
                      "rounded-2xl px-4 py-3 text-sm font-black ring-1",
                      form.deliveryType === "pickup"
                        ? "bg-[#2E3A79] text-white ring-[#2E3A79]"
                        : "bg-white text-[#746f69] ring-[#25262B]/10",
                    ].join(" ")}
                  >
                    Retiro (pick up)
                  </button>
                ) : null}
              </div>
              <p className="mt-3 rounded-2xl bg-[#FFF8F0] p-3 text-sm font-bold text-[#746f69]">
                {form.deliveryType === "delivery"
                  ? quote.message || deliveryModeCopy
                  : "Retiras directamente en el comercio."}
              </p>
            </section>

            {form.deliveryType === "delivery" ? (
              <section className="vp-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[#25262B]">3. Ubicación para Delivery</h2>
                    <p className="mt-1 text-sm font-bold text-[#746f69]">{deliveryModeCopy}</p>
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
                            {zone.name} · {formatUsd(zone.feeUsd)}
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
                    ) : location ? (
                      <p className="mt-2 rounded-2xl bg-green-50 p-3 text-xs font-black text-green-700">
                        Ubicacion recibida. {isCalculating ? "Calculando delivery..." : quote.label}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <label className="mt-4 block">
                  <span className="vp-label">Dirección o referencia</span>
                  <textarea className="vp-input min-h-24 resize-none" value={form.deliveryReference} onChange={(event) => updateField("deliveryReference", event.target.value)} placeholder="Ej: casa azul, portón negro, frente a la panadería..." />
                </label>
                {quote.available === false ? (
                  <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-black text-red-700">
                    {quote.message || quote.label}
                  </p>
                ) : null}
              </section>
            ) : (
              <section className="vp-card p-4 sm:p-5">
                <h2 className="text-xl font-black text-[#25262B]">3. Retiro (pick up)</h2>
                <p className="mt-2 rounded-[24px] bg-[#FFF8F0] p-4 text-sm font-bold leading-relaxed text-[#746f69]">
                  Retiras directamente en {store.name}. Dirección: {store.address || "por confirmar"}.
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
                      No hay datos de pago guardados para este método. Si ya los cargaste en configuración, aplica la migración de pagos en Supabase y vuelve a guardar.
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
                            {formatCheckoutOptions(item)}
                          </span>
                        ) : null}
                      </span>
                      <span className="font-black">{formatUsd(item.unitPriceUsd * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="my-4 h-px bg-[#25262B]/10" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="font-bold text-[#746f69]">Subtotal</span><span className="font-black">{formatUsd(subtotalUsd)}</span></div>
                  <div className="flex justify-between">
                    <span className="font-bold text-[#746f69]">
                      {form.deliveryType === "delivery" ? "Delivery" : "Retiro (pick up)"}
                    </span>
                    <span className="font-black">
                      {deliveryAmountLabel}
                    </span>
                  </div>
                  {form.deliveryType === "delivery" && Number(quote.discountUsd || 0) > 0 ? (
                    <div className="flex justify-between text-green-700">
                      <span className="font-bold">Promo delivery</span>
                      <span className="font-black">-{formatUsd(quote.discountUsd || 0)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between"><span className="font-bold text-[#746f69]">Tasa usada</span><span className="font-black">{formatBs(store.usdToBs || 600)}</span></div>
                  {form.deliveryType === "delivery" ? (
                    <p className="rounded-2xl bg-[#FFF8F0] p-3 text-xs font-black text-[#746f69]">
                      {quote.message || quote.label} {quote.source === "fallback" ? "· estimado aproximado" : ""}
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 rounded-[24px] bg-[#2E3A79] p-4 text-white">
                  <div className="flex items-end justify-between gap-3">
                    <span className="font-bold text-white/70">Total</span>
                    <div className="text-right">
                      <p className="text-3xl font-black">{formatUsd(totalUsd)}</p>
                      <p className="text-sm font-black text-[#FFB547]">{formatBs(totalBs)}</p>
                    </div>
                  </div>
                </div>

                {error ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
                {copied ? <p className="mt-4 flex items-center gap-2 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-700"><CheckCircle2 size={18} /> Pedido copiado</p> : null}

                <div className="mt-4 grid gap-3">
                  <button
              type="button"
              onClick={sendOrder}
              disabled={isSubmitting}
              className="vp-button-mango w-full disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <MessageCircle size={18} />
              )}
              {isSubmitting ? "Guardando pedido..." : "Confirmar pedido por WhatsApp"}
            </button>
                  <button type="button" onClick={copyOrder} className="vp-button-soft w-full"><Copy size={18} /> Copiar pedido</button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}








