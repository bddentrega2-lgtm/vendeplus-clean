import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { elapsedKitchen, kitchenEligible, kitchenMode, kitchenOrderNote, kitchenOrigin } from '../src/lib/kitchen.ts';
import { defaultOrderDelayThresholds, isOrderDelayed, normalizeOrderDelayThresholds } from '../src/lib/order-delay.ts';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('kitchen needs both admin authorization and active tables', () => {
  assert.equal(kitchenEligible(null), false);
  assert.equal(kitchenEligible({table_orders_access_enabled:true}), false);
  assert.equal(kitchenEligible({table_orders_access_enabled:false,table_orders_enabled:true}), false);
  assert.equal(kitchenEligible({table_orders_access_enabled:true,table_orders_enabled:true}), true);
});
test('origin and fulfillment remain independent', () => {
  assert.equal(kitchenOrigin({delivery_type:'table',notes:'Pedido manual.'}), 'Manual');
  assert.equal(kitchenOrigin({delivery_type:'table'}), 'QR');
  assert.equal(kitchenOrigin({delivery_type:'pickup'}), 'Catálogo');
  assert.equal(kitchenMode({delivery_type:'pickup',delivery_pricing_type:'table'}), 'Mesa');
  assert.equal(kitchenMode({delivery_type:'table',table_fulfillment_snapshot:'counter_pickup'}), 'Barra');
  assert.equal(kitchenMode({delivery_type:'delivery'}), 'Delivery');
});
test('kitchen notes preserve useful manual content without technical prefixes', () => {
  assert.equal(kitchenOrderNote({notes:'Pedido manual. Mensaje recibido: sin salsa',order_details:null}), 'Mensaje recibido: sin salsa');
  assert.equal(kitchenOrderNote({notes:'Pedido manual · Mesa.',order_details:null}), '');
  assert.equal(kitchenOrderNote({notes:'Sin cubiertos',order_details:'Preparar por separado'}), 'Sin cubiertos');
  assert.equal(kitchenOrderNote({notes:'Preparar por separado',order_details:'Preparar por separado'}), '');
});
test('elapsed time survives reloads, freezes completed phases and clamps clock skew', () => {
  const time=Date.parse('2026-10-03T12:00:00Z');
  assert.equal(elapsedKitchen('2026-10-03T10:55:00Z',time),'1 h 5 min');
  assert.equal(elapsedKitchen('2026-10-03T10:55:00Z',time,'2026-10-03T11:05:00Z'),'10 min');
  assert.equal(elapsedKitchen('2026-10-03T12:01:00Z',time),'0 min');
  assert.equal(elapsedKitchen(null,time),'--');
});
test('delay alerts use the current status clock and validated per-status settings', () => {
  const now=Date.parse('2026-10-03T12:00:00Z');
  const order={status:'received',status_entered_at:'2026-10-03T11:49:00Z',status_elapsed_ms:{}};
  assert.equal(isOrderDelayed(order,defaultOrderDelayThresholds,now),true);
  assert.equal(isOrderDelayed({...order,status_entered_at:'2026-10-03T11:50:00Z'},defaultOrderDelayThresholds,now),false);
  assert.equal(isOrderDelayed({...order,status:'completed'},defaultOrderDelayThresholds,now),false);
  assert.deepEqual(normalizeOrderDelayThresholds({received:15,accepted:0,preparing:999,ready:8,delivering:25}),{
    received:15,accepted:10,preparing:20,ready:8,delivering:25,
  });
});
test('manual dispatch never writes a payment; database owns atomic kitchen transitions', () => {
  const sql=read('supabase/migrations/20261003120000_optional_kitchen_board.sql');
  const sync=read('supabase/migrations/20261003183000_kitchen_state_sync_and_optional_alerts.sql');
  assert.match(sql,/order_id uuid primary key/);
  assert.match(sql,/for update/);
  assert.match(sql,/on conflict\(order_id\) do nothing/);
  assert.match(sql,/p_expected_state is null/);
  assert.doesNotMatch(sql,/set\s+payment_status|set\s+total_usd|set\s+platform_service_fee/i);
  assert.match(sql,/new.payment_status='verified' and v_settings.dispatch_mode='paid'/);
  assert.match(sql,/revoke all on function public.operate_kitchen_order[\s\S]*from public,anon,authenticated/);
  assert.match(sync,/if v_order\.status='received'[\s\S]*set status='accepted'/);
  assert.match(sync,/delay_alerts_enabled boolean not null default false/);
  assert.doesNotMatch(sync,/set\s+payment_status|set\s+total_usd|set\s+platform_service_fee/i);
});
test('normal status management stays available without kitchen', () => {
  const route=read('src/app/api/panel/orders/route.ts').split('export async function PATCH')[1];
  assert.doesNotMatch(route,/kitchen|payment_status.*verified/);
  assert.match(route,/update_table_order_status_v2/);
  assert.match(route,/update\(\{ status \}\)/);
});
test('API is scoped and settings require management role; no guest kitchen access', () => {
  const route=read('src/app/api/panel/kitchen/route.ts');
  assert.match(route,/requirePanelAuth\(request\)/);
  assert.match(route,/assertStoreAccess\(auth, storeId\)/);
  assert.match(route,/assertStoreManager\(auth, storeId\)/);
  assert.match(route,/p_store_id: storeId/);
  assert.match(route,/orders!inner\(id,public_code,customer_name,/);
  assert.match(route,/\.eq\('store_id', storeId\)/);
  assert.doesNotMatch(route,/customer_phone|payment_reference|amount_paid/);
});
test('panel modules share one store order realtime channel', () => {
  const shared=read('src/lib/panel/store-orders-realtime.ts');
  const kitchen=read('src/hooks/use-kitchen.ts');
  const notifier=read('src/components/panel/TableOrderNotifier.tsx');
  const orders=read('src/components/panel/OrdersManager.tsx');
  assert.match(shared,/const entries = new Map/);
  assert.match(shared,/entry\.listeners\.set/);
  assert.match(shared,/attached\.listeners\.size > 0/);
  for (const consumer of [kitchen,notifier,orders]) {
    assert.match(consumer,/subscribeStoreOrdersRealtime/);
    assert.doesNotMatch(consumer,/\.channel\(`store:\$\{/);
    assert.doesNotMatch(consumer,/removeChannel/);
  }
});
test('active orders, split table snapshots and delay settings keep explicit contracts', () => {
  const orders=read('src/app/api/panel/orders/route.ts');
  const tables=read('src/app/api/panel/tables/route.ts');
  const kitchen=read('src/app/api/panel/kitchen/route.ts');
  const helpers=read('src/components/panel/orders/orders-manager-helpers.ts');
  assert.match(orders,/status === "active"[\s\S]{0,160}\.not\("status", "in", "\(completed,cancelled\)"\)/);
  assert.match(tables,/tableOrders,/); assert.match(tables,/counterOrders,/); assert.match(tables,/activeOrders: normalizedOrders/);
  assert.match(kitchen,/`delay_\$\{state\.value\}_minutes`/); assert.match(kitchen,/minutes < 1 \|\| minutes > 240/);
  assert.match(kitchen,/delay_alerts_enabled/); assert.match(kitchen,/typeof body\.delayAlertsEnabled !== 'boolean'/);
  assert.match(helpers,/!\["all", "active"\]\.includes\(item\.value\)/);
});
test('verified payment accepts only a newly received order', () => {
  const route=read('src/app/api/panel/orders/[orderId]/payment/route.ts');
  assert.match(route,/isVerified && existingOrder\.status === "received"[\s\S]*status: "accepted"/);
  assert.match(route,/status_entered_at/);
});
test('Pedidos exige y conserva motivo al cancelar cualquier modalidad', () => {
  const route=read('src/app/api/panel/orders/route.ts').split('export async function PATCH')[1];
  const manager=read('src/components/panel/OrdersManager.tsx');
  const helper=read('src/lib/server/cancel-order-with-inventory.ts');
  const migration=read('supabase/migrations/20261003213000_require_cancellation_reason_all_orders.sql');
  assert.doesNotMatch(manager,/delivery_type === "table" && nextStatus === "cancelled"/);
  assert.equal((manager.match(/const cancellation = nextStatus === "cancelled"/g) || []).length,2);
  assert.match(route,/status === "cancelled"[\s\S]*tableCancellationReason/);
  assert.match(route,/cancellationReason,/);
  assert.match(helper,/rpc\("cancel_order_with_reason"/);
  assert.match(migration,/perform public\.cancel_order_with_inventory/);
  assert.match(migration,/table_cancellation_reason = trim\(p_reason\)/);
});
test('seguimiento movil de Mesa conserva token y Realtime fuerza snapshot fresco', () => {
  const checkout=read('src/components/public/CheckoutForm.tsx');
  const notifier=read('src/components/panel/TableOrderNotifier.tsx');
  assert.doesNotMatch(checkout,/tableOrder:[^\n]*storeToken: ""/);
  assert.match(notifier,/fetchTableSnapshot\(selectedStoreId, true, true\)/);
});
