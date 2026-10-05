const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext('(function(require,module,exports){' + output + '\n})', { Request, Response, URL, AbortSignal, TypeError, console, ...globals })((name) => {
    if (name in mocks) return mocks[name];
    if (name === 'next/server') return { NextResponse: Response, after: callback => callback() };
    throw Error('Unexpected dependency: ' + name);
  }, module, module.exports);
  return module.exports;
}
const helpers = load('src/lib/table-orders.ts');
const payments = load('src/lib/payments.ts');
const paymentDisplay = load('src/lib/payment-display.ts', {
  '@/lib/payments': payments,
  '@/lib/currency': load('src/lib/currency.ts'),
});

test('copiar todos contiene los cuatro datos de pago movil y el total exacto en bolivares', () => {
  const input = {
    store: { paymentDetails: { pagoMovil: { bank: '0102 Banco de prueba', idNumber: 'V-12345678', phone: '04121234567', holder: 'Titular QA' } } },
    paymentMethod: 'Pago móvil', totals: { totalUsd: 12.5, totalBs: 1234.56 }, orderId: 'QA-123', paymentReference: '998877',
  };
  const info = paymentDisplay.buildPaymentInfo(input);
  assert.equal(info.quickCopyText, 'Banco: 0102 Banco de prueba\nCedula/RIF: V-12345678\nTelefono: 04121234567\nMonto: Bs. 1.234,56');
  assert.doesNotMatch(info.quickCopyText, /Titular|Referencia|Pedido|Tasa/);
  assert.equal(info.lines.some(line => line.label === 'Tasa usada'), false);
  input.store.paymentDetails.pagoMovil.phone = '';
  assert.equal(paymentDisplay.buildPaymentInfo(input).quickCopyText, '', 'no inventa datos bancarios faltantes');
});

test('efectivo no solicita referencia, captura ni datos bancarios faltantes', () => {
  const info = paymentDisplay.buildPaymentInfo({ store: {}, paymentMethod: 'Efectivo', totals: { totalUsd: 12.5, totalBs: 1234.56 }, paymentReference: 'dato anterior' });
  assert.equal(info.hasConfiguredData, true);
  assert.equal(info.quickCopyText, '');
  assert.doesNotMatch(info.copyText, /captura|referencia|dato anterior/i);
  assert.match(info.help, /efectivo/);
});
test('efectivo y punto se cobran en mesa; barra indica pago en caja sin bloquear preparacion', () => {
  assert.match(helpers.getTablePaymentInstructions('Punto de venta', 'table_service'), /llevará el punto de venta a tu mesa/);
  assert.doesNotMatch(helpers.getTablePaymentInstructions('Punto de venta', 'table_service'), /Paga en caja/);
  assert.match(helpers.getTablePaymentInstructions('Punto de venta', 'counter_pickup'), /punto de venta en caja/);
  assert.match(helpers.getTablePaymentInstructions('Efectivo', 'table_service'), /efectivo en tu mesa/);
  assert.match(helpers.getTablePaymentInstructions('Efectivo', 'counter_pickup'), /efectivo en caja/);
  assert.doesNotMatch(helpers.getTablePaymentInstructions('Efectivo', 'table_service'), /caja|antes de preparar/);
});
test('texto de asistencia personalizado tiene limite y valida tipos', () => {
  assert.equal(helpers.TABLE_ASSISTANCE_LABELS[0], 'Pedir asistencia');
  assert.equal(helpers.normalizeTableAssistanceLabel('  Llamar al anfitrión  '), 'Llamar al anfitrión');
  for (const value of ['', 'ab', 'a'.repeat(41), 123, null, 'Dos\nlineas']) assert.equal(helpers.normalizeTableAssistanceLabel(value), null);
  assert.equal(helpers.normalizeTableAssistanceLabel('a'.repeat(40)), 'a'.repeat(40));
});
for (const method of ['Efectivo', 'Punto de venta', 'Pago movil', 'Transferencia', 'Zelle']) {
  test('pago anticipado permitido: ' + method, () => assert.equal(helpers.isPrepaidTablePaymentMethod(method), true));
}
for (const method of ['', null, 'Pago al recibir', 'Efectivo al recibir', 'Contra entrega', 'Pago posterior', 'Pagar al finalizar']) {
  test('no permite pago posterior: ' + method, () => assert.equal(helpers.isPrepaidTablePaymentMethod(method), false));
}
test('efectivo y punto se ofrecen solo como opciones, sin activar ni mutar el comercio', () => {
  const methods = ['Pago movil', 'Efectivo'];
  assert.equal(helpers.availableTablePaymentMethods(methods).join(','), 'Pago movil,Efectivo,Punto de venta');
  assert.deepEqual(methods, ['Pago movil', 'Efectivo']);
  assert.equal(helpers.isInPersonTablePaymentMethod('Punto de venta'), true);
  assert.equal(helpers.isInPersonTablePaymentMethod('Pago movil'), false);
});
test('motivo cerrado y detalle libre validado', () => {
  assert.equal(helpers.tableCancellationReason('Pedido duplicado', ''), 'Pedido duplicado');
  assert.equal(helpers.tableCancellationReason('Inventado', ''), null);
  assert.equal(helpers.tableCancellationReason('Otro', '  '), null);
  assert.equal(helpers.tableCancellationReason('Otro', 'a'.repeat(301)), null);
  assert.equal(helpers.tableCancellationReason('Otro', '  Cambio de pedido  '), 'Otro: Cambio de pedido');
});

