// Offline audit only: imports are mocked; no network or production writes.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

function load(file, mocks, env = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, Buffer, URL, File, console,
    process: { env },
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === 'crypto') return require('node:crypto');
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename: file });
  return module.exports;
}

const next = { NextResponse: { json: (body, options = {}) => ({ status: options.status || 200, body }) } };
const observed = {
  createApiRequestContext: () => ({}), attachApiResponseHeaders: response => response,
  logApiError() {}, logApiEvent() {},
};

async function orphanRegistration(kind) {
  const writes = [];
  let authChecks = 0;
  const user = { id: 'victim-user', email: 'victim@example.invalid', email_confirmed_at: '2026-01-01', user_metadata: {} };
  const db = {
    auth: {
      getUser() { authChecks++; throw new Error('No authentication expected in reproduction'); },
      signUp() { authChecks++; throw new Error('No signup expected in reproduction'); },
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://example.invalid/logo.webp' } }) }) },
    from(table) {
      let inserted;
      const q = {
        select() { return q; }, eq() { return q; }, limit() { return q; },
        insert(value) { inserted = value; writes.push({ table, value }); return q; },
        maybeSingle: async () => ({ data: table === 'service_cities' ? { id: 'city' } : null, error: null }),
        single: async () => ({ data: { id: 'new-tenant', name: inserted?.name, slug: 'audit' }, error: null }),
        then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); },
      };
      return q;
    },
  };
  const mocks = {
    'next/server': next,
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => db },
    '@/lib/supabase/server': { createSupabasePublicClient: () => db },
    '@/lib/admin/store-access': { findUserByEmail: async () => user, normalizeAccessEmail: value => String(value || '').toLowerCase() },
    '@/lib/server/rate-limit': { checkDistributedRateLimit: async () => ({ allowed: true }), getClientIp: () => 'test', rateLimitHeaders: () => ({}) },
    '@/lib/server/observability': observed,
    '@/lib/server/site-url': { buildPublicSiteUrl: () => 'https://example.invalid' },
    '@/lib/admin/stores': { slugifyStore: value => value },
    '@/lib/supabase/schema-compat': { isMissingColumnError: () => false },
    '@/lib/plans': { TRIAL_DAYS: 14 },
    '@/lib/business-types': { normalizeBusinessType: () => 'fashion' },
    '@/lib/transport': {
      cleanTransportText: value => String(value || '').trim(), normalizeAgencyModality: value => value,
      optionalTransportNumber: () => null, slugifyTransportAgency: () => 'audit', transportMoney: value => value,
    },
  };
  const fields = {
    storeName: 'audit', representativeName: 'Audit test', representativeIdNumber: 'V-12345678',
    logo: new File(['not-an-image'], 'logo.png', { type: 'image/png' }),
    email: user.email, password: 'Wrong-password-123', whatsapp: '584241234567', cityId: 'city',
    name: 'audit', contactName: 'Audit test', contactEmail: user.email, contactPhone: '584241234567',
  };
  const file = kind === 'commerce' ? 'src/app/api/signup/route.ts' : 'src/app/api/transport/agencies/apply/route.ts';
  const response = await load(file, mocks).POST({
    headers: new Headers({ 'content-type': 'multipart/form-data' }),
    formData: async () => ({ get: key => fields[key] ?? null }), json: async () => fields,
  });
  assert.equal(response.status, 409, `Unexpected response ${response.status}`);
  const membership = writes.find(entry => ['store_users', 'transport_agency_users'].includes(entry.table));
  assert.equal(membership, undefined);
  assert.equal(authChecks, 0);
  console.log(`REMEDIATED ${kind}: unauthenticated orphan-account recovery is blocked with conflict.`);
}

async function cookieRevocation() {
  const cookies = load('src/lib/server/panel-session-cookie.ts', {}, { PANEL_SESSION_COOKIE_SECRET: 'offline-audit-only' });
  const cookie = cookies.createPanelSessionCookie({
    sid: '00000000-0000-0000-0000-000000000001',
    secret: 'offline-session-secret',
    sub: 'deleted-founder',
    email: 'founder@example.invalid',
    founder: true,
    exp: Math.floor(Date.now() / 1000) + 600,
  });
  let serverSessionChecks = 0;
  const auth = load('src/lib/panel/auth.ts', {
    '@/lib/server/panel-session-cookie': cookies,
    '@/lib/server/panel-session-store': {
      getActivePanelServerSession: async () => {
        serverSessionChecks++;
        return null;
      },
    },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => ({}) },
  }, { FOUNDER_EMAILS: 'founder@example.invalid' });
  const context = await auth.getPanelAuthContext({ headers: new Headers(), cookies: { get: () => ({ value: cookie }) } });
  assert.equal(context.isFounderMode, false);
  assert.equal(context.isAuthorized, false);
  assert.equal(serverSessionChecks, 1);
  assert.equal(cookies.readPanelSessionCookie(cookie + 'tampered'), null);
  console.log('REMEDIATED session: a signed founder cookie is rejected when the server-side session is missing or revoked.');
}

(async () => {
  await orphanRegistration('commerce');
  await orphanRegistration('transport');
  await cookieRevocation();
  const nextPath = '/' + String.fromCharCode(92) + 'example.invalid/path';
  assert.ok(nextPath.startsWith('/') && !nextPath.startsWith('//'));
  assert.equal(new URL(nextPath, 'https://www.somos-ve.com').origin, 'https://example.invalid');
  const loginSource = fs.readFileSync('src/components/panel/LoginForm.tsx', 'utf8');
  const redirect = load('src/lib/panel/safe-redirect.ts', {});
  assert.equal(redirect.safeInternalPanelPath(nextPath), '/panel');
  assert.ok(loginSource.includes('safeInternalPanelPath(nextPath)'));
  assert.ok(!loginSource.includes('nextPath.startsWith("/") && !nextPath.startsWith("//")'));
  console.log('REMEDIATED redirect: backslash next-path is forced to the internal fallback.');
  console.log('Audit reproductions completed. CONFIRMED means a finding still exists; REMEDIATED means the old reproduction is blocked.');
})().catch(error => { console.error(error); process.exitCode = 1; });
