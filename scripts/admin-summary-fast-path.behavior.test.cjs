const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadGet(authorize, calls) {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app/api/admin/summary/route.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const rows = {
    stores: [{ id: 'store-1', name: 'Comercio QA', is_test: false }],
    orders: [{ id: 'order-1', store_id: 'store-1', status: 'cancelled' }],
    store_subscription_payments: [],
  };
  const db = {
    from(table) {
      calls.push(table);
      if (!(table in rows)) throw new Error(`Unexpected table: ${table}`);
      const query = {
        select() { return query; },
        order() { return query; },
        in() { return query; },
        eq() { return query; },
        gte() { return query; },
        lt() { return query; },
        range() { return Promise.resolve({ data: rows[table], error: null }); },
      };
      return query;
    },
    rpc(name) { throw new Error(`Historical RPC should not run: ${name}`); },
  };
  const period = { startIso: '2026-10-01T00:00:00Z', endIso: '2026-11-01T00:00:00Z' };
  const mocks = {
    'next/server': { NextResponse: { json: (body) => ({ body }) } },
    '@/lib/admin/access': { requireAdminAuth: authorize, adminErrorResponse: (error) => ({ error }) },
    '@/lib/admin/metrics-fallback': { isMissingAdminMetricsRpc: () => false, loadAdminStoreMetricsFallback: () => { throw new Error('Historical metrics should not run'); } },
    '@/lib/admin/summary-period': { getSummaryPeriod: () => period, buildPeriodSummary: (_period, orders, payments) => ({ orders: orders.length, payments: payments.length }), isSummaryStoreExpired: () => false },
    '@/lib/admin/financial-read': { loadAdminApprovedPaymentsTotal: () => { throw new Error('Historical payments should not run'); }, loadAdminOpenFeeBalances: () => { throw new Error('Historical balances should not run'); } },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => db },
  };
  const testModule = { exports: {} };
  vm.runInNewContext('(function(require,module,exports){' + compiled + '\n})', { Promise, Date, Map, Set })((name) => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  }, testModule, testModule.exports);
  return testModule.exports.GET;
}

function request() {
  return { nextUrl: new URL('https://somos.test/api/admin/summary?period=month&view=period') };
}

test('filtro rapido consulta solo datos del periodo e incluye pedidos cancelados', async () => {
  const calls = [];
  const get = loadGet(async () => ({ mode: 'founder' }), calls);
  const response = await get(request());
  assert.deepEqual(calls, ['stores', 'orders', 'store_subscription_payments']);
  assert.equal(response.body.summary.orders, 1);
  assert.equal(response.body.summary.payments, 0);
  assert.equal('overview' in response.body.summary, false);
});

test('filtro rapido no consulta datos sin autorizacion founder', async () => {
  const calls = [];
  const get = loadGet(async () => { throw new Error('Sin permiso'); }, calls);
  const response = await get(request());
  assert.match(response.error.message, /Sin permiso/);
  assert.equal(calls.length, 0);
});
