import type { OrderStatusTiming } from '@/lib/order-status-timing';

export const orderDelayStates = [
  { value: 'received', label: 'Nuevo', defaultMinutes: 10 },
  { value: 'accepted', label: 'Aceptado', defaultMinutes: 10 },
  { value: 'preparing', label: 'Preparando', defaultMinutes: 20 },
  { value: 'ready', label: 'Listo', defaultMinutes: 10 },
  { value: 'delivering', label: 'En camino', defaultMinutes: 30 },
] as const;

export type OrderDelayState = typeof orderDelayStates[number]['value'];
export type OrderDelayThresholds = Record<OrderDelayState, number>;

export const defaultOrderDelayThresholds: OrderDelayThresholds = Object.fromEntries(
  orderDelayStates.map(state => [state.value, state.defaultMinutes]),
) as OrderDelayThresholds;

export function normalizeOrderDelayThresholds(value: unknown): OrderDelayThresholds {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(orderDelayStates.map(state => {
    const parsed = Number(source[state.value]);
    return [state.value, Number.isInteger(parsed) && parsed >= 1 && parsed <= 240
      ? parsed
      : state.defaultMinutes];
  })) as OrderDelayThresholds;
}

export function isOrderDelayed(
  order: OrderStatusTiming,
  thresholds: OrderDelayThresholds | null | undefined,
  now: number,
) {
  const threshold = thresholds?.[order.status as OrderDelayState];
  const start = Date.parse(order.status_entered_at || '');
  return typeof threshold === 'number' && Number.isFinite(start) && Math.max(0, now - start) > threshold * 60_000;
}
