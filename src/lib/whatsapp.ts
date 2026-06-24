import type { CartItem, CheckoutFormData, DeliveryLocation, DeliveryQuote, OrderTotals, Store } from "@/types";
import { formatBs, formatUsd } from "@/lib/currency";

export function buildWhatsAppUrl(phone: string, message: string) {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

function cleanText(value?: string | null) {
  return value?.trim() ? value.trim() : "";
}

export function buildOrderMessage(params: {
  orderId: string;
  store: Store;
  items: CartItem[];
  form: CheckoutFormData;
  location: DeliveryLocation | null;
  quote: DeliveryQuote;
  totals: OrderTotals;
  mapsUrl: string | null;
  routeUrl: string | null;
}) {
  const { orderId, store, items, form, quote, totals, mapsUrl } = params;

  const itemsText = items
    .map((item, index) => {
      const variant = item.variantName ? ` (${item.variantName})` : "";
      const note = cleanText(item.notes) ? `\n   Nota: ${cleanText(item.notes)}` : "";
      const options = item.selectedOptions?.length
        ? `\n${item.selectedOptions
            .map((option) => `   ${option.groupName}: ${option.valueName}`)
            .join("\n")}`
        : "";

      return `${index + 1}) ${item.quantity}x ${item.productName}${variant} — ${formatUsd(
        item.unitPriceUsd * item.quantity
      )}${options}${note}`;
    })
    .join("\n");

  const orderDetails = cleanText(form.orderDetails)
    ? `\n📝 ${cleanText(form.orderDetails)}`
    : "";

  const reference = cleanText(form.deliveryReference)
    ? `\n📌 ${cleanText(form.deliveryReference)}`
    : "";

  const notes = cleanText(form.notes)
    ? `\n🗒️ ${cleanText(form.notes)}`
    : "";
  const paymentReference = cleanText(form.paymentReference)
    ? `\n🔎 Referencia: ${cleanText(form.paymentReference)}`
    : "";
  const deliveryPriceText =
    quote.source === "manual" && totals.deliveryUsd === 0
      ? "por confirmar"
      : quote.source === "pending"
        ? "por calcular"
        : formatUsd(totals.deliveryUsd);

  const deliveryBlock =
    form.deliveryType === "pickup"
      ? `🛍️ Retiro (pick up)`
      : `🚚 Delivery: ${deliveryPriceText} | ${
          quote.zoneName ||
          quote.message ||
          (quote.distanceKm !== null
            ? `${quote.distanceKm.toFixed(2)} km`
            : quote.label || "por confirmar")
        }\n📍 ${mapsUrl || "Ubicación pendiente"}${reference}`;

  return `Hola, ya está listo mi pedido.

Código: ${orderId}
Comercio: ${store.name}

Cliente: ${form.customerName} | ${form.customerPhone}

📦 Pedido:
${itemsText}${orderDetails}

${deliveryBlock}

💳 ${form.paymentMethod}${paymentReference}
💰 Total: ${formatUsd(totals.totalUsd)} / ${formatBs(totals.totalBs)}${notes}`;
}
