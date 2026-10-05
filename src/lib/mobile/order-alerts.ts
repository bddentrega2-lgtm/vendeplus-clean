type AlertPlugin = {
  status(): Promise<{ granted: boolean }>;
  enable(): Promise<{ granted: boolean }>;
  pushToken?(): Promise<{ token: string }>;
  show(value: { id: string; test?: boolean; kind?: "assistance"; tableName?: string }): Promise<void>;
  clear(): Promise<void>;
  settings(): Promise<void>;
};

export function nativeOrderAlerts(): AlertPlugin | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { Capacitor?: { Plugins?: { SomosOrderAlerts?: AlertPlugin } } }).Capacitor?.Plugins?.SomosOrderAlerts || null;
}

let nativeActive = false;
export function setNativeOrderAlertsActive(active: boolean) { nativeActive = active; }
export function hasNativeOrderAlerts() { return nativeActive; }

export type AlertOrder = { id: string; store_id: string; created_at: string };
export function newOrdersSince(orders: AlertOrder[], known: Set<string>, storeId: string, since: number) {
  return orders.filter(order => (storeId === "all" || order.store_id === storeId) && !known.has(order.id) && Number.isFinite(Date.parse(order.created_at)) && Date.parse(order.created_at) >= since);
}

const ORDER_NOTICE_READ_PREFIX = "somos_order_notice_read_v2_";
const LEGACY_ORDER_NOTICE_READ_PREFIX = "somos_mobile_v1_private_order_read_";

export function orderNoticeReadKey(accountId: string, storeId: string) {
  return `${ORDER_NOTICE_READ_PREFIX}${accountId}:${storeId}`;
}

export function loadOrderNoticeReadIds(accountId: string, storeId: string): { key: string; ids: Set<string> } {
  const key = orderNoticeReadKey(accountId, storeId);
  const current = readOrderNoticeIds(key);
  if (!accountId || !storeId) return { key, ids: current };

  const legacyKey = `${LEGACY_ORDER_NOTICE_READ_PREFIX}${accountId}:${storeId}`;
  const legacy = readOrderNoticeIds(legacyKey);
  if (!legacy.size) return { key, ids: current };

  const ids = rememberReadOrderNotices(key, [...legacy], current);
  try { localStorage.removeItem(legacyKey); } catch { /* Migration is best effort. */ }
  return { key, ids };
}

export function readOrderNoticeIds(key: string): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length <= 128).slice(-500) : []);
  } catch { return new Set(); }
}

export function rememberReadOrderNotices(key: string, ids: string[], current: Set<string>): Set<string> {
  const next = new Set([...readOrderNoticeIds(key), ...current, ...ids].slice(-500));
  try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* Keep the read state in this view when storage is unavailable. */ }
  return next;
}
