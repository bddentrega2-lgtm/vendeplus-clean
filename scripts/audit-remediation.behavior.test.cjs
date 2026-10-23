const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function load(file, mocks) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext('(function(require,module,exports){' + compiled + '\n})', {
    URL, Date, Response, Request, console, Map, Set, performance,
  })((name) => {
    if (name === 'crypto') return require('node:crypto');
    return mocks[name] || {};
  }, loaded, loaded.exports);
  return loaded.exports;
}

function jsonResponse(body, options) {
  return Response.json(body, options);
}

test('a receipt uses the atomic RPC for both guest and verified buyer', async () => {
  const calls = [];
  const supabase = { rpc: async (name, args) => {
    calls.push({ name, args });
    return { data: { order: { id: 'order-1' }, idempotent_replay: false }, error: null };
  } };
  const { createOrderAtomic } = load('src/lib/server/create-order-atomic.ts', {});
  await createOrderAtomic({ supabase, order: { store_id: 'store-1' }, items: [], receiptId: 'receipt-1' });
  await createOrderAtomic({ supabase, order: { store_id: 'store-1' }, items: [], receiptId: 'receipt-2', buyerId: 'buyer-1' });
  assert.deepEqual(calls.map((call) => call.name), ['create_order_with_receipt_atomic', 'create_order_with_receipt_atomic']);
  assert.deepEqual(calls.map((call) => call.args.p_buyer_id), [null, 'buyer-1']);
  assert.deepEqual(calls.map((call) => call.args.p_receipt_id), ['receipt-1', 'receipt-2']);
});

test('malformed order and absent quote stop before any database write', async () => {
  let databaseOpened = false;
  const { POST } = load('src/app/api/orders/route.ts', {
    'next/server': { NextResponse: { json: jsonResponse } },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => { databaseOpened = true; throw Error('Unexpected database access'); } },
    '@/lib/server/rate-limit': { getClientIp: () => 'test', checkDistributedRateLimit: async () => ({ allowed: true }) },
    '@/lib/server/observability': { createApiRequestContext: () => ({}), attachApiResponseHeaders: (response) => response, logApiError: () => {} },
  });
  const base = { storeId: 'store-1', idempotencyKey: '00000000-0000-4000-8000-000000000001', order: { items: [] } };
  for (const body of [JSON.stringify(base), 'null', '{broken']) {
    const result = await POST(new Request('https://somos.test/api/orders', { method: 'POST', body }));
    assert.equal(result.status, 400);
  }
  assert.equal(databaseOpened, false);
});

