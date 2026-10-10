import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { getStoreProductLimit } from "../src/lib/plans.ts";
import { kitchenEligible } from "../src/lib/kitchen.ts";

const require = createRequire(import.meta.url);
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("todos los planes tienen 50 productos como minimo sin reducir cupos personalizados", () => {
  assert.equal(getStoreProductLimit({ plan_type: "trial", product_limit: 30 }), 50);
  assert.equal(getStoreProductLimit({ plan_type: "monthly", product_limit: null }), 50);
  assert.equal(getStoreProductLimit({ plan_type: "per_service", product_limit: 63 }), 63);
  assert.equal(getStoreProductLimit({ plan_type: "founder", product_limit: 264 }), 264);
});

test("los beneficios permanentes son incluidos y consultar no escribe recompensas", async () => {
  const source = await read("src/lib/achievements.ts");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    exports: module.exports,
    require: (id) => id === "@/lib/plans" ? { getStoreProductLimit } : require(id),
  });

  const calls = [];
  const supabase = { from(table) {
    calls.push(table);
    assert.equal(table, "stores");
    return { select() { return { eq() { return { single: async () => ({ data: { plan_type: "per_service", product_limit: 30 }, error: null }) }; } }; } };
  } };
  const state = await module.exports.loadStoreAchievements(supabase, "store-1");
  assert.deepEqual(calls, ["stores"]);
  assert.equal(state.productLimit, 50);
  for (const feature of ["full_stats", "product_limit_50", "brand_colors", "customers_detail"]) {
    assert.equal(state.features[feature], true);
  }
  assert.equal(state.achievements.length, 4);
  assert.ok(state.achievements.every((item) => item.unlocked));
  const customers = await read("src/app/api/panel/customers/route.ts");
  assert.doesNotMatch(customers, /store_achievement_unlocks/);
});

test("Cocina queda visible para comercios autorizados y operativa solo con Mesa encendida", async () => {
  assert.equal(kitchenEligible({ table_orders_access_enabled: true, table_orders_enabled: true }), true);
  assert.equal(kitchenEligible({ table_orders_access_enabled: true, table_orders_enabled: false }), false);
  assert.equal(kitchenEligible({ table_orders_access_enabled: false, table_orders_enabled: true }), false);

  const shell = await read("src/components/panel/PanelShell.tsx");
  assert.match(shell, /href: "\/panel\/cocina"[^\n]*premiumFeature: "table_orders"/);
  assert.doesNotMatch(shell, /kitchenOnly/);
  const tables = await read("src/components/panel/TablesManager.tsx");
  assert.match(tables, /table_orders_enabled !== enabled\) await revalidateSession\(\)/);
});

test("admin ya no carga retos antiguos al editar comercios", async () => {
  const form = await read("src/components/admin/AdminStoreForm.tsx");
  assert.doesNotMatch(form, /Retos de agosto|\/api\/admin\/stores\/\$\{storeId\}\/achievements/);
});

test("marketplace conserva destacados temporales sin depender de beneficios permanentes", async () => {
  const page = await read("src/app/marketplace/page.tsx");
  const rewards = await read("src/lib/monthly-challenges.ts");
  assert.match(page, /getActiveMonthlyMarketplaceRewards\(\)/);
  assert.doesNotMatch(page, /loadStoreAchievements|store_achievement_unlocks/);
  assert.match(rewards, /\.eq\("status", "active"\)/);
  assert.match(rewards, /\.lte\("reward_starts_at", now\)/);
  assert.match(rewards, /\.gt\("reward_ends_at", now\)/);
});
