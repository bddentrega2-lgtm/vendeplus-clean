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

      return `${index + 1}) ${item.quantity}x ${item.productName}${variant} — ${formatUsd(
        item.unitPriceUsd * item.quantity
      )}${note}`;
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

  const deliveryBlock =
    form.deliveryType === "pickup"
      ? `🛍️ Pickup / Retiro`
      : `🚚 Delivery: ${formatUsd(totals.deliveryUsd)} | ${
          quote.distanceKm !== null ? `${quote.distanceKm.toFixed(2)} km` : "distancia pendiente"
        }\n📍 ${mapsUrl || "Ubicación pendiente"}${reference}`;

  return `🟠 ${orderId} | ${store.name}

👤 ${form.customerName} | ${form.customerPhone}

📦 Pedido:
${itemsText}${orderDetails}

${deliveryBlock}

💳 ${form.paymentMethod}
💰 Total: ${formatUsd(totals.totalUsd)} / ${formatBs(totals.totalBs)}${notes}`;
}