async function waiterScenario({ allowed = true, storeId = 'store-a', rpcError = null, body = { token: '00000000-0000-4000-8000-000000000002', tableId: '00000000-0000-4000-8000-000000000001', storeId: 'attacker-store' } } = {}) {
  const calls = [];
  const route = load('src/app/api/table-orders/waiter/route.ts', {
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => ({ from: () => {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null, error: null }) };
      return q;
    }, rpc: async (name, args) => {
      calls.push([name, args]); return { data: { requested_at: '2026-09-22T12:00:00Z' }, error: rpcError };
    } }) },
    '@/lib/server/table-order-tokens': { getStoreIdByTableOrderToken: async () => storeId },
    '@/lib/server/rate-limit': { getClientIp: () => '127.0.0.1', checkDistributedRateLimit: async () => ({ allowed }) },
    '@/lib/printing/firebase-push': { safeSendTableAssistancePush: async () => {} },
  });
  const response = await route.POST(new Request('http://localhost/api/table-orders/waiter', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json(), calls };
}
test('llamada usa el comercio del token, nunca el indicado por navegador', async () => {
  const result = await waiterScenario();
  assert.equal(result.status, 200);
  assert.equal(result.calls[0][1].p_store_id, 'store-a');
});
test('token invalido y limite bloquean toda escritura', async () => {
  for (const [args, status] of [[{ storeId: '' }, 404], [{ allowed: false }, 429], [{ body: { token: 'qr', tableId: 'invalid' } }, 400], [{body:{token:'invalid-token',tableId:'00000000-0000-4000-8000-000000000001'}},400], [{body:null},400]]) {
    const result = await waiterScenario(args);
    assert.equal(result.status, status);
    assert.equal(result.calls.length, 0);
  }
});
test('errores operativos visibles, errores internos ocultos', async () => {
  const disabled = await waiterScenario({ rpcError: { code: 'P0001', message: 'Mesa no disponible.' } });
  assert.equal(disabled.status, 400);
  const internal = await waiterScenario({ rpcError: { code: 'XX000', message: 'private database info' } });
  assert.equal(internal.status, 500);
  assert.doesNotMatch(JSON.stringify(internal.body), /private database/);
});
test('efectivo de mesa queda pendiente y no exige comprobante; telefono sigue obligatorio', () => {
  const source = fs.readFileSync(path.join(root, 'src/app/api/orders/route.ts'), 'utf8');
  assert.match(source, /requestedDeliveryType === "table" \? "pending" : getInitialPaymentStatus/);
  assert.match(source, /acceptsPaymentProof && \["reference", "image"\]/);
  assert.match(source, /const acceptsPaymentProof = !isCashPaymentMethod\(order.form.paymentMethod\) && !inPersonTablePayment/);
  assert.match(source, /customerPhone/);
  assert.match(source, /tablePaymentMethods.includes\(paymentMethod\)/);
});
test('sincronizacion actualiza todos los cambios y carga la comanda bajo demanda', () => {
  const notifier = fs.readFileSync(path.join(root, 'src/components/panel/TableOrderNotifier.tsx'), 'utf8');
  assert.ok(notifier.indexOf('window.dispatchEvent') < notifier.indexOf('if (newOrder)'));
  const manager = fs.readFileSync(path.join(root, 'src/components/panel/TablesManager.tsx'), 'utf8');
  assert.match(manager, /if \(!background\) \{/);
  assert.match(manager, /cache: "no-store"/);
  assert.match(manager, /Comanda y pago/);
});

test('comanda y lista comparten visor privado de referencia y captura, sin popups', () => {
  const source = fs.readFileSync(path.join(root, 'src/components/panel/OrdersManager.tsx'), 'utf8');
  assert.equal((source.match(/<PaymentReviewDialog /g) || []).length, 2);
  assert.match(source, /order.has_payment_receipt \|\| order.payment_reference/);
  assert.match(source, /Ver comprobante o referencia/);
  assert.doesNotMatch(source, /window.open\("about:blank"/);
  const dialog = fs.readFileSync(path.join(root, 'src/components/panel/orders/PaymentReviewDialog.tsx'), 'utf8');
  assert.match(dialog, /if \(order.has_payment_receipt\)/);
  assert.match(dialog, /Referencia: \{order.payment_reference\}/);
  assert.match(dialog, /return \(\) => \{ active = false; \}/);
});

async function receiptScenario({ session = true, ownStore = true, path = 'store-a/order-a/receipt.jpg' } = {}) {
  const calls = [];
  const client = {
    from(table) {
      calls.push(['from', table]);
      const query = {
        select() { return query; }, eq(column, value) { calls.push(['eq', column, value]); return query; },
        is(column, value) { calls.push(['is', column, value]); return query; },
        async maybeSingle() { return { data: table === 'orders' ? { id: 'order-a', store_id: 'store-a' } : { storage_path: path }, error: null }; },
      };
      return query;
    },
    storage: { from(bucket) { return { async createSignedUrl(path, ttl) {
      calls.push(['sign', bucket, path, ttl]); return { data: { signedUrl: 'https://example.test/private-receipt' }, error: null };
    } }; } },
  };
  const route = load('src/app/api/panel/orders/[orderId]/payment-receipt/route.ts', {
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => client },
    '@/lib/panel/access': {
      requirePanelAuth: async () => { if (!session) throw Error('denied'); return { storeIds: ownStore ? ['store-a'] : ['store-b'] }; },
      assertStoreAccess: (auth, storeId) => { if (!auth.storeIds.includes(storeId)) throw Error('denied'); },
      panelErrorResponse: () => Response.json({ error: 'Sin acceso.' }, { status: 403 }),
    },
  });
  const response = await route.GET(new Request('http://localhost/api/panel/orders/order-a/payment-receipt'), { params: Promise.resolve({ orderId: 'order-a' }) });
  return { status: response.status, body: await response.json(), calls };
}

test('comprobante exige sesion y acceso al comercio antes de consultar storage', async () => {
  for (const options of [{ session: false }, { ownStore: false }]) {
    const result = await receiptScenario(options);
    assert.equal(result.status, 403);
    assert.equal(result.calls.some(call => call[0] === 'sign' || (call[0] === 'from' && call[1] === 'order_payment_receipts')), false);
  }
});
test('comprobante privado filtra comercio y borrado y firma solo cinco minutos', async () => {
  const result = await receiptScenario();
  assert.equal(result.status, 200);
  assert.ok(result.calls.some(call => call[0] === 'eq' && call[1] === 'store_id' && call[2] === 'store-a'));
  assert.ok(result.calls.some(call => call[0] === 'is' && call[1] === 'deleted_at' && call[2] === null));
  assert.equal(result.calls.find(call => call[0] === 'sign')[3], 300);
});
test('comprobante eliminado no produce enlace firmado', async () => {
  const result = await receiptScenario({ path: null });
  assert.equal(result.status, 404);
  assert.equal(result.calls.some(call => call[0] === 'sign'), false);
});

function snapshotHarness() {
  let token = 'session-a';
  const requests = [];
  const client = load('src/lib/panel/table-snapshot-client.ts', {
    '@/lib/client/request-timeout': { requestTimeoutSignal: () => new AbortController().signal },
    './client-auth': { getSavedPanelToken: () => token, getPanelAuthHeaders: async () => ({ authorization: token }) },
  }, { fetch: (url) => new Promise(resolve => requests.push({ url, resolve })) });
  const snapshot = { enabled:true, qrToken:'private-qr', tables:[], waiterCalls:[], tableOrders:[{id:'one',status:'accepted'},{id:'two',status:'accepted'}], counterOrders:[] };
  return { client, requests, snapshot, setToken: (value) => { token = value; } };
}
test('Mesa comparte carga inicial, cache aislada por sesion/comercio y live sin QR', async () => {
  const h = snapshotHarness();
  const first = h.client.fetchTableSnapshot('a');
  const notifier = h.client.fetchTableSnapshot('a', true);
  await new Promise(setImmediate);
  assert.equal(h.requests.length,1);
  h.requests[0].resolve(Response.json(h.snapshot));
  await first; await notifier;
  assert.equal(h.client.getCachedTableSnapshot('a').qrToken,'private-qr');
  assert.equal(h.client.getCachedTableSnapshot('b'),null);
  h.setToken('session-b');assert.equal(h.client.getCachedTableSnapshot('a'),null);
  h.setToken('session-a');
  const live=h.client.fetchTableSnapshot('a',true);await new Promise(setImmediate);
  assert.match(h.requests[1].url,/view=live/);
  const {qrToken,...liveSnapshot}=h.snapshot;
  h.requests[1].resolve(Response.json(liveSnapshot));await live;
  assert.equal(h.client.getCachedTableSnapshot('a').qrToken,'private-qr');
});
test('evento en vivo no reutiliza una lectura iniciada antes del cambio de estado', async () => {
  const h = snapshotHarness();
  const stale = h.client.fetchTableSnapshot('a');
  await new Promise(setImmediate);
  const fresh = h.client.fetchTableSnapshot('a', true, true);
  await new Promise(setImmediate);
  assert.equal(h.requests.length, 2);
  assert.match(h.requests[1].url, /view=live/);
  h.requests[1].resolve(Response.json({ ...h.snapshot, qrToken: undefined, tableOrders: [{ id: 'one', status: 'ready' }] }));
  await fresh;
  h.requests[0].resolve(Response.json(h.snapshot));
  await stale;
  assert.equal(h.client.getCachedTableSnapshot('a').tableOrders[0].status, 'ready');
});
test('resumen atrasado no revierte estado confirmado ni revive pedido cerrado', async () => {
  const h=snapshotHarness();
  const initial=h.client.fetchTableSnapshot('a');await new Promise(setImmediate);h.requests[0].resolve(Response.json(h.snapshot));await initial;
  const old=h.client.fetchTableSnapshot('a',true);await new Promise(setImmediate);
  h.client.applyConfirmedTableOrder('a',{id:'one',status:'preparing'});
  h.client.applyConfirmedTableOrder('a',{id:'two',status:'completed'});
  h.requests[1].resolve(Response.json(h.snapshot));
  const result=await old;
  assert.equal(result.tableOrders.length,1);assert.equal(result.tableOrders[0].status,'preparing');
});
test('fallo de red libera solicitud para reintentar sin borrar ultimo resumen', async () => {
  const h=snapshotHarness();const initial=h.client.fetchTableSnapshot('a');await new Promise(setImmediate);
  h.requests[0].resolve(Response.json(h.snapshot));await initial;
  const fail=h.client.fetchTableSnapshot('a',true);await new Promise(setImmediate);h.requests[1].resolve(Response.json({error:'Sin conexion'},{status:503}));await assert.rejects(fail,/Sin conexion/);
  assert.equal(h.client.getCachedTableSnapshot('a').tableOrders.length,2);
  const retry=h.client.fetchTableSnapshot('a',true);await new Promise(setImmediate);assert.equal(h.requests.length,3);h.requests[2].resolve(Response.json(h.snapshot));await retry;
});

test('espera de red limitada libera resumen compartido y permite reintentar', async () => {
  let hang = true;
  let calls = 0;
  const client = load('src/lib/panel/table-snapshot-client.ts', {
    '@/lib/client/request-timeout': { requestTimeoutSignal(ms) {
      assert.equal(ms, 15_000);
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 20);
      return controller.signal;
    } },
    './client-auth': { getSavedPanelToken: () => 'qa', getPanelAuthHeaders: async () => ({}) },
  }, {
    fetch: async (_, { signal }) => {
      calls++;
      if (!hang) return Response.json({ tableOrders: [], counterOrders: [], tables: [] });
      return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    },
  });
  await assert.rejects(client.fetchTableSnapshot('a'), /No pudimos cargar/);
  hang = false;
  await client.fetchTableSnapshot('a');
  assert.equal(calls, 2);
  hang = true;
  await assert.rejects(client.requestTableJson('/api/panel/orders', { method: 'PATCH' }), /No pudimos confirmar el cambio/);
  assert.equal(calls, 3, 'una escritura incierta nunca se reintenta automaticamente');
});

