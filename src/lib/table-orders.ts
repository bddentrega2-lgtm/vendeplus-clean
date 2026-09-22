export type TableOrderContext = {
  storeToken: string;
  tableId: string;
  tableName: string;
  tableZone: string | null;
  paymentMethods: string[];
  fulfillmentMode: "table_service" | "counter_pickup";
  waiterCallsEnabled?: boolean;
  waiterCallLabel?: string;
};

export type PublicStoreTable = {
  id: string;
  name: string;
  zone: string | null;
};

export const TABLE_ORDERS_CHANGED_EVENT = "vendeplus:table-orders-changed";

export const TABLE_ASSISTANCE_LABELS = ["Pedir asistencia", "Llamar al anfitrión", "Llamar al mesonero"];

export function normalizeTableAssistanceLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.trim();
  return label.length >= 3 && label.length <= 40 && !/[\u0000-\u001f\u007f]/.test(label) ? label : null;
}

export function getTablePaymentInstructions(method: string, fulfillmentMode?: string) {
  if (fulfillmentMode === "table_service" && /punto/i.test(method)) {
    return "El personal llevará el punto de venta a tu mesa. Confirmaremos el pago antes de preparar tu pedido.";
  }
  return "Paga en caja antes de la preparación. El personal confirmará tu pago.";
}

export function isPrepaidTablePaymentMethod(method?: string | null) {
  const normalized = String(method || "").trim().toLowerCase();
  if (!normalized) return false;
  return ![
    "al recibir",
    "al retirar",
    "contra entrega",
    "contraentrega",
    "al finalizar",
    "pago posterior",
  ].some((blocked) => normalized.includes(blocked));
}

export function isInPersonTablePaymentMethod(method?: string | null) {
  return /efectivo|cash|punto/i.test(method || "");
}

export function availableTablePaymentMethods(storeMethods: unknown): string[] {
  const methods = Array.isArray(storeMethods)
    ? storeMethods.filter((value): value is string => typeof value === "string" && isPrepaidTablePaymentMethod(value)) : [];
  if (!methods.some((value) => /efectivo|cash/i.test(value))) methods.push("Efectivo");
  if (!methods.some((value) => /punto/i.test(value))) methods.push("Punto de venta");
  return [...new Set(methods)];
}

export const TABLE_CANCELLATION_REASONS = [
  "Cliente desistió", "Producto agotado", "Pedido duplicado", "No completó el pago", "Otro",
] as const;

export function tableCancellationReason(reason: unknown, detail: unknown): string | null {
  if (!TABLE_CANCELLATION_REASONS.includes(reason as typeof TABLE_CANCELLATION_REASONS[number])) return null;
  if (reason !== "Otro") return String(reason);
  const text = typeof detail === "string" ? detail.trim() : "";
  return text.length >= 3 && text.length <= 300 ? `Otro: ${text}` : null;
}

function tableOrderStorageKey(storeSlug: string) {
  return `somos_table_order_v1_${storeSlug}`;
}

export function getTableOrderContext(storeSlug: string): TableOrderContext | null {
  if (typeof window === "undefined") return null;

  try {
    const value = JSON.parse(
      sessionStorage.getItem(tableOrderStorageKey(storeSlug)) || "null"
    );
    const fulfillmentMode = value?.fulfillmentMode === "counter_pickup"
      ? "counter_pickup"
      : "table_service";
    return value?.storeToken && value?.tableName && Array.isArray(value.paymentMethods) &&
      (fulfillmentMode === "counter_pickup" || value?.tableId)
      ? { ...value, fulfillmentMode }
      : null;
  } catch {
    return null;
  }
}

export function saveTableOrderContext(
  storeSlug: string,
  context: TableOrderContext
) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(tableOrderStorageKey(storeSlug), JSON.stringify(context));
}

export function clearTableOrderContext(storeSlug: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(tableOrderStorageKey(storeSlug));
}
