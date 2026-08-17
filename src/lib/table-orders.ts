export type TableOrderContext = {
  storeToken: string;
  tableId: string;
  tableName: string;
  tableZone: string | null;
  paymentMethods: string[];
  fulfillmentMode: "table_service" | "counter_pickup";
};

export type PublicStoreTable = {
  id: string;
  name: string;
  zone: string | null;
};

export const TABLE_ORDERS_CHANGED_EVENT = "vendeplus:table-orders-changed";

export function isPrepaidTablePaymentMethod(method?: string | null) {
  const normalized = String(method || "").trim().toLowerCase();
  if (!normalized) return false;
  return ![
    "efectivo",
    "cash",
    "pago al recibir",
    "contra entrega",
    "punto de venta",
    "punto",
  ].some((blocked) => normalized.includes(blocked));
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