test('limite tambien cubre cuerpo de respuesta y conserva errores operativos', async () => {
  let badStatus = false;
  const client = load('src/lib/panel/table-snapshot-client.ts', {
    '@/lib/client/request-timeout': { requestTimeoutSignal() {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 20);
      return controller.signal;
    } },
    './client-auth': {},
  }, {
    fetch: async (_, { signal }) => badStatus
      ? Response.json({ error: 'Verifica el pago antes de preparar.' }, { status: 400 })
      : { json: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) },
  });
  await assert.rejects(client.requestTableJson('/api/panel/orders', { method: 'PATCH' }), /No pudimos confirmar/);
  badStatus = true;
  await assert.rejects(client.requestTableJson('/api/panel/orders', { method: 'PATCH' }), /Verifica el pago/);
});

test('consulta live no pide QR y mantiene aislamiento y medicion del servidor', async () => {
  for (const live of [false, true]) {
    let qrCalls=0;
    const queried=[];
    const db={from(table){
      const q={select(){return q},eq(field,value){queried.push([table,field,value]);return q},not(){return q},is(){return q},order(){return q},single:async()=>({data:{table_orders_access_enabled:true,payment_methods:[],table_payment_methods:[]},error:null}),then(resolve){return Promise.resolve({data:table==='orders' ? [{id:'with',payment_receipts:{order_id:'with'}},{id:'without',payment_receipts:null}] : [],error:null}).then(resolve)}};
      return q;
    }};
    const route=load('src/app/api/panel/tables/route.ts',{
      '@/lib/supabase/admin':{createSupabaseAdminClient:()=>db},
      '@/lib/panel/access':{requirePanelAuth:async()=>({}),assertStoreAccess:(_,id)=>assert.equal(id,'store-a')},
      '@/lib/table-orders':helpers,
      '@/lib/server/table-order-tokens':{getTableOrderTokenForStore:async()=>{qrCalls++;return 'qr'}},
    },{performance});
    const r=await route.GET({nextUrl:new URL('http://localhost/api/panel/tables?storeId=store-a'+(live?'&view=live':''))});
    assert.equal(r.status,200);assert.equal(qrCalls,live?0:1);assert.match(r.headers.get('server-timing'),/auth;dur=.*total;dur=/);
    for(const table of ['orders','store_tables','table_waiter_calls'])assert.ok(queried.some(row=>row[0]===table&&row[1]==='store_id'&&row[2]==='store-a'));
    const body=await r.json();
    assert.deepEqual(body.activeOrders,[{id:'with',has_payment_receipt:true},{id:'without',has_payment_receipt:false}]);
    assert.deepEqual(body.tableOrders,[]);
    assert.deepEqual(body.counterOrders,[{id:'with',has_payment_receipt:true},{id:'without',has_payment_receipt:false}]);
    assert.ok(queried.some(row=>row[0]==='orders'&&row[1]==='payment_receipts.store_id'&&row[2]==='store-a'));
    if(live)assert.equal(body.qrToken,undefined);
  }
});