function customerDb() {
  const customers = [
    { id: 'c1', store_id: 'store-A', last_order_id: 'foreign', name: 'Uno', phone: '111', orders_count: 1 },
    { id: 'c2', store_id: 'store-A', last_order_id: 'wrong-customer', name: 'Dos', phone: '222', orders_count: 1 },
    { id: 'c3', store_id: 'store-A', last_order_id: 'valid', name: 'Tres', phone: '333', orders_count: 1 },
    { id: 'c4', store_id: 'store-A', last_order_id: 'legacy', name: 'Cuatro', phone: '444', orders_count: 1 },
    { id: 'c5', store_id: 'store-A', last_order_id: null, name: 'Sin pedido', phone: '555', orders_count: 0 },
    { id: 'c6', store_id: 'store-A', last_order_id: 'not-returned', name: 'Pedido ausente', phone: '666', orders_count: 1 },
  ];
  const orders = [
    { id: 'foreign', store_id: 'store-B', customer_id: 'c1', order_items: [{ product_name: 'Private' }] },
    { id: 'wrong-customer', store_id: 'store-A', customer_id: 'elsewhere', order_items: [{ product_name: 'Wrong' }] },
    { id: 'valid', store_id: 'store-A', customer_id: 'c3', order_items: [{ product_name: 'Allowed' }] },
    { id: 'legacy', store_id: 'store-A', customer_id: null, customer_phone: '444', order_items: [{ product_name: 'Legacy' }] },
  ];
  const orderFilters = [];
  return {
    orderFilters,
    from(table) {
      let head = false;
      const query = {
        select(_columns, options) { head = options?.head === true; return query; },
        order() { return query; }, range() { return query; }, or() { return query; },
        eq() { return query; }, gte() { return query; }, lte() { return query; },
        in(column, values) { if (table === 'orders') orderFilters.push([column, values]); return query; },
        then(resolve, reject) {
          const data = table === 'customers' ? customers : table === 'orders' ? orders : [{ id: 'store-A', name: 'Sede A' }];
          return Promise.resolve({ data: head ? null : data, count: data.length, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

test('customer last order requires the same store and customer', async () => {
  const db = customerDb();
  const { GET } = load('src/app/api/panel/customers/route.ts', {
    'next/server': { NextResponse: { json: jsonResponse } },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => db },
    '@/lib/panel/access': {
      requirePanelAuth: async () => ({ storeIds: ['store-A'], mode: 'auth' }),
      assertStoreAccess: () => {}, panelErrorResponse: (error) => { throw error; },
    },
    '@/lib/customers/customer-segments': { getCustomerBadges: () => [], shouldContactCustomer: () => false },
    '@/lib/customers/normalize-phone': { normalizePhone: (value) => String(value || '').replace(/\D/g, '') },
    '@/lib/customers/customer-messages': {
      buildRepeatLastOrderMessage: ({ items }) => items.map((item) => item.product_name).join(','),
      buildContactAgainMessage: () => '', buildWhatsappUrl: () => '',
    },
  });
  const response = await GET({ url: 'https://somos.test/api/panel/customers', headers: { get: () => '' } });
  const body = await response.json();
  assert.equal(body.customers[0].last_order, null);
  assert.equal(body.customers[1].last_order, null);
  assert.equal(body.customers[2].last_order.id, 'valid');
  assert.equal(body.customers[3].last_order.id, 'legacy');
  assert.equal(body.customers[4].last_order, null);
  assert.equal(body.customers[5].last_order, null);
  assert.deepEqual(db.orderFilters.find(([column]) => column === 'store_id')[1], ['store-A']);
});

function statsDb(orderCount) {
  const order = { id: 'one', store_id: 'store-A', status: 'received', payment_status: 'pending',
    created_at: '2026-10-20T12:00:00Z', delivery_type: 'pickup', subtotal_usd: 3,
    total_usd: 3, delivery_usd: 0, stores: { name: 'Sede A' }, order_items: [] };
  return {
    rpc: async () => ({ data: null, error: { message: 'RPC unavailable' } }),
    from(table) {
      const query = {
        select() { return query; }, order() { return query; }, gte() { return query; },
        lte() { return query; }, limit() { return query; }, in() { return query; }, eq() { return query; },
        then(resolve, reject) {
          const data = table === 'stores' ? [{ id: 'store-A' }] : table === 'orders' ? [order] : [];
          const count = table === 'orders' ? orderCount : data.length;
          return Promise.resolve({ data, count, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

test('statistics fallback refuses a truncated order set', async () => {
  const db = statsDb(2);
  const { GET } = load('src/app/api/panel/stats/route.ts', {
    'next/server': { NextResponse: { json: jsonResponse } },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => db },
    '@/lib/panel/access': {
      requirePanelAuth: async () => ({ storeIds: ['store-A'], mode: 'auth' }),
      assertStoreAccess: () => {}, panelErrorResponse: (error) => { throw error; },
    },
    '@/lib/achievements': { loadStoreAchievements: async () => null },
    '@/lib/time/venezuela': {
      getVenezuelaRelativeRange: () => ({ start: new Date('2026-10-19T00:00:00Z'), end: new Date('2026-10-20T23:59:59Z') }),
      getVenezuelaDateKey: () => '2026-10-20',
    },
  });
  const response = await GET({ url: 'https://somos.test/api/panel/stats?mode=summary', headers: { get: () => '' } });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'STATS_UNAVAILABLE');
});

test('statistics fallback retains exact results for a complete small set', async () => {
  const db = statsDb(1);
  const { GET } = load('src/app/api/panel/stats/route.ts', {
    'next/server': { NextResponse: { json: jsonResponse } },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => db },
    '@/lib/panel/access': {
      requirePanelAuth: async () => ({ storeIds: ['store-A'], mode: 'auth' }),
      assertStoreAccess: () => {}, panelErrorResponse: (error) => { throw error; },
    },
    '@/lib/achievements': { loadStoreAchievements: async () => null },
    '@/lib/time/venezuela': {
      getVenezuelaRelativeRange: () => ({ start: new Date('2026-10-19T00:00:00Z'), end: new Date('2026-10-20T23:59:59Z') }),
      getVenezuelaDateKey: () => '2026-10-20',
    },
  });
  const response = await GET({ url: 'https://somos.test/api/panel/stats?mode=summary', headers: { get: () => '' } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.summary.totalOrders, 1);
  assert.equal(body.range.capped, false);
});

test('transport grants and policies hide internal fields and private rates', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261020120000_restrict_public_transport_agency_reads.sql'), 'utf8');
  assert.match(migration, /revoke select \(.*columns_sql.*\) on public\.transport_agencies/s);
  assert.match(migration, /grant select \([\s\S]*rates_visibility[\s\S]*\) on public\.transport_agencies to anon, authenticated/);
  assert.doesNotMatch(migration.match(/grant select \([\s\S]*?\) on public\.transport_agencies to anon, authenticated/)?.[0] || '', /admin_notes|particular_payment_details/);
  assert.equal((migration.match(/agency\.rates_visibility = 'public'/g) || []).length, 3);
});
