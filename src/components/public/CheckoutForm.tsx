"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Copy, Loader2, MessageCircle, Navigation } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CheckoutFormData, DeliveryLocation, DeliveryQuote, SavedOrder, Store } from "@/types";
import { clearCart, getCart, getCartSubtotal } from "@/lib/cart";
import { formatBs, formatUsd, usdToBs } from "@/lib/currency";
import { buildDeliveryQuote, buildMapsUrl, buildRouteUrl, calculateRouteDistanceKm } from "@/lib/delivery";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { saveOrderToSupabase } from "@/lib/supabase/orders";
import { LocationPicker } from "@/components/public/LocationPicker";

const initialForm: CheckoutFormData = {
  customerName: "",
  customerPhone: "",
  deliveryType: "delivery",
  paymentMethod: "",
  deliveryReference: "",
  orderDetails: "",
  notes: "",
};

export function getOrderKey(storeSlug: string) {
  return `vendeplus_last_order_${storeSlug}`;
}

function createOrderId() {
  const date = new Date();
  const part = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VP-${part}-${random}`;
}

export function CheckoutForm({ store }: { store: Store }) {
  const router = useRouter();
  const [items, setItems] = useState<ReturnType<typeof getCart>>([]);
  const [form, setForm] = useState<CheckoutFormData>(initialForm);
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [quote, setQuote] = useState<DeliveryQuote>(buildDeliveryQuote(null, "pending"));
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setItems(getCart(store.slug));
  }, [store.slug]);

  useEffect(() => {
    let active = true;

    async function calculate() {
      if (form.deliveryType === "pickup") {
        setQuote({ distanceKm: 0, feeUsd: 0, label: "Retiro en tienda", source: "pickup" });
        setIsCalculating(false);
        return;
      }

      if (!location) {
        setQuote(buildDeliveryQuote(null, "pending"));
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
      setQuote(buildDeliveryQuote(result.distanceKm, result.source));
      setIsCalculating(false);
    }

    calculate();
    return () => {
      active = false;
    };
  }, [form.deliveryType, location, store.latitude, store.longitude]);

  const subtotalUsd = useMemo(() => getCartSubtotal(items), [items]);
  const deliveryUsd = form.deliveryType === "delivery" ? quote.feeUsd : 0;
  const totalUsd = subtotalUsd + deliveryUsd;
  const totalBs = usdToBs(totalUsd);

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
    if (!form.customerName.trim()) return "Escribe el nombre del cliente.";
    if (!form.customerPhone.trim()) return "Escribe el teléfono del cliente.";
    if (!form.paymentMethod.trim()) return "Selecciona un método de pago.";
    if (form.deliveryType === "delivery" && !location) return "Selecciona la ubicación de entrega usando GPS o tocando el mapa.";
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

  async function sendOrder() {
    if (isSubmitting) return;

    const order = buildOrder();
    if (!order) return;

    setIsSubmitting(true);
    setError("");

    try {
      const saveResult = await saveOrderToSupabase(order, store);

      if (!saveResult.ok) {
        console.warn("No se pudo guardar el pedido en Supabase:", saveResult.error);
      }
    } catch (error) {
      console.warn("Error inesperado guardando el pedido:", error);
    }

    localStorage.setItem(getOrderKey(store.slug), JSON.stringify(order));
    clearCart(store.slug);
    window.open(order.whatsappUrl, "_blank", "noopener,noreferrer");
    router.push(`/${store.slug}/confirmacion`);
  }

  return (
    <main className="vp-container pb-10 pt-5">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link href={`/${store.slug}/carrito`} className="vp-button-soft px-4 py-3">
            <ArrowLeft size={18} /> Volver al carrito
          </Link>
          <div className="rounded-full bg-[#2E3A79] px-4 py-3 text-sm font-black text-white">Checkout seguro</div>
        </div>

        <section className="mb-5 overflow-hidden rounded-[36px] bg-[#2E3A79] text-white shadow-2xl shadow-[#2E3A79]/20">
          <div className="relative p-5 sm:p-7">
            <div className="absolute right-5 top-5 rounded-full bg-[#FFB547] px-4 py-2 text-sm font-black text-[#25262B]">Vende+</div>
            <p className="text-sm font-bold text-white/65">{store.name}</p>
            <h1 className="mt-2 max-w-xl text-3xl font-black tracking-tight sm:text-5xl">Confirma tu pedido</h1>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-white/72">
              Calculamos la entrega por ubicación, armamos el pedido completo y lo dejamos listo para WhatsApp.
            </p>
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
              <h2 className="text-xl font-black text-[#25262B]">2. Modalidad</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => updateField("deliveryType", "delivery")} className={form.deliveryType === "delivery" ? "rounded-[24px] bg-[#2E3A79] p-4 text-left text-white" : "rounded-[24px] bg-[#FFF8F0] p-4 text-left text-[#25262B] ring-1 ring-[#25262B]/[0.07]"}>
                  <p className="text-lg font-black">Entrega</p>
                  <p className="mt-1 text-sm font-bold opacity-75">GPS o mapa + tarifa automática</p>
                </button>
                <button type="button" onClick={() => updateField("deliveryType", "pickup")} className={form.deliveryType === "pickup" ? "rounded-[24px] bg-[#2E3A79] p-4 text-left text-white" : "rounded-[24px] bg-[#FFF8F0] p-4 text-left text-[#25262B] ring-1 ring-[#25262B]/[0.07]"}>
                  <p className="text-lg font-black">Retiro</p>
                  <p className="mt-1 text-sm font-bold opacity-75">Retiro en tienda, sin costo de entrega</p>
                </button>
              </div>
            </section>

            {form.deliveryType === "delivery" ? (
              <section className="vp-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[#25262B]">3. Ubicación de entrega</h2>
                    <p className="mt-1 text-sm font-bold text-[#746f69]">Usa tu ubicación actual o toca el punto exacto en el mapa.</p>
                  </div>
                  {isCalculating ? <Loader2 className="animate-spin text-[#2E3A79]" /> : <Navigation className="text-[#FFB547]" />}
                </div>
                <div className="mt-4">
                  <LocationPicker storeLatitude={store.latitude} storeLongitude={store.longitude} value={location} onChange={setLocation} />
                </div>
                <label className="mt-4 block">
                  <span className="vp-label">Referencia opcional</span>
                  <textarea className="vp-input min-h-24 resize-none" value={form.deliveryReference} onChange={(event) => updateField("deliveryReference", event.target.value)} placeholder="Ej: casa azul, portón negro, frente a la panadería..." />
                </label>
              </section>
            ) : (
              <section className="vp-card p-4 sm:p-5">
                <h2 className="text-xl font-black text-[#25262B]">3. Retiro en tienda</h2>
                <p className="mt-2 rounded-[24px] bg-[#FFF8F0] p-4 text-sm font-bold leading-relaxed text-[#746f69]">
                  El cliente retirará en {store.name}. Dirección: {store.address}. Tiempo estimado: {store.pickupEstimate}.
                </p>
              </section>
            )}

            <section className="vp-card p-4 sm:p-5">
              <h2 className="text-xl font-black text-[#25262B]">4. Pago y detalles</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="vp-label">Método de pago</span>
                  <select className="vp-input" value={form.paymentMethod} onChange={(event) => updateField("paymentMethod", event.target.value)}>
                    <option value="">Seleccionar</option>
                    {store.paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                  </select>
                </label>
                <label>
                  <span className="vp-label">Detalle del pedido</span>
                  <input className="vp-input" value={form.orderDetails} onChange={(event) => updateField("orderDetails", event.target.value)} placeholder="Ej: sin cebolla, enviar factura..." />
                </label>
              </div>
              <label className="mt-4 block">
                <span className="vp-label">Nota adicional</span>
                <textarea className="vp-input min-h-24 resize-none" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="Cualquier instrucción extra para el comercio u operadora." />
              </label>
            </section>
          </div>

          <aside className="lg:sticky lg:top-5 lg:self-start">
            <section className="rounded-[36px] bg-[#25262B] p-3 text-white shadow-2xl shadow-[#25262B]/25">
              <div className="rounded-[30px] bg-white p-5 text-[#25262B]">
                <h2 className="text-xl font-black">Resumen</h2>
                <div className="mt-4 space-y-3">
                  {items.map((item, index) => (
                    <div key={`${item.productId}-${index}`} className="flex justify-between gap-3 text-sm">
                      <span className="font-bold text-[#746f69]">{item.quantity}x {item.productName}</span>
                      <span className="font-black">{formatUsd(item.unitPriceUsd * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="my-4 h-px bg-[#25262B]/10" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="font-bold text-[#746f69]">Subtotal</span><span className="font-black">{formatUsd(subtotalUsd)}</span></div>
                  <div className="flex justify-between"><span className="font-bold text-[#746f69]">Entrega</span><span className="font-black">{form.deliveryType === "delivery" ? formatUsd(deliveryUsd) : "Gratis"}</span></div>
                  {form.deliveryType === "delivery" ? <p className="rounded-2xl bg-[#FFF8F0] p-3 text-xs font-black text-[#746f69]">{quote.label} {quote.source === "fallback" ? "· estimado aproximado" : ""}</p> : null}
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
              {isSubmitting ? "Guardando pedido..." : "Enviar por WhatsApp"}
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