test('guardia delivery sigue bloqueando cambios con consulta unificada', async () => {
 for(const active of [false,true]){
  let mutations=0;const reads=[];
  const db={from(table){assert.equal(table,'orders');const q={select(value){reads.push(value);return q},eq(){return q},not(field,operator,filter){assert.equal(field,'active_transport_orders.status');assert.match(filter,/agency_rejected,cancelled,delivery_failed/);return q},single:async()=>({data:{id:'one',store_id:'store-a',status:'accepted',delivery_type:'table',customer_id:null,active_transport_orders:active?[{id:'transport'}]:[]},error:null})};return q},rpc:async(name,args)=>{mutations++;assert.equal(name,'update_table_order_status_v2');assert.equal(args.p_expected_status,'accepted');return{data:{id:'one',status:'preparing'},error:null}}};
  const mocks={
   '@/lib/supabase/admin':{createSupabaseAdminClient:()=>db},crypto:{},
   '@/lib/panel/access':{requirePanelAuth:async()=>({userId:'qa'}),assertStoreAccess:(_,id)=>assert.equal(id,'store-a'),badRequest:(error)=>Response.json({error},{status:400}),panelErrorResponse:(e)=>{throw e}},
   '@/lib/table-orders':helpers,
  };
  for(const name of ['@/lib/payments','@/lib/supabase/catalog','@/lib/customers/normalize-phone','@/lib/customers/customer-metrics','@/lib/customers/upsert-customer-from-order','@/lib/time/venezuela','@/lib/plans','@/lib/server/create-order-atomic','@/lib/server/cancel-order-with-inventory'])mocks[name]={};
  const route=load('src/app/api/panel/orders/route.ts',mocks,{performance});
  const response=await route.PATCH(new Request('http://localhost/api/panel/orders',{method:'PATCH',body:JSON.stringify({id:'one',status:'preparing',expectedStatus:'accepted'})}));
  assert.equal(response.status,active?400:200);assert.equal(mutations,active?0:1);assert.equal(reads.length,1);
 }
});

