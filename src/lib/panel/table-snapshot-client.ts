"use client";

import { getPanelAuthHeaders, getSavedPanelToken } from "./client-auth";

export type TableRow = { id: string; name: string; zone: string | null; is_enabled: boolean };
export type WaiterCall = { table_id: string; requested_at: string };
export type ActiveTableOrder = {
  id: string; public_code: string; store_table_id: string | null;
  table_name_snapshot: string | null; table_fulfillment_snapshot: "table_service" | "counter_pickup" | null;
  total_usd: number | string; status: string; created_at: string;
  customer_name: string | null; payment_method: string | null; payment_status: string | null;
  payment_reference: string | null; has_payment_receipt: boolean;
};
export type TableSnapshot = {
  tables: TableRow[]; activeOrders: ActiveTableOrder[]; waiterCalls: WaiterCall[];
  enabled: boolean; waiterCallsEnabled: boolean; waiterCallLabel: string;
  fulfillmentMode: "table_service" | "counter_pickup";
  paymentMethods: string[]; selectedPaymentMethods: string[]; qrToken: string;
};
type Entry = { data?: TableSnapshot; fetchedAt: number; revision: number; sequence: number; appliedSequence: number; full?: Promise<TableSnapshot>; live?: Promise<TableSnapshot> };
const snapshots = new Map<string, Entry>();
const scopeKey = (storeId: string) => `${getSavedPanelToken()}|${storeId}`;

export async function requestTableJson(url: string, options: RequestInit = {}) {
  const signal = AbortSignal.timeout(15_000);
  const isRead = !options.method || options.method === "GET";
  try {
    const response = await fetch(url, { ...options, signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo completar la solicitud.");
    return data;
  } catch (error) {
    if (signal.aborted || error instanceof TypeError) {
      throw new Error(isRead
        ? "No pudimos cargar los datos. Revisa tu conexion e intenta de nuevo."
        : "No pudimos confirmar el cambio. Revisa el estado del pedido antes de reintentar.");
    }
    throw error;
  }
}

export function getCachedTableSnapshot(storeId: string) {
  if (!storeId || !getSavedPanelToken()) return null;
  const entry = snapshots.get(scopeKey(storeId));
  return entry?.data && Date.now() - entry.fetchedAt < 30_000 ? entry.data : null;
}

export async function fetchTableSnapshot(storeId: string, live = false): Promise<TableSnapshot> {
  const headers = await getPanelAuthHeaders();
  const key = scopeKey(storeId);
  let entry = snapshots.get(key);
  if (!entry) {
    if (snapshots.size >= 8) snapshots.delete(snapshots.keys().next().value!);
    entry = { fetchedAt: 0, revision: 0, sequence: 0, appliedSequence: 0 };
    snapshots.set(key, entry);
  }
  // Initial screen and notifier share one request; live refreshes never request the QR.
  const kind = live && entry.data ? "live" : "full";
  if (entry.full) return entry.full;
  if (entry[kind]) return entry[kind]!;
  const target = entry;
  const revision = target.revision;
  const sequence = ++target.sequence;
  const request = (async () => {
    const data = await requestTableJson(`/api/panel/tables?storeId=${encodeURIComponent(storeId)}${kind === "live" ? "&view=live" : ""}`, { headers, cache: "no-store" });
    // An older snapshot must not undo an order already confirmed by the server.
    if ((target.revision !== revision || sequence < target.appliedSequence) && target.data) return target.data;
    target.data = { ...target.data, ...data } as TableSnapshot;
    target.fetchedAt = Date.now();
    target.appliedSequence = sequence;
    return target.data;
  })();
  target[kind] = request;
  try { return await request; }
  finally { if (target[kind] === request) delete target[kind]; }
}

export function applyConfirmedTableOrder(storeId: string, order: Pick<ActiveTableOrder, "id"> & Partial<ActiveTableOrder>) {
  const entry = snapshots.get(scopeKey(storeId));
  if (!entry?.data) return;
  entry.revision++;
  entry.data = { ...entry.data, activeOrders: entry.data.activeOrders
    .map((current) => current.id === order.id ? { ...current, ...order } : current)
    .filter((current) => !["completed", "cancelled"].includes(current.status)) };
}
