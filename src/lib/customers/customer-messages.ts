import { getWhatsappPhone } from "@/lib/customers/normalize-phone";

export function buildWhatsappUrl(phone: string, message: string) {
  const cleanPhone = getWhatsappPhone(phone);
  if (!cleanPhone) return "";
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export function summarizeOrderItems(items: any[]) {
  if (!items?.length) return "tu pedido anterior";

  return items
    .map((item) => {
      const variant = item.variant_name ? ` (${item.variant_name})` : "";
      return `- ${item.quantity}x ${item.product_name}${variant}`;
    })
    .join("\n");
}

export function buildRepeatLastOrderMessage({
  customerName,
  storeName,
  items,
}: {
  customerName: string;
  storeName: string;
  items: any[];
}) {
  return [
    `Hola ${customerName || "amigo"}, ¿quieres repetir tu último pedido de ${storeName}?`,
    "",
    "Tu último pedido fue:",
    summarizeOrderItems(items),
    "",
    "Si quieres, te lo preparamos nuevamente.",
  ].join("\n");
}

export function buildContactAgainMessage({
  customerName,
  storeName,
}: {
  customerName: string;
  storeName: string;
}) {
  return `Hola ${customerName || "amigo"}, tenemos novedades en ${storeName}. ¿Te gustaría hacer un pedido hoy?`;
}
