import { Clock3 } from 'lucide-react';
import { currentOrderStatusMs, formatStatusDuration, recordedOrderStatusTimes, type OrderStatusTiming } from '@/lib/order-status-timing';
import { isOrderDelayed, type OrderDelayThresholds } from '@/lib/order-delay';

export function OrderStatusTime({ order, now, thresholds }: { order: OrderStatusTiming; now: number; thresholds?: OrderDelayThresholds | null }) {
  const current = currentOrderStatusMs(order, now);
  const recorded = recordedOrderStatusTimes(order, now);
  const closed = ['completed', 'cancelled'].includes(order.status);
  const delayed = isOrderDelayed(order, thresholds, now);
  const label = current !== null ? `${delayed ? 'Demorado · ' : ''}${formatStatusDuration(current)} en este estado` : closed ? 'Finalizado' : 'Tiempo sin registro';
  const color = delayed ? 'font-black text-red-700' : 'text-gray-600';
  if (!recorded.length) return <p className={`mt-1 text-xs ${color}`}>{label}</p>;
  return <details className={`mt-1 text-xs ${color}`} data-order-status-time data-delayed={delayed || undefined}>
    <summary className="cursor-pointer py-1" title="Tiempos registrados por estado">
      <Clock3 size={13} className="mr-1 inline" aria-hidden="true" />{label}
    </summary>
    <dl aria-label="Tiempos registrados por estado" className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-1 tabular-nums">
      {recorded.map(state => <div key={state.value} className="contents"><dt>{state.label}</dt><dd>{formatStatusDuration(state.ms)}</dd></div>)}
    </dl>
  </details>;
}
