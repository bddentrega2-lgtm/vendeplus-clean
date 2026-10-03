import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(js, { module: loadedModule, exports: loadedModule.exports, require: name => dependencies[name] ?? (() => { throw new Error(`Unexpected import ${name}`); })(), fetch, process, JSON, Set, Date, encodeURIComponent });
  return loadedModule.exports;
}

function database({ enabled = true, triggerMode = "received", devices = [] } = {}) {
  const calls = [];
  const supabase = { from(table) {
    const state = { table, operation: "select" };
    const query = { then(resolve) {
      const data = table === "store_print_settings" ? { is_enabled: enabled, trigger_mode: triggerMode } : state.operation === "update" ? null : devices;
      return Promise.resolve({ data, error: null }).then(resolve);
    } };
    for (const method of ["select", "eq", "is", "not", "limit", "in"]) query[method] = (...args) => { calls.push({ table, method, args }); return query; };
    query.maybeSingle = () => query;
    query.update = value => { state.operation = "update"; calls.push({ table, method: "update", args: [value] }); return query; };
    return query;
  } };
  return { supabase, calls };
}

const push = load("src/lib/printing/firebase-push.ts", { "server-only": {}, "google-auth-library": { GoogleAuth: class {} } });
const credentials = { account: { project_id: "somos-test" }, auth: { getAccessToken: async () => "access-token" } };
const plain = value => JSON.parse(JSON.stringify(value));

test("missing Firebase credentials is a no-op without touching the database", async () => {
  const { supabase, calls } = database();
  const result = await push.sendPrintWakePush({ supabase, storeId: "store-a", orderId: "order-a", credentials: null });
  assert.deepEqual(plain(result), { configured: false, attempted: 0, sent: 0, invalidated: 0 });
  assert.equal(calls.length, 0);
});

test("push targets only eligible store devices and invalidates rejected tokens", async () => {
  const { supabase, calls } = database({ devices: [{ id: "device-a", fcm_token: "valid-token" }, { id: "device-b", fcm_token: "invalid-token" }] });
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });
    return options.body.includes("invalid-token")
      ? { ok: false, json: async () => ({ error: { details: [{ errorCode: "UNREGISTERED" }] } }) }
      : { ok: true, json: async () => ({}) };
  };
  const result = await push.sendPrintWakePush({ supabase, storeId: "store-a", orderId: "order-a", credentials, fetchImpl });
  assert.deepEqual(plain(result), { configured: true, attempted: 2, sent: 1, invalidated: 1 });
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.url, "https://fcm.googleapis.com/v1/projects/somos-test/messages:send");
    assert.equal(request.options.headers.Authorization, "Bearer access-token");
    assert.deepEqual(plain(request.body.message.data), { type: "print_jobs", orderId: "order-a" });
    assert.equal(request.body.message.android.priority, "high");
    assert.equal(JSON.stringify(request.body).includes("customer"), false);
  }
  assert.ok(calls.some(call => call.table === "print_agent_devices" && call.method === "eq" && call.args[0] === "store_id" && call.args[1] === "store-a"));
  assert.ok(calls.some(call => call.table === "print_agent_devices" && call.method === "eq" && call.args[0] === "platform" && call.args[1] === "android"));
  assert.ok(calls.some(call => call.table === "print_agent_devices" && call.method === "in" && call.args[0] === "id" && call.args[1][0] === "device-b"));
});

test("disabled automatic printing never queries devices or sends push", async () => {
  const { supabase, calls } = database({ enabled: false, devices: [{ id: "device-a", fcm_token: "token" }] });
  let requests = 0;
  const result = await push.sendPrintWakePush({ supabase, storeId: "store-a", orderId: "order-a", credentials, fetchImpl: async () => { requests++; } });
  assert.deepEqual(plain(result), { configured: true, attempted: 0, sent: 0, invalidated: 0 });
  assert.equal(requests, 0);
  assert.equal(calls.some(call => call.table === "print_agent_devices"), false);
});

test("manual printing wakes the app even when automatic printing is disabled", async () => {
  const { supabase, calls } = database({ enabled: false, devices: [{ id: "device-a", fcm_token: "token" }] });
  let requests = 0;
  const result = await push.sendPrintWakePush({
    supabase,
    storeId: "store-a",
    orderId: "order-a",
    eventType: "manual",
    credentials,
    fetchImpl: async () => {
      requests += 1;
      return { ok: true, json: async () => ({}) };
    },
  });
  assert.deepEqual(plain(result), { configured: true, attempted: 1, sent: 1, invalidated: 0 });
  assert.equal(requests, 1);
  assert.ok(calls.some(call => call.table === "print_agent_devices"));
});

