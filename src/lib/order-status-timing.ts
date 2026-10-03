export type OrderStatusTiming = {
  status: string;
  status_entered_at?: string | null;
  status_elapsed_ms?: Record<string, number> | null;
};

export const timedOrderStates = [
  { value: 'received', label: 'Recibido' },
  { value: 'accepted', label: 'Aceptado' },
  { value: 'preparing', label: 'En preparacion' },
  { value: 'ready', label: 'Listo' },
  { value: 'delivering', label: 'En camino' },
] as const;

export function currentOrderStatusMs(order: OrderStatusTiming, now: number): number | null {
  if (!timedOrderStates.some(state => state.value === order.status)) return null;
  const start = Date.parse(order.status_entered_at || '');
  return Number.isFinite(start) ? Math.max(0, now - start) : null;
}

export function recordedOrderStatusTimes(order: OrderStatusTiming, now: number) {
  const current = currentOrderStatusMs(order, now);
  return timedOrderStates.flatMap(state => {
    const stored = order.status_elapsed_ms?.[state.value];
    const hasStored = typeof stored === 'number' && Number.isFinite(stored) && stored >= 0;
    const active = state.value === order.status && current !== null;
    return hasStored || active
      ? [{ ...state, ms: (hasStored ? stored : 0) + (active ? current : 0) }]
      : [];
  });
}

export function formatStatusDuration(ms: number) {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (!minutes) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
