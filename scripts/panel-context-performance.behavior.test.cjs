const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function loadGet(auth, storesRequest, identityRequest, calls) {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app/api/panel/context/route.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const query = {
    select() { return query; },
    order() { return query; },
    in() { return query; },
    eq() { return query; },
    then(resolve, reject) {
      calls.stores += 1;
      return storesRequest.promise.then(resolve, reject);
    },
  };
  const mocks = {
    'next/server': { NextResponse: { json(body) {
      const headers = new Map();
      return { body, headers: { set: (key, value) => headers.set(key, value), get: (key) => headers.get(key) } };
    } } },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => ({
      from: () => query,
      auth: { admin: { getUserById: () => { calls.identity += 1; return identityRequest.promise; } } },
    }) },
    '@/lib/panel/access': { requirePanelAuth: async () => auth, panelErrorResponse: (error) => { throw error; } },
    '@/lib/achievements': { includedAchievementFeatures: { rewards: true } },
  };
  const testModule = { exports: {} };
  vm.runInNewContext('(function(require,module,exports){' + compiled + '\n})', { performance, Promise })((name) => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, testModule, testModule.exports);
  return testModule.exports.GET;
}

test('contexto consulta comercios y recordatorio en paralelo sin cambiar la respuesta', async () => {
  const storesRequest = deferred();
  const identityRequest = deferred();
  const calls = { stores: 0, identity: 0 };
  const get = loadGet({ userId: 'user-1', isFounderMode: false, storeIds: ['store-1'] }, storesRequest, identityRequest, calls);
  const result = get({ headers: { get: () => 'store-1' } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, { stores: 1, identity: 1 });
  storesRequest.resolve({ data: [{ id: 'store-1', name: 'Demo' }], error: null });
  identityRequest.resolve({ data: { user: { user_metadata: { somos_admin_password_reminder: true } } }, error: null });
  const response = await result;
  assert.equal(response.body.selectedStoreId, 'store-1');
  assert.equal(response.body.passwordChangeSuggested, true);
  assert.equal(response.body.stores.length, 1);
  assert.match(response.headers.get('Server-Timing'), /auth;dur=.*reads;dur=.*total;dur=/);
});

test('recordatorio opcional fallido no bloquea el contexto', async () => {
  const storesRequest = deferred();
  const identityRequest = deferred();
  const calls = { stores: 0, identity: 0 };
  const get = loadGet({ userId: 'user-1', isFounderMode: false, storeIds: ['store-1'] }, storesRequest, identityRequest, calls);
  const result = get({ headers: { get: () => '' } });
  storesRequest.resolve({ data: [{ id: 'store-1' }], error: null });
  identityRequest.reject(new Error('Auth unavailable'));
  const response = await result;
  assert.equal(response.body.passwordChangeSuggested, false);
  assert.equal(response.body.selectedStoreId, 'store-1');
});
