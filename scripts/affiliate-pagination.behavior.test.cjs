const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadRoute(file, db, authorize = async () => {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const testModule = { exports: {} };
  const mocks = {
    'next/server': { NextResponse: { json: (value, options = {}) => ({ body: value, status: options.status || 200 }) } },
    '@/lib/admin/access': { requireAdminAuth: authorize, adminErrorResponse: (error) => ({ body: { error: error.message }, status: 500 }) },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => db },
  };
  vm.runInNewContext('(function(require,module,exports){' + output + '\n})', { URL, console })((name) => {
    if (!(name in mocks)) throw Error('Unexpected dependency: ' + name);
    return mocks[name];
  }, testModule, testModule.exports);
  return testModule.exports;
}

function fakeDb(rowsByTable) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, filters: [], from: 0, to: Infinity };
      calls.push(call);
      const query = {
        select() { return query; },
        order() { return query; },
        eq(field, value) { call.filters.push([field, value]); return query; },
        in(field, value) { call.filters.push([field, value]); return query; },
        not(field, operator, value) { call.filters.push([field, operator, value]); return query; },
        range(from, to) { call.from = from; call.to = to; return query; },
        returns() { return query; },
        maybeSingle() { return Promise.resolve({ data: rowsByTable[table]?.[0] || null, error: null }); },
        then(resolve, reject) { return Promise.resolve({ data: (rowsByTable[table] || []).slice(call.from, call.to + 1), count: (rowsByTable[table] || []).length, error: null }).then(resolve, reject); },
      };
      return query;
    },
  };
}

const routePath = 'src/app/api/admin/affiliates/details/route.ts';
const request = (query) => ({ nextUrl: new URL(`https://somos.test/api/admin/affiliates/details?${query}`) });
const emailKey = 'email:aliado@somos.test';
const agencyKey = 'agency:8eb536a5-0a76-4b2d-8d19-49e44b754267';

test('solo fundador puede consultar el detalle', async () => {
  const db = fakeDb({});
  const route = loadRoute(routePath, db, async () => { throw Error('Sin permiso'); });
  const result = await route.GET(request(`allyKey=${encodeURIComponent(emailKey)}&section=codes`));
  assert.equal(result.status, 500);
  assert.equal(db.calls.length, 0);
});

test('codigos se paginan por correo y los datos de pago se consultan solo para ese aliado', async () => {
  const db = fakeDb({
    affiliate_codes: Array.from({ length: 26 }, (_, index) => ({ id: String(index), code: `A${index}` })),
    affiliate_payout_accounts: [{ beneficiary_email: 'aliado@somos.test', bank_name: 'QA' }],
  });
  const route = loadRoute(routePath, db);
  const first = await route.GET(request(`allyKey=${encodeURIComponent(emailKey)}&section=codes&page=1`));
  const second = await route.GET(request(`allyKey=${encodeURIComponent(emailKey)}&section=codes&page=2`));
  assert.equal(first.body.rows.length, 25);
  assert.equal(first.body.pagination.hasMore, true);
  assert.equal(second.body.rows.length, 1);
  assert.equal(second.body.pagination.hasMore, false);
  assert.deepEqual(db.calls.filter((call) => call.table === 'affiliate_codes').map((call) => [call.from, call.to]), [[0, 25], [25, 50]]);
  assert.ok(db.calls.every((call) => call.filters.some((filter) => filter[0] === 'beneficiary_email' && filter[1] === 'aliado@somos.test')));
});

test('comercios y liquidaciones se limitan a la empresa delivery seleccionada', async () => {
  const db = fakeDb({ affiliate_referrals: [{ id: 'r1' }], affiliate_settlements: [{ id: 's1' }] });
  const route = loadRoute(routePath, db);
  const key = encodeURIComponent(agencyKey);
  assert.equal((await route.GET(request(`allyKey=${key}&section=stores`))).body.rows.length, 1);
  assert.equal((await route.GET(request(`allyKey=${key}&section=settlements`))).body.rows.length, 1);
  assert.ok(db.calls.every((call) => call.filters.some((filter) => filter[0] === (call.table === 'affiliate_referrals' ? 'transport_agency_id' : 'affiliate_codes.transport_agency_id') && filter[1] === agencyKey.slice(7))));
  assert.ok(db.calls.every((call) => call.to - call.from === 25));
});

test('pagina, seccion y aliado invalidos no consultan la base de datos', async () => {
  const db = fakeDb({});
  const route = loadRoute(routePath, db);
  for (const query of ['section=codes', `allyKey=${encodeURIComponent(emailKey)}&section=unknown`, `allyKey=${encodeURIComponent(emailKey)}&section=codes&page=NaN`]) {
    assert.equal((await route.GET(request(query))).status, 400);
  }
  assert.equal(db.calls.length, 0);
});

test('historial pagina comisiones pagadas y conserva sus ajustes', async () => {
  const db = fakeDb({
    affiliate_commissions: [{ id: 'commission-1', amount_usd: 0.05, status: 'paid', affiliate_referrals: {
      affiliate_code_id: 'code-1', affiliate_codes: { code: 'QA', name: 'Aliado' }, commerce_registration_requests: { store_name: 'Comercio QA' },
    } }],
    affiliate_commission_adjustments: [{ id: 'adjustment-1', commission_id: 'commission-1', amount_usd: -0.02, reason: 'Reintegro', created_at: '2026-10-13' }],
  });
  const route = loadRoute('src/app/api/admin/affiliates/commissions/route.ts', db);
  const result = await route.GET(request(`allyKey=${encodeURIComponent(emailKey)}&status=history&page=1`));
  assert.equal(result.status, 200);
  assert.equal(result.body.commissions[0].netAmountUsd, 0.03);
  assert.equal(result.body.commissions[0].adjustments.length, 1);
  assert.ok(db.calls.some((call) => call.table === 'affiliate_commissions' && call.filters.some(([field, value]) => field === 'status' && value.join(',') === 'paid,reversed')));
});
