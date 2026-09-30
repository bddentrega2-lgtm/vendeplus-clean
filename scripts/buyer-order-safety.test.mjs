import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(js, { module: loadedModule, exports: loadedModule.exports, require: name => dependencies[name] ?? (() => { throw new Error(`Unexpected import ${name}`); })(), fetch, JSON, Error });
  return loadedModule.exports;
}

test("authenticated orders use the verified server buyer and guest orders use the guest transaction", async () => {
  const calls = [];
  const supabase = { rpc: async (name, args) => { calls.push({ name, args }); return { data: { order: { id: "order-1" }, idempotent_replay: false }, error: null }; } };
  const { createOrderAtomic } = load("src/lib/server/create-order-atomic.ts", { "server-only": {} });

  await createOrderAtomic({ supabase, order: { buyer_id: "untrusted-client-value" }, items: [], buyerId: "verified-buyer" });
  await createOrderAtomic({ supabase, order: {}, items: [] });

  assert.equal(calls[0].name, "create_buyer_order_atomic");
  assert.equal(calls[0].args.p_buyer_id, "verified-buyer");
  assert.equal(calls[1].name, "create_order_atomic");
  assert.equal("p_buyer_id" in calls[1].args, false);
});

test("checkout retains one idempotency key through failures and removes its draft only after success", () => {
  const checkout = readFileSync(new URL("../src/components/public/CheckoutForm.tsx", import.meta.url), "utf8");
  assert.match(checkout, /const idempotencyKeyRef = useRef\(createIdempotencyKey\(\)\)/);
  assert.match(checkout, /saveOrderToSupabase\([\s\S]*?idempotencyKeyRef\.current[\s\S]*?\)/);
  assert.match(checkout, /if \(!saveResult\.ok \|\| !saveResult\.order\) \{[\s\S]*?return;[\s\S]*?\}[\s\S]*?confirmed\.current = true;[\s\S]*?removeMobile/);
  assert.doesNotMatch(checkout, /idempotencyKeyRef\.current\s*=\s*createIdempotencyKey\(\)/);
});

test("order API never reads a buyer id supplied in the request body", () => {
  const route = readFileSync(new URL("../src/app/api/orders/route.ts", import.meta.url), "utf8");
  assert.match(route, /const buyer = request\.headers\.has\("authorization"\) \? await getVerifiedBuyer\(request\) : null/);
  assert.match(route, /buyerId: buyer\?\.id/);
  assert.doesNotMatch(route, /body\.buyerId|order\.buyerId|buyer_id\s*:\s*body/);
});
