import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/printing/firebase-push.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = { exports: {} };
vm.runInNewContext(js, {
  module: loaded, exports: loaded.exports,
  require: name => name === "server-only" ? {} : name === "google-auth-library" ? { GoogleAuth: class {} } : (() => { throw new Error(name); })(),
  fetch, process, JSON, Set, Date, AbortSignal, encodeURIComponent,
});
const { sendTableAssistancePush } = loaded.exports;
const credentials = { account: { project_id: "somos-test" }, auth: { getAccessToken: async () => "access-token" } };

function database(devices, members) {
  const calls = [];
  return { calls, from(table) {
    const state = { table, operation: "select" };
    const query = { then(resolve) {
      const data = state.operation === "delete" ? null : table === "panel_push_devices" ? devices : members;
      return Promise.resolve({ data, error: null }).then(resolve);
    } };
    for (const method of ["select", "eq", "gte", "limit", "in"]) query[method] = (...args) => { calls.push({ table, method, args }); return query; };
    query.delete = () => { state.operation = "delete"; calls.push({ table, method: "delete" }); return query; };
    return query;
  } };
}

test("assistance reaches only current members of the selected store", async () => {
  const db = database([
    { user_id: "member-a", fcm_token: "token-a" },
    { user_id: "member-b", fcm_token: "token-b" },
    { user_id: "former-member", fcm_token: "token-old" },
  ], [{ user_id: "member-a" }, { user_id: "member-b" }]);
  const messages = [];
  const result = await sendTableAssistancePush({
    supabase: db, storeId: "store-a", tableId: "table-a", requestedAt: "2026-10-05T00:00:00Z", tableName: "Mesa 1", credentials,
    fetchImpl: async (url, options) => { messages.push({ url, body: JSON.parse(options.body) }); return { ok: true }; },
  });
  assert.equal(result.attempted, 2);
  assert.equal(result.sent, 2);
  assert.deepEqual(messages.map(message => message.body.message.token), ["token-a", "token-b"]);
  assert.ok(messages.every(message => message.body.message.data.storeId === "store-a"));
  assert.ok(messages.every(message => message.body.message.data.type === "table_assistance"));
  assert.ok(db.calls.some(call => call.table === "panel_push_devices" && call.method === "eq" && call.args[1] === "store-a"));
  assert.ok(db.calls.some(call => call.table === "store_users" && call.method === "eq" && call.args[1] === "store-a"));
});

test("missing Firebase configuration leaves assistance usable without querying devices", async () => {
  const db = database([], []);
  const result = await sendTableAssistancePush({ supabase: db, storeId: "store-a", tableId: "table-a", requestedAt: "now", tableName: "Mesa", credentials: null });
  assert.equal(result.configured, false);
  assert.equal(db.calls.length, 0);
});

test("invalid FCM tokens are removed only from the selected store", async () => {
  const db = database([{ user_id: "member-a", fcm_token: "bad-token" }], [{ user_id: "member-a" }]);
  const result = await sendTableAssistancePush({
    supabase: db, storeId: "store-a", tableId: "table-a", requestedAt: "now", tableName: "Mesa", credentials,
    fetchImpl: async () => ({ ok: false, json: async () => ({ error: { details: [{ errorCode: "UNREGISTERED" }] } }) }),
  });
  assert.equal(result.sent, 0);
  assert.ok(db.calls.some(call => call.table === "panel_push_devices" && call.method === "delete"));
  assert.ok(db.calls.some(call => call.table === "panel_push_devices" && call.method === "eq" && call.args[0] === "store_id" && call.args[1] === "store-a"));
});

test("route and Android service scope assistance to the active store", () => {
  const route = readFileSync(new URL("../src/app/api/panel/push-devices/route.ts", import.meta.url), "utf8");
  const native = readFileSync(new URL("../mobile/somos-android/android/app/src/main/java/com/somosve/app/SomosFirebaseMessagingService.java", import.meta.url), "utf8");
  assert.match(route, /requirePanelAuth\(request\)/);
  assert.match(route, /assertStoreAccess\(auth, storeId\)/);
  assert.match(route, /auth\.isFounderMode/);
  assert.match(native, /messageStoreId\.equals\(store\.activeStoreId\(\)\)/);
  assert.match(native, /showRemoteAssistance/);
});