test('verificar pago solo modifica campos enviados y conserva datos omitidos', async () => {
  for (const extra of [{}, { paymentReference: '123456', paymentCurrency: 'usd', amountPaid: 12, paymentBank: 'Banco', paymentNotes: 'Nota' }, { paymentReference: '', amountPaid: null }]) {
    let payload;
    const filters = [];
    const db = { from() {
      const q = { select(){return q;}, eq(key,value){filters.push([key,value]);return q;}, update(value){payload=value;return q;}, single:async()=>({data:payload ? {id:'order-a',...payload} : {id:'order-a',store_id:'store-a'},error:null}) };
      return q;
    } };
    const route = load('src/app/api/panel/orders/[orderId]/payment/route.ts', {
      '@/lib/supabase/admin': {createSupabaseAdminClient:()=>db},
      '@/lib/panel/access': {requirePanelAuth:async()=>({userId:'actor'}),assertStoreAccess:(_,id)=>assert.equal(id,'store-a'),badRequest:()=>{throw Error('bad request');},panelErrorResponse:e=>{throw e;}},
      '@/lib/payments':{isPaymentStatus:value=>value==='verified'},
      '@/lib/supabase/schema-compat':{isMissingColumnError:()=>false},
      '@/lib/printing/firebase-push':{safeSendPrintWakePush:async()=>({sent:0})},
    });
    const response = await route.PATCH(new Request('http://localhost/api/panel/orders/order-a/payment',{method:'PATCH',body:JSON.stringify({paymentStatus:'verified',...extra})}),{params:Promise.resolve({orderId:'order-a'})});
    assert.equal(response.status,200);
    assert.equal(payload.payment_status,'verified');
    assert.equal(payload.payment_verified_by,'actor');
    assert.ok(filters.some(([key,value])=>key==='store_id'&&value==='store-a'));
    for (const [input,column] of Object.entries({paymentReference:'payment_reference',paymentCurrency:'payment_currency',amountPaid:'amount_paid',paymentBank:'payment_bank',paymentNotes:'payment_notes'})) {
      assert.equal(Object.hasOwn(payload,column),Object.hasOwn(extra,input));
    }
    if(Object.hasOwn(extra,'paymentReference'))assert.equal(payload.payment_reference,extra.paymentReference||null);
  }
});