test("payment verification wakes only stores configured to print paid orders", async () => {
  const devices = [{ id: "device-a", fcm_token: "token" }];
  const skipped = database({ triggerMode: "paid", devices });
  let requests = 0;
  const fetchImpl = async () => { requests += 1; return { ok: true, json: async () => ({}) }; };

  const receivedResult = await push.sendPrintWakePush({
    supabase: skipped.supabase,
    storeId: "store-a",
    orderId: "order-a",
    eventType: "received",
    credentials,
    fetchImpl,
  });
  assert.deepEqual(plain(receivedResult), { configured: true, attempted: 0, sent: 0, invalidated: 0 });
  assert.equal(requests, 0);
  assert.equal(skipped.calls.some(call => call.table === "print_agent_devices"), false);

  const enabled = database({ triggerMode: "paid", devices });
  const paidResult = await push.sendPrintWakePush({
    supabase: enabled.supabase,
    storeId: "store-a",
    orderId: "order-a",
    eventType: "paid",
    credentials,
    fetchImpl,
  });
  assert.deepEqual(plain(paidResult), { configured: true, attempted: 1, sent: 1, invalidated: 0 });
  assert.equal(requests, 1);
});

test("payment verification queues a paid wake only on the first verified transition", () => {
  const paymentRoute = readFileSync(new URL("../src/app/api/panel/orders/[orderId]/payment/route.ts", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../src/components/panel/PrintingManager.tsx", import.meta.url), "utf8");
  assert.match(paymentRoute, /existingOrder\.payment_status !== "verified"/);
  assert.match(paymentRoute, /after\(\(\) => safeSendPrintWakePush/);
  assert.match(paymentRoute, /eventType: "paid"/);
  assert.match(settings, /Imprimir al verificar el pago/);
  assert.match(settings, /received && paid \? "both" : paid \? "paid" : "received"/);
});

test("manual print and retry wake the app while the print center remains store-scoped", () => {
  const manualRoute = readFileSync(new URL("../src/app/api/panel/printing/orders/[orderId]/route.ts", import.meta.url), "utf8");
  const statusRoute = readFileSync(new URL("../src/app/api/panel/printing/status/route.ts", import.meta.url), "utf8");
  assert.match(manualRoute, /after\(\(\) => safeSendPrintWakePush/);
  assert.match(manualRoute, /eventType: "manual"/);
  assert.match(statusRoute, /requirePanelAuth\(request\)/);
  assert.match(statusRoute, /assertStoreAccess\(auth, storeId\)/);
  assert.ok((statusRoute.match(/\.eq\("store_id", storeId\)/g) || []).length >= 6);
  assert.match(statusRoute, /job\.status !== "failed"/);
  assert.match(statusRoute, /new Date\(job\.created_at\)\.getTime\(\) < recoveryCutoffMs/);
  assert.match(statusRoute, /\.gte\("created_at", recoveryCutoff\)/);
  assert.match(statusRoute, /status: "pending"[\s\S]*attempts: 0/);
  assert.match(statusRoute, /eventType: "manual"/);
  assert.match(statusRoute, /error_message: publicPrintError\(last_error\)/);
  assert.doesNotMatch(statusRoute, /error_message:\s*last_error/);
});

test("order replay cannot send another push and Android deduplicates remote order IDs", () => {
  const route = readFileSync(new URL("../src/app/api/orders/route.ts", import.meta.url), "utf8");
  const android = readFileSync(new URL("../mobile/somos-android/android/app/src/main/java/com/somosve/app/SomosOrderAlertsPlugin.java", import.meta.url), "utf8");
  const service = readFileSync(new URL("../mobile/somos-android/android/app/src/main/java/com/somosve/app/SomosFirebaseMessagingService.java", import.meta.url), "utf8");
  assert.match(route, /if \(!atomicResult\.idempotentReplay\) \{[\s\S]*safeSendPrintWakePush/);
  assert.match(android, /getSharedPreferences\("somos_remote_orders"/);
  assert.match(android, /if \(ids\.contains\(id\)\) return/);
  assert.match(service, /"print_jobs"\.equals\(message\.getData\(\)\.get\("type"\)\)/);
});

test("staging deployment keeps Firebase opt-in and redacts its raw credential", () => {
  const deploy = readFileSync(new URL("../scripts/ops/buyer-staging-preview.mjs", import.meta.url), "utf8");
  assert.match(deploy, /SOMOS_FIREBASE_PREVIEW === '1'/);
  assert.match(deploy, /FIREBASE_SERVICE_ACCOUNT_JSON = firebasePreviewRaw/);
  assert.match(deploy, /replaceAll\(firebasePreviewRaw, firebasePreviewRaw \? '\[firebase-redacted\]'/);
  assert.match(deploy, /firebaseEnabled: Boolean\(firebasePreview\)/);
});
