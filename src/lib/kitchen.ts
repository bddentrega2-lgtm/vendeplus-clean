export type KitchenState = 'queued' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type KitchenTicket = {
  order_id: string; state: KitchenState; sent_at: string; started_at: string | null;
  ready_at: string | null; closed_at: string | null; dispatch_method: string; payment_at_dispatch: string | null;
};
export type KitchenOrder = {
  id: string; public_code: string; customer_name?: string | null; created_at: string; status: string; delivery_type: string;
  status_entered_at?: string | null; status_elapsed_ms?: Record<string, number> | null;
  delivery_pricing_type?: string | null; table_name_snapshot?: string | null;
  table_fulfillment_snapshot?: string | null; delivery_reference?: string | null;
  notes?: string | null; order_details?: string | null; table_cancellation_reason?: string | null;
  order_items?: Array<{ id: string; product_name: string; variant_name: string | null; quantity: number; notes: string | null;
    order_item_options?: Array<{ id: string; option_group_name: string; option_name: string; quantity: number }> }>;
};
export function kitchenEligible(store?: { table_orders_access_enabled?: boolean; table_orders_enabled?: boolean } | null) {
  return store?.table_orders_access_enabled === true && store?.table_orders_enabled === true;
}
export const kitchenStateLabels: Record<KitchenState, string> = {
  queued: 'Por preparar', preparing: 'En preparación', ready: 'Listo', completed: 'Finalizado', cancelled: 'Cancelado',
};
export function kitchenMode(order: Pick<KitchenOrder, 'delivery_type' | 'delivery_pricing_type' | 'table_fulfillment_snapshot'>) {
  if (order.delivery_pricing_type === 'bar' || order.table_fulfillment_snapshot === 'counter_pickup') return 'Barra';
  if (order.delivery_type === 'table' || order.delivery_pricing_type === 'table') return 'Mesa';
  return order.delivery_type === 'delivery' ? 'Delivery' : 'Retiro';
}
export function kitchenOrigin(order: Pick<KitchenOrder, 'delivery_type' | 'notes'>) {
  // Legacy manual creation stores a server-authored prefix; QR uses delivery_type=table.
  if (/^Pedido manual(?:\.|\s*[·])/i.test(order.notes || '')) return 'Manual';
  return order.delivery_type === 'table' ? 'QR' : 'Catálogo';
}
export function kitchenOrderNote(order: Pick<KitchenOrder, 'notes' | 'order_details'>) {
  const note = (order.notes || '').trim().replace(/^Pedido manual(?:\.|\s*[·])\s*/i, '').trim();
  if (!note || note === order.order_details || /^(Mesa|Barra)\.$/i.test(note)) return '';
  return note;
}
export function elapsedKitchen(start: string | null | undefined, now: number, end?: string | null) {
  if (!start || !Number.isFinite(Date.parse(start))) return '--';
  const minutes = Math.floor(Math.max(0, (end ? Date.parse(end) : now) - Date.parse(start)) / 60_000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
