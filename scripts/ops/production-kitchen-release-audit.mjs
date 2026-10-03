import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

const productionRef = "rvmtjtuztewcrmodrodb";
const phase = process.argv[2];
if (!['preflight', 'postflight'].includes(phase)) throw new Error("Use preflight or postflight.");

const env = parseEnv(readFileSync("../.env.local", "utf8"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
if (!url?.includes(productionRef) || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Production environment guard failed.");
}

const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function count(table, apply = query => query) {
  const result = await apply(db.from(table).select("*", { head: true, count: "exact" }));
  if (result.error) throw result.error;
  return result.count ?? 0;
}

const statusCounts = {};
for (const status of ["received", "accepted", "preparing", "ready", "delivering", "completed", "cancelled"]) {
  statusCounts[status] = await count("orders", query => query.eq("status", status));
}

const candidateResult = await db
  .from("stores")
  .select("slug")
  .eq("table_orders_access_enabled", true)
  .eq("table_orders_enabled", true);
if (candidateResult.error) throw candidateResult.error;

const settingsProbe = await db
  .from("store_kitchen_settings")
  .select("enabled")
  .limit(1);

const snapshot = {
  phase,
  capturedAt: new Date().toISOString(),
  projectRef: productionRef,
  stores: {
    total: await count("stores"),
    tableAccess: await count("stores", query => query.eq("table_orders_access_enabled", true)),
    tableEnabled: await count("stores", query => query.eq("table_orders_enabled", true)),
    kitchenEligible: candidateResult.data.length,
    eligibleSlugs: candidateResult.data.map(store => store.slug).sort(),
  },
  orders: { total: await count("orders"), byStatus: statusCounts },
  products: { total: await count("products") },
  kitchen: {
    schemaPresent: !settingsProbe.error,
    settings: settingsProbe.error ? null : await count("store_kitchen_settings"),
    enabled: settingsProbe.error
      ? null
      : await count("store_kitchen_settings", query => query.eq("enabled", true)),
  },
};

mkdirSync("tmp/production-kitchen-release", { recursive: true });
writeFileSync(`tmp/production-kitchen-release/${phase}.json`, JSON.stringify(snapshot, null, 2));
console.log(JSON.stringify(snapshot, null, 2));
