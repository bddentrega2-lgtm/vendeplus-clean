const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function fakeDb(rowsByTable) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push(table);
      const query = {
        select() { return query; },
        order() { return query; },
        in() { return query; },
        eq() { return query; },
        ilike() { return query; },
        range() { return query; },
        then(resolve, reject) { return Promise.resolve({ data: rowsByTable[table] || [], error: null }).then(resolve, reject); },
      };
      return query;
    },
  };
}

function loadGet(route, db) {
  const source = fs.readFileSync(path.join(root, route), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const mocks = {
    'next/server': { NextResponse: { json: (body) => ({ body, headers: { set() {} } }) } },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => db },
    '@/lib/panel/access': {
      requirePanelAuth: async () => ({ mode: 'auth', email: 'test@somos.test', role: 'owner', storeIds: ['store-1'] }),
      assertStoreAccess() {},
      panelErrorResponse: (error) => { throw error; },
    },
    '@/lib/payments': {
      getInitialPaymentStatus: () => 'pending',
      getSuggestedPaymentCurrency: () => 'VES',
      isPaymentStatus: () => true,
    },
  };
  vm.runInNewContext('(function(require,module,exports){' + compiled + '\n})', { URL, console, performance, Set, Map, Date })((name) => {
    if (name === 'crypto') return require('node:crypto');
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/')) return {};
    throw Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  return module.exports.GET;
}

test('pedidos compactos conservan la marca de comprobante sin exponer su ruta', async () => {
  const db = fakeDb({ orders: [
    { id: 'one', payment_method: 'Pago movil', order_payment_receipts: { storage_path: 'private/one', deleted_at: null } },
    { id: 'two', order_payment_receipts: [{ storage_path: 'private/two', deleted_at: '2026-10-13' }] },
    { id: 'three', order_payment_receipts: null },
  ] });
  const get = loadGet('src/app/api/panel/orders/route.ts', db);
  const result = await get({ url: 'https://somos.test/api/panel/orders?compact=true&limit=40' });
  assert.deepEqual(Array.from(result.body.orders, (order) => order.has_payment_receipt), [true, false, false]);
  assert.ok(result.body.orders.every((order) => !('order_payment_receipts' in order)));
  assert.deepEqual(db.calls, ['orders']);
});

test('productos conservan solo fotos activas en orden sin consulta posterior', async () => {
  const db = fakeDb({
    stores: [{ id: 'store-1' }], categories: [],
    products: [{ id: 'product-1', product_images: [
      { id: 'second', is_active: true, sort_order: 1 },
      { id: 'inactive', is_active: false, sort_order: 0 },
      { id: 'first', is_active: true, sort_order: 0 },
    ] }],
  });
  const get = loadGet('src/app/api/panel/products/route.ts', db);
  const result = await get({ url: 'https://somos.test/api/panel/products?limit=25', headers: { get: () => '' } });
  assert.deepEqual(Array.from(result.body.products[0].product_images, (image) => image.id), ['first', 'second']);
  assert.deepEqual(db.calls.sort(), ['categories', 'products', 'stores']);
});
