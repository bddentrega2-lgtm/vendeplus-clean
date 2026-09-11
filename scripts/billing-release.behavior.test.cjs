// Real handlers/helpers; synthetic database and no network.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function loader(mocks = {}) {
  const cache = new Map();
  const context = vm.createContext({ Request, Response, Headers, URL, URLSearchParams,
    Map, Set, Error, Buffer, performance, console, process: { env: { FOUNDER_EMAILS: "founder@example.invalid" } },
    fetch() { throw new Error("Network prohibited"); } });
  function load(relative) {
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) throw new Error("Outside fixture");
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} }; cache.set(file, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    function req(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === "next/server") return { NextRequest: Request, NextResponse: Response };
      if (name === "server-only") return {};
      if (name.startsWith("@/")) return load("src/" + name.slice(2) + ".ts");
      if (name.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(file), name)) + ".ts");
      throw new Error("Unmocked dependency: " + name);
    }
    vm.runInContext("(function(require,module,exports){" + source + "\n})", context, { filename: file })(req, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}
function simpleQuery(data) {
  const q = {};
  for (const name of ["select","eq","in","order","gte","lt","limit"]) q[name] = () => q;
  q.then = (yes, no) => Promise.resolve({ data, error: null }).then(yes, no);
  return q;
}

for (const count of [0, 200, 201, 1001, 10000]) {
  test("facturaciÃ³n completa con " + count + " servicios", async () => {
    const { loadCompleteBillingRows } = loader()("src/lib/transport/billing-pagination.ts");
    const rows = Array.from({ length: count }, (_, index) => ({ id: String(index), amount: 3 }));
    const result = await loadCompleteBillingRows(async (from, to) => ({
      data: rows.slice(from, to + 1), count: rows.length, error: null,
    }));
    assert.equal(result.data.length, count);
    assert.equal(result.data.reduce((sum, row) => sum + row.amount, 0), count * 3);
  });
}
test("lÃ­mite remoto menor no recorta silenciosamente", async () => {
  const { loadCompleteBillingRows } = loader()("src/lib/transport/billing-pagination.ts");
  const rows = Array.from({ length: 247 }, (_, i) => ({ id: String(i) }));
  const result = await loadCompleteBillingRows(async (from) => ({ data: rows.slice(from, from + 50), error: null, count: rows.length }));
  assert.equal(result.data.length, 247);
});
test("error en segunda pÃ¡gina, conteo cambiante o datos repetidos rechazan informe", async () => {
  const { loadCompleteBillingRows } = loader()("src/lib/transport/billing-pagination.ts");
  const rows = Array.from({ length: 200 }, (_, i) => ({ id: String(i) }));
  for (const second of [
    { data: [], error: new Error("Offline"), count: 201 },
    { data: [{ id: "201" }], error: null, count: 202 },
    { data: [{ id: "0" }], error: null, count: 201 },
    { data: [], error: null, count: 201 },
  ]) {
    await assert.rejects(loadCompleteBillingRows(async (from) => from === 0 ? { data: rows, count: 201, error: null } : second));
  }
});
test("sin conteo exacto o rango excesivo no devuelve un total parcial", async () => {
  const { loadCompleteBillingRows } = loader()("src/lib/transport/billing-pagination.ts");
  for (const count of [null, 20001]) {
    await assert.rejects(loadCompleteBillingRows(async () => ({ data: [], count, error: null })));
  }
});

test("ruta real: resumen 201/$603 no depende de filas; detalle completo; tenant ajeno bloqueado", async () => {
  let detailReads = 0;
  const agency = { id: "agency-one", slug: "synthetic" };
  const rows = Array.from({ length: 201 }, (_, i) => ({ id: String(i), status: "delivered", delivery_fee_usd: 3 }));
  const supabase = {
    from(table) {
      if (table === "transport_agencies") return simpleQuery([agency]);
      if (table !== "transport_orders") throw new Error("Unexpected table " + table);
      detailReads++;
      const q = simpleQuery([]);
      q.in = (key, values) => { assert.equal(key, "agency_id"); assert.equal(values.join(","), agency.id); return q; };
      q.range = (from, to) => Promise.resolve({ data: rows.slice(from, to + 1), count: rows.length, error: null });
      return q;
    },
    rpc: async (name, args) => {
      assert.equal(name, "transport_billing_summary");
      assert.equal(args.p_agency_ids.join(","), agency.id);
      return { data: { ordersCount: 201, totalUsd: 603, driverPayouts: [] }, error: null };
    },
  };
  const GET = loader({
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => supabase },
    "@/lib/transport/access": { requireTransportAgencyAuth: async () => ({ agencyIds: [agency.id] }), transportErrorResponse: () => Response.json({ error: "Failed" }, { status: 500 }) },
    "@/lib/transport": { getTransportBillingRange: () => ({ start: "2026-08-01T04:00:00Z", end: "2026-09-01T04:00:00Z" }) },
    "@/lib/transport/driver-dispatch": { isPremiumDispatchSchemaMissing: () => false },
  })("src/app/api/transport/me/route.ts").GET;
  const request = (detail, agencyId = agency.id) => {
    const r = new Request("https://example.invalid/api/transport/me?includeRelations=false&includeConfiguration=false&billingDetail=" + detail + "&agencyId=" + agencyId);
    r.nextUrl = new URL(r.url); return r;
  };
  let response = await GET(request(false));
  assert.equal(response.status, 200);
  let body = await response.json();
  assert.equal(body.billing.totalUsd, 603); assert.equal(body.billing.ordersCount, 201);
  assert.equal(detailReads, 0);
  response = await GET(request(true)); body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.billing.orders.length, 201);
  assert.equal(body.billing.totalUsd, 603); assert.equal(detailReads, 2);
  assert.equal((await GET(request(false, "agency-other"))).status, 403);
  supabase.rpc = async () => ({ data: null, error: new Error("Missing migration") });
  assert.equal((await GET(request(false))).status, 500);
});
