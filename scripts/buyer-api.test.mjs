import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies) {
  const js = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, require: name => { if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`); return dependencies[name]; }, URL, Request, Response, console, Date });
  return module.exports;
}
const json = { NextResponse: { json: (body, options) => Response.json(body, options) } };
const rate = { checkDistributedRateLimit: async () => ({ allowed: true }), getClientIp: () => "test" };
const buyer = { id: "10000000-0000-4000-8000-000000000001", email: "a@example.test" };
const id = "30000000-0000-4000-8000-000000000001";

test("buyer authentication validates remote identity, not locally decoded claims", async () => {
  let calls = 0;
  let user = { id: buyer.id, email: buyer.email, email_confirmed_at: "today", app_metadata: { providers: ["google"] } };
  const auth = load("src/lib/buyer/auth-server.ts", { "server-only": {}, "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({ auth: { getUser: async () => { calls++; return { data: { user }, error: null }; } } }) } });
  const request = token => new Request("https://example.test", { headers: token ? { Authorization: token } : {} });
  assert.equal(await auth.getVerifiedBuyer(request()), null);
  assert.equal(await auth.getVerifiedBuyer(request("Bearer forged")), null);
  assert.equal(calls, 0);
  assert.equal((await auth.getVerifiedBuyer(request("Bearer "+"x".repeat(40)))).id, buyer.id);
  user = { ...user, app_metadata: { providers: ["email"] } };
  assert.equal(await auth.getVerifiedBuyer(request("Bearer "+"x".repeat(40))), null);
  user = null;
  assert.equal(await auth.getVerifiedBuyer(request("Bearer "+"x".repeat(40))), null);
});

test("history rejects anonymous access and filters order details by owned order AND store", async () => {
  let verified = null;
  const trace = [];
  const fixtures = {
    buyer_order_accounts: [{ order_id: id, store_id: "store-a" }],
    orders: [{ id, store_id: "store-a", public_code: "SO-1" }, { id: "foreign", store_id: "store-b", public_code: "PRIVATE" }],
    buyer_store_reviews: [{ order_id: id, rating: 4, observation: "Muy buena atencion" }],
  };
  const db = { from: table => {
    const query = { then: resolve => Promise.resolve({ data: fixtures[table], error: null }).then(resolve) };
    for (const method of ["select", "eq", "in", "order", "range"]) query[method] = (...args) => { trace.push({ table, method, args }); return query; };
    return query;
  } };
  const api = load("src/app/api/buyer/orders/route.ts", { "next/server": json, "@/lib/buyer/auth-server": { getVerifiedBuyer: async () => verified }, "@/lib/supabase/admin": { createSupabaseAdminClient: () => db }, "@/lib/server/rate-limit": rate });
  assert.equal((await api.GET(new Request("https://example.test/api/buyer/orders"))).status, 401);
  assert.equal(trace.length, 0);
  verified = buyer;
  assert.equal((await api.GET(new Request("https://example.test/api/buyer/orders?page=-1"))).status, 400);
  const response = await api.GET(new Request("https://example.test/api/buyer/orders?userId=foreign"));
  const data = await response.json();
  assert.equal(data.orders.length, 1); assert.equal(data.orders[0].public_code, "SO-1");
  assert.equal(data.orders[0].rating, 4);
  assert.equal(data.orders[0].observation, "Muy buena atencion");
  assert.ok(trace.some(call => call.table === "buyer_store_reviews" && call.method === "eq" && call.args[0] === "buyer_user_id" && call.args[1] === buyer.id));
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.ok(trace.some(call => call.table === "buyer_order_accounts" && call.method === "eq" && call.args[0] === "buyer_user_id" && call.args[1] === buyer.id));
  assert.ok(trace.some(call => call.table === "orders" && call.method === "in" && call.args[0] === "store_id"));
  assert.ok(trace.every(call => call.method !== "select" || !/customer_phone|customer_name|payment_reference/.test(call.args[0])));
});

test("review endpoint ignores a supplied buyer identity and rejects malformed ratings", async () => {
  let verified = buyer;
  const calls = [];
  const api = load("src/app/api/buyer/reviews/route.ts", { "next/server": json, "@/lib/buyer/auth-server": { getVerifiedBuyer: async () => verified }, "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return { error: null }; } }) }, "@/lib/server/rate-limit": rate });
  const request = body => new Request("https://example.test/api/buyer/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  for (const rating of [0, 6, 1.5, "5", null]) assert.equal((await api.POST(request({ orderId: id, rating }))).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await api.POST(request({ orderId: id, rating: 5, buyerId: "foreign" }))).status, 200);
  assert.equal(calls[0].args.p_buyer_id, buyer.id);
  assert.equal(calls[0].args.p_observation, null);
  assert.equal(calls[0].name, "save_buyer_store_review_with_observation");
  for (const observation of [42, {}, [], true, "x".repeat(501), "bad\u0000text"]) assert.equal((await api.POST(request({ orderId: id, rating: 5, observation }))).status, 400);
  assert.equal(calls.length, 1);
  for (const observation of [null, "", " \n ", "  Excelente\nservicio  ", "x".repeat(500), "\u{1F600}".repeat(500), "<script>alert(1)</script>"]) {
    assert.equal((await api.POST(request({ orderId: id, rating: 5, observation }))).status, 200);
    assert.equal(calls.at(-1).args.p_observation, observation?.trim() || null);
  }
  verified = null;
  assert.equal((await api.POST(request({ orderId: id, rating: 5 }))).status, 401);
  assert.equal(calls.length, 8);
});

test("account deletion requires exact confirmation and deletes only a pure buyer identity", async () => {
  let verified = buyer, deleted = [];
  const counts = { store_users: 0, transport_agency_users: 0, commerce_registration_requests: 0 };
  const db = {
    from: table => {
      const query = { then: resolve => Promise.resolve({ count: counts[table], error: null }).then(resolve) };
      for (const method of ["select", "eq", "in"]) query[method] = () => query;
      return query;
    },
    auth: { admin: { deleteUser: async (...args) => { deleted.push(args); return { error: null }; } } },
  };
  const api = load("src/app/api/buyer/account/route.ts", { "next/server": json, "@/lib/buyer/auth-server": { getVerifiedBuyer: async () => verified }, "@/lib/supabase/admin": { createSupabaseAdminClient: () => db }, "@/lib/server/rate-limit": rate });
  const request = (body, headers = {}) => new Request("https://example.test/api/buyer/account", { method: "DELETE", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  assert.equal((await api.DELETE(request({ confirmation: "eliminar" }))).status, 400);
  assert.equal(deleted.length, 0);
  counts.store_users = 1;
  assert.equal((await api.DELETE(request({ confirmation: "ELIMINAR" }))).status, 409);
  assert.equal(deleted.length, 0);
  counts.store_users = 0;
  assert.equal((await api.DELETE(request({ confirmation: "ELIMINAR", buyerId: "foreign" }))).status, 200);
  assert.deepEqual(deleted, [[buyer.id, false]]);
  verified = null;
  assert.equal((await api.DELETE(request({ confirmation: "ELIMINAR" }))).status, 401);
  assert.equal(deleted.length, 1);
});

test("account deletion fails closed when role checks or auth deletion fail", async () => {
  let roleError = true, deleteError = false;
  const query = { then: resolve => Promise.resolve({ count: 0, error: roleError ? { message: "db" } : null }).then(resolve) };
  for (const method of ["select", "eq", "in"]) query[method] = () => query;
  const db = { from: () => query, auth: { admin: { deleteUser: async () => ({ error: deleteError ? { message: "auth" } : null }) } } };
  const api = load("src/app/api/buyer/account/route.ts", { "next/server": json, "@/lib/buyer/auth-server": { getVerifiedBuyer: async () => buyer }, "@/lib/supabase/admin": { createSupabaseAdminClient: () => db }, "@/lib/server/rate-limit": rate });
  const request = () => new Request("https://example.test/api/buyer/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "ELIMINAR" }) });
  assert.equal((await api.DELETE(request())).status, 503);
  roleError = false; deleteError = true;
  assert.equal((await api.DELETE(request())).status, 503);
});
