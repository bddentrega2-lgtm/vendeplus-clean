type AlertPlugin = {
  status(): Promise<{ granted: boolean }>;
  enable(): Promise<{ granted: boolean }>;
  show(value: { id: string; test?: boolean }): Promise<void>;
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
  return orders.filter(order => order.store_id === storeId && !known.has(order.id) && Number.isFinite(Date.parse(order.created_at)) && Date.parse(order.created_at) >= since);
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
