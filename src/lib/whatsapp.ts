import type { CartItem, CheckoutFormData, DeliveryLocation, DeliveryQuote, OrderTotals, Store } from "@/types";
import { formatBs, formatUsd } from "@/lib/currency";

export function buildWhatsAppUrl(phone: string, message: string) {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
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
  const { orderId, store, items, form, location, quote, totals, mapsUrl, routeUrl } = params;

  const itemsText = items
    .map((item, index) => {
      const variant = item.variantName ? ` (${item.variantName})` : "";
      const notes = item.notes ? `\n   Nota: ${item.notes}` : "";
      return `${index + 1}. ${item.quantity}x ${item.productName}${variant}\n   Unit: ${formatUsd(item.unitPriceUsd)} | Total: ${formatUsd(item.unitPriceUsd * item.quantity)}${notes}`;
    })
    .join("\n\n");

  const deliveryBlock =
    form.deliveryType === "pickup"
      ? `🏬 Modalidad:\nPickup / Retiro en tienda\n\n📍 Retiro en:\n${store.name}\n${store.address}`
      : `🏍️ Modalidad:\nDelivery\n\n📍 Ubicación GPS:\n${mapsUrl || "No indicada"}\n\n🧭 Ruta sugerida:\n${routeUrl || "No disponible"}\n\n📌 Coordenadas:\n${location ? `${location.latitude}, ${location.longitude}` : "No indicadas"}\n\n📏 Distancia:\n${quote.distanceKm !== null ? `${quote.distanceKm.toFixed(2)} km` : "Pendiente"}\n\n🏠 Referencia:\n${form.deliveryReference || "No indicada"}`;

  return `🟠 NUEVO PEDIDO VENDE+\n\n🧾 Pedido:\n${orderId}\n\n🏪 Comercio:\n${store.name}\n\n👤 Cliente:\n${form.customerName}\n\n📞 Teléfono:\n${form.customerPhone}\n\n📦 Detalle del pedido:\n${itemsText}\n\n📝 Detalle adicional del pedido:\n${form.orderDetails || "Sin detalle adicional"}\n\n${deliveryBlock}\n\n💳 Método de pago:\n${form.paymentMethod}\n\n💰 Resumen:\nSubtotal: ${formatUsd(totals.subtotalUsd)}\nDelivery: ${formatUsd(totals.deliveryUsd)}\nTotal USD: ${formatUsd(totals.totalUsd)}\nTotal Bs: ${formatBs(totals.totalBs)}\n\n🗒️ Notas generales:\n${form.notes || "Sin notas"}\n\n✅ Enviado desde Vende+`;
}
