import { NextRequest, NextResponse } from 'next/server';
import { assertStoreAccess, assertStoreManager, badRequest, panelErrorResponse, requirePanelAuth } from '@/lib/panel/access';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { kitchenEligible } from '@/lib/kitchen';
import { defaultOrderDelayThresholds, orderDelayStates, type OrderDelayThresholds } from '@/lib/order-delay';

const settingsColumns = `enabled,dispatch_mode,delay_alerts_enabled,${orderDelayStates.map(state => `delay_${state.value}_minutes`).join(',')}`;
function serializeSettings(settings?: Record<string, unknown> | null) {
  return {
    enabled: settings?.enabled === true,
    dispatch_mode: settings?.dispatch_mode === 'paid' ? 'paid' as const : 'manual' as const,
    delay_alerts_enabled: settings?.delay_alerts_enabled === true,
    delay_thresholds: Object.fromEntries(orderDelayStates.map(state => [
      state.value,
      Number(settings?.[`delay_${state.value}_minutes`] ?? defaultOrderDelayThresholds[state.value]),
    ])) as OrderDelayThresholds,
  };
}

function validateDelayThresholds(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const entries = orderDelayStates.map(state => [state.value, Number(input[state.value])] as const);
  if (entries.some(([, minutes]) => !Number.isInteger(minutes) || minutes < 1 || minutes > 240)) return null;
  return Object.fromEntries(entries) as OrderDelayThresholds;
}

async function context(request: NextRequest) {
  const auth = await requirePanelAuth(request);
  const storeId = String(request.headers.get('x-panel-store-id') || '').trim();
  assertStoreAccess(auth, storeId);
  const supabase = createSupabaseAdminClient();
  const { data: store, error } = await supabase.from('stores')
    .select('table_orders_access_enabled, table_orders_enabled').eq('id', storeId).single();
  if (error) throw error;
  return { auth, storeId, supabase, eligible: kitchenEligible(store) };
}
const summary = 'order_id,state,sent_at,started_at,ready_at,closed_at,dispatch_method,payment_at_dispatch';
export async function GET(request: NextRequest) {
  try {
    const { supabase, storeId, eligible } = await context(request);
    if (!eligible) return NextResponse.json({ eligible: false, settings: serializeSettings(), tickets: [] });
    if (request.nextUrl.searchParams.get('view') === 'tables') {
      const { data, error } = await supabase.from('store_tables').select('id,name,zone').eq('store_id', storeId).eq('is_enabled', true).order('name');
      if (error) throw error;
      return NextResponse.json({ eligible, tables: data }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    const { data: settings, error } = await supabase.from('store_kitchen_settings').select(settingsColumns).eq('store_id', storeId).maybeSingle();
    if (error) throw error;
    const settingsRow = settings as unknown as Record<string, unknown> | null;
    const board = request.nextUrl.searchParams.get('view') === 'board';
    const offset = Math.max(0, Math.min(10000, Number(request.nextUrl.searchParams.get('offset')) || 0));
    let tickets: unknown[] = [];
    let hasMore = false;
    if (settingsRow?.enabled) {
      const columns = board ? `${summary},orders!inner(id,public_code,customer_name,created_at,status,status_entered_at,status_elapsed_ms,delivery_type,delivery_pricing_type,table_name_snapshot,table_fulfillment_snapshot,delivery_reference,notes,order_details,table_cancellation_reason,order_items(id,product_name,variant_name,quantity,notes,order_item_options(id,option_group_name,option_name,quantity)))` : summary;
      const result = await supabase.from('order_kitchen_tickets').select(columns).eq('store_id', storeId)
        .in('state', ['queued', 'preparing', 'ready']).order('sent_at').order('order_id').range(offset, offset + 99);
      if (result.error) throw result.error;
      tickets = result.data || [];
      hasMore = tickets.length === 100;
    }
    return NextResponse.json({ eligible, settings: serializeSettings(settingsRow), tickets, hasMore, serverTime: new Date().toISOString() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return panelErrorResponse(error, 'No se pudo cargar Cocina.'); }
}
export async function POST(request: NextRequest) {
  try {
    const { auth, supabase, storeId, eligible } = await context(request);
    if (!eligible) return badRequest('Cocina requiere Mesa activa y autorizada por administracion.');
    const body = await request.json();
    if (!/^[0-9a-f-]{36}$/i.test(String(body.orderId)) || !['send','prepare','ready'].includes(body.action)) return badRequest('Selecciona un pedido y una accion valida.');
    const { data, error } = await supabase.rpc('operate_kitchen_order', {
      p_store_id: storeId, p_order_id: body.orderId, p_action: body.action,
      p_expected_state: typeof body.expectedState === 'string' ? body.expectedState : null,
      p_actor: auth.userId || 'Acceso del comercio',
    });
    if (error?.code === 'P0001') return badRequest(error.message);
    if (error) throw error;
    return NextResponse.json({ ticket: data });
  } catch (error) { return panelErrorResponse(error, 'No se pudo confirmar el cambio en Cocina.'); }
}
export async function PATCH(request: NextRequest) {
  try {
    const { auth, supabase, storeId, eligible } = await context(request);
    assertStoreManager(auth, storeId);
    if (!eligible) return badRequest('Cocina requiere Mesa activa y autorizada por administracion.');
    const body = await request.json();
    if (typeof body.enabled !== 'boolean' || typeof body.delayAlertsEnabled !== 'boolean' || !['manual','paid'].includes(body.dispatchMode)) return badRequest('Configuracion de Cocina invalida.');
    const delayThresholds = body.delayThresholds === undefined ? undefined : validateDelayThresholds(body.delayThresholds);
    if (body.delayThresholds !== undefined && !delayThresholds) return badRequest('Cada alerta debe estar entre 1 y 240 minutos.');
    const delayPayload = delayThresholds ? Object.fromEntries(orderDelayStates.map(state => [
      `delay_${state.value}_minutes`, delayThresholds[state.value],
    ])) : {};
    const { data, error } = await supabase.from('store_kitchen_settings').upsert({
      store_id: storeId,
      enabled: body.enabled,
      dispatch_mode: body.dispatchMode,
      delay_alerts_enabled: body.delayAlertsEnabled,
      ...delayPayload,
      updated_at: new Date().toISOString(),
    }).select(settingsColumns).single();
    if (error) throw error;
    return NextResponse.json({ saved: true, settings: serializeSettings(data as unknown as Record<string, unknown>) });
  } catch (error) { return panelErrorResponse(error, 'No se pudo guardar Cocina.'); }
}