test('rafaga de diez eventos conserva un refresco final sin diez consultas paralelas', async () => {
  const effects=[],callbacks=[],requests=[],events=[];
  const module=load('src/components/panel/TableOrderNotifier.tsx',{
    'react/jsx-runtime':{jsx:()=>null},
    react:{useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect:fn=>effects.push(fn),useCallback:fn=>{callbacks.push(fn);return fn;}},
    '@/components/panel/NewOrderToast':{},
    '@/components/panel/PanelAuthProvider':{usePanelAuth:()=>({selectedStoreId:'a',selectedStore:{table_orders_access_enabled:true}})},
    '@/lib/panel/client-auth':{},
    '@/lib/panel/order-notification-sound':{playNewOrderSound:()=>{},unlockOrderNotificationSound:()=>{}},
    '@/lib/mobile/order-alerts':{},
    '@/lib/panel/store-orders-realtime':{subscribeStoreOrdersRealtime:()=>()=>{}},
    '@/lib/table-orders':{TABLE_ORDERS_CHANGED_EVENT:'changed'},
    '@/lib/panel/table-snapshot-client':{fetchTableSnapshot:()=>new Promise(resolve=>requests.push(resolve))},
  },{window:{dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}});
  module.TableOrderNotifier();
  effects[0]();effects[1]();const unmount=effects[2]();effects[3]();
  assert.equal(requests.length,1);
  for(let i=0;i<10;i++)await callbacks[0](true);
  assert.equal(requests.length,1);
  requests[0]({tableOrders:[{id:'first'}],counterOrders:[]});await new Promise(setImmediate);
  assert.equal(requests.length,2,'exactly one trailing request');
  requests[1]({tableOrders:[{id:'first'},{id:'last'}],counterOrders:[]});await new Promise(setImmediate);
  assert.equal(events.at(-1).detail.tableOrders.length,2);
  const pending=callbacks[0](true);await callbacks[0](true);unmount();
  requests[2]({tableOrders:[],counterOrders:[]});await pending;
  assert.equal(requests.length,3,'unmounted component never starts trailing request');
  assert.equal(events.length,2,'unmounted component never broadcasts stale data');
});

