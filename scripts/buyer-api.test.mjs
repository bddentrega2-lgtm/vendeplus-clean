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

test("account deletion is immediate for buyers and idempotently queued for operational accounts", async () => {
  let identity = { mode: "user", userId: buyer.id, email: buyer.email, isFounderMode: false };
  let storeRows = [], pending = null;
  const inserted = [], deleted = [];
  const rows = table => table === "store_users" ? storeRows : [];
  const db = {
    from: table => {
      const query = {
        select: () => query, eq: () => query, in: () => query,
        maybeSingle: async () => ({ data: table === "account_deletion_requests" ? pending : null, error: null }),
        insert: async payload => { inserted.push(payload); pending = { id: "request-1", status: "pending", requested_at: "today" }; return { error: null }; },
        update: () => query,
        then: resolve => Promise.resolve({ data: rows(table), error: null }).then(resolve),
      };
      return query;
    },
    auth: { admin: { deleteUser: async (...args) => { deleted.push(args); return { error: null }; } } },
  };
  const api = load("src/app/api/buyer/account/route.ts", { "next/server": json, "@/lib/panel/auth": { getPanelAuthContext: async () => identity }, "@/lib/supabase/admin": { createSupabaseAdminClient: () => db }, "@/lib/server/rate-limit": rate });
  const request = body => new Request("https://example.test/api/buyer/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await api.DELETE(request({ confirmation: "eliminar" }))).status, 400);
  assert.equal((await api.DELETE(request({ confirmation: "ELIMINAR", buyerId: "foreign" }))).status, 200);
  assert.deepEqual(deleted, [[buyer.id, false]]);

  storeRows = [{ store_id: "store-a", role: "owner" }];
  const queued = await api.DELETE(request({ confirmation: "ELIMINAR" }));
  assert.equal(queued.status, 202);
  assert.equal((await queued.json()).pending, true);
  assert.equal(inserted.length, 1);
  assert.equal(Array.from(inserted[0].store_ids).join(","), "store-a");
  assert.equal((await api.DELETE(request({ confirmation: "ELIMINAR" }))).status, 202);
  assert.equal(inserted.length, 1);
  assert.equal(deleted.length, 1);

  identity = { mode: "none", isFounderMode: false };
  assert.equal((await api.DELETE(request({ confirmation: "ELIMINAR" }))).status, 401);
});

test("account deletion fails closed for founder, database checks and auth deletion", async () => {
  let founder = true, roleError = false, deleteError = false;
  const db = {
    from: table => {
      const query = {
        select: () => query, eq: () => query, in: () => query, update: () => query,
        maybeSingle: async () => ({ data: null, error: roleError ? { message: "db" } : null }),
        then: resolve => Promise.resolve({ data: [], error: roleError ? { message: "db" } : null }).then(resolve),
      };
      return query;
    },
    auth: { admin: { deleteUser: async () => ({ error: deleteError ? { message: "auth" } : null }) } },
  };
  const auth = async () => ({ mode: "user", userId: buyer.id, email: buyer.email, isFounderMode: founder });
  const api = load("src/app/api/buyer/account/route.ts", { "next/server": json, "@/lib/panel/auth": { getPanelAuthContext: auth }, "@/lib/supabase/admin": { createSupabaseAdminClient: () => db }, "@/lib/server/rate-limit": rate });
  const request = () => new Request("https://example.test/api/buyer/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "ELIMINAR" }) });
  assert.equal((await api.DELETE(request())).status, 409);
  founder = false; roleError = true;
  assert.equal((await api.DELETE(request())).status, 503);
  roleError = false; deleteError = true;
  assert.equal((await api.DELETE(request())).status, 503);
});
