export const paymentStatuses = [
  "pending",
  "review",
  "verified",
  "incomplete",
  "cash_on_delivery",
  "cancelled",
] as const;

export type PaymentStatus = (typeof paymentStatuses)[number];

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: "Pago pendiente",
  review: "En revision",
  verified: "Pago verificado",
  incomplete: "Pago incompleto",
  cash_on_delivery: "Pago al recibir",
  cancelled: "Pago cancelado",
};

export function normalizePaymentMethodName(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getPaymentDetailsKey(value?: string | null) {
  const normalized = normalizePaymentMethodName(value);

  if (normalized.includes("movil")) return "pagoMovil";
  if (normalized.includes("transfer")) return "transferencia";
  if (normalized.includes("zelle")) return "zelle";
  if (normalized.includes("binance")) return "binance";
  if (normalized.includes("efectivo") || normalized.includes("cash")) return "efectivo";

  return null;
}

export function isCashPaymentMethod(value?: string | null) {
  const normalized = normalizePaymentMethodName(value);
  return normalized.includes("efectivo") || normalized.includes("cash");
}

export function getInitialPaymentStatus(value?: string | null): PaymentStatus {
  return isCashPaymentMethod(value) ? "cash_on_delivery" : "pending";
}

export function getSuggestedPaymentCurrency(value?: string | null) {
  const key = getPaymentDetailsKey(value);

  if (key === "pagoMovil" || key === "transferencia") return "VES";
  if (key === "zelle" || key === "binance" || key === "efectivo") return "USD";

  return "";
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return paymentStatuses.includes(value as PaymentStatus);
}