test('servidor exime efectivo de comprobante, exige prueba digital y conserva validacion de retiro', async () => {
  const delivery=load('src/lib/delivery.ts');
  const scenarios = [
    { mode: 'pickup', paymentMethod: 'Efectivo', proofMode: 'image', pickupEnabled: false, expected: 400 },
    ...['table', 'pickup'].flatMap(mode => ['image', 'reference'].flatMap(proofMode => [
      { mode, paymentMethod: 'Efectivo', proofMode, pickupEnabled: true, expected: 200 },
      { mode, paymentMethod: 'Pago movil', proofMode, pickupEnabled: true, expected: 400 },
    ])),
    { mode: 'pickup', paymentMethod: 'Pago movil', proofMode: 'reference', pickupEnabled: true, reference: '123456', expected: 200 },
  ];
  for(const { mode, paymentMethod, proofMode, pickupEnabled, reference = '', expected } of scenarios){
    const reads=[];let agencyReads=0,persisted=null;
    const store={id:'store-a',name:'QA',is_active:true,usd_to_bs:100,accepts_delivery:false,accepts_pickup:true,table_orders_access_enabled:true,table_orders_enabled:true,payment_methods:['Efectivo','Pago movil'],table_payment_methods:['Efectivo','Pago movil'],payment_proof_mode:proofMode,payment_proof_required:true};
    const db={from(table){reads.push(table);const result={data:table==='stores'?store:table==='store_tables'?{id:'table-a',name:'Mesa 1'}:table==='products'?[{id:'product-a',store_id:'store-a',name:'QA',price_usd:3,is_available:true}]:table==='store_delivery_settings'?{delivery_enabled:true,pickup_enabled:pickupEnabled}:[],error:null};const q={select(){return q},eq(){return q},in(){return q},order(){return q},single:async()=>result,maybeSingle:async()=>result,then:resolve=>Promise.resolve(result).then(resolve)};return q;}};
    const route=load('src/app/api/orders/route.ts',{
      crypto:require('node:crypto'),
      '@/lib/plans':{getStoreServiceFeeUsd:()=>0.1},
      '@/lib/payments':payments,
      '@/lib/whatsapp':{buildOrderMessage:()=>'',buildWhatsAppUrl:()=>''},
      '@/lib/supabase/admin':{createSupabaseAdminClient:()=>db},
      '@/lib/supabase/catalog':{isStoreSubscriptionPastDue:()=>false},
      '@/lib/supabase/schema-compat':{isMissingColumnError:()=>false},
      '@/lib/customers/normalize-phone':{normalizePhone:x=>x},
      '@/lib/table-orders':helpers,
      '@/lib/customers/upsert-customer-from-order':{safeUpsertCustomerFromOrder:async()=>{}},
      '@/lib/delivery':delivery,
      '@/lib/transport':{loadTransportAgencyDeliverySettings:async()=>{agencyReads++;return null;}},
      '@/lib/server/signed-delivery-quote':{},
      '@/lib/business-hours':{getStoreOpenState:()=>({isOpen:true})},
      '@/lib/server/rate-limit':{getClientIp:()=> 'test',checkDistributedRateLimit:async()=>({allowed:true})},
      '@/lib/server/observability':{createApiRequestContext:()=>({}),attachApiResponseHeaders:r=>r,logApiEvent:()=>{},logApiError:(_,__,e)=>{throw e;}},
      '@/lib/server/table-order-tokens':{isValidTableOrderTokenForStore:async()=>true},
      '@/lib/server/create-order-atomic':{createOrderAtomic:async({order})=>{persisted=order;return{order,idempotentReplay:false};}},
      '@/lib/buyer/auth-server':{getVerifiedBuyer:async()=>null},
      '@/lib/printing/firebase-push':{safeSendPrintWakePush:async()=>({sent:0})},
    });
    const cash = payments.isCashPaymentMethod(paymentMethod);
    const r=await route.POST(new Request('http://localhost/api/orders',{method:'POST',body:JSON.stringify({storeId:'store-a',idempotencyKey:'00000000-0000-4000-8000-000000000001',order:{items:[{productId:'product-a',quantity:1,unitPriceUsd:0}],form:{customerName:'QA',customerPhone:'12025550100',paymentMethod,deliveryType:mode,paymentReference:cash?'stale':reference,paymentReceiptToken:cash?'stale-token':''},quote:{},tableOrder:{storeToken:'qr',tableId:'table-a'}}})}));
    const body = await r.json();
    assert.equal(r.status,expected,JSON.stringify({ mode, paymentMethod, proofMode, body }));
    assert.equal(agencyReads,mode==='table'?0:1);
    for(const table of ['store_delivery_settings','store_delivery_zones','store_delivery_distance_rates'])assert.equal(reads.includes(table),mode!=='table');
    if(expected===200){
      assert.equal(persisted.total_usd,3);assert.equal(persisted.delivery_usd,0);
      assert.equal(persisted.payment_status, cash ? (mode==='table'?'pending':'cash_on_delivery') : 'review');
      if(mode==='table')assert.equal(persisted.store_table_id,'table-a');
      if(cash){assert.equal(persisted.payment_reference,null);assert.equal(body.order.form.paymentReceiptToken,'');assert.equal(body.order.form.paymentReference,'');}
    } else assert.equal(persisted,null,'no guarda pedido sin requisito digital o con retiro deshabilitado');
    assert.equal(reads.includes('order_payment_receipts'),false,'efectivo no intenta vincular un capture anterior');
  }
});
