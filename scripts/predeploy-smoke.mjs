import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const root = process.cwd();
const baseUrl =
  process.env.PREDEPLOY_BASE_URL ||
  process.env.E2E_BASE_URL ||
  process.env.LOAD_BASE_URL ||
  "https://somos-ve.com";
const storeSlug = process.env.PREDEPLOY_STORE_SLUG || process.env.E2E_STORE_SLUG || "armario";
const skipHttp = String(process.env.PREDEPLOY_SKIP_HTTP || "").toLowerCase() === "true";
const hardBudgetMs = Number(process.env.PREDEPLOY_HARD_BUDGET_MS || 15_000);
const results = [];

function add(status, label, detail = "") {
  results.push({ status, label, detail });
}

function filePath(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return readFileSync(filePath(relativePath), "utf8");
}

function assertFile(relativePath) {
  if (!existsSync(filePath(relativePath))) {
    add("FAIL", "Archivo requerido", `Falta ${relativePath}`);
    return false;
  }

  add("PASS", "Archivo requerido", relativePath);
  return true;
}

function listFiles(relativePath) {
  const fullPath = filePath(relativePath);
  if (!existsSync(fullPath)) return [];

  const entries = [];
  for (const name of readdirSync(fullPath)) {
    const childRelativePath = path.join(relativePath, name);
    const childFullPath = filePath(childRelativePath);
    const stat = statSync(childFullPath);
    if (stat.isDirectory()) {
      if ([".next", "node_modules"].includes(name)) continue;
      entries.push(...listFiles(childRelativePath));
    } else {
      entries.push(childRelativePath);
    }
  }
  return entries;
}

function normalizePathForContract(value) {
  return String(value || "").replace(/\\/g, "/");
}

function assertContains(relativePath, pattern, label) {
  const content = read(relativePath);
  if (!pattern.test(content)) {
    add("FAIL", label, `${relativePath} no cumple ${pattern}`);
    return;
  }

  add("PASS", label, relativePath);
}

function assertNotContains(relativePath, pattern, label) {
  const content = read(relativePath);
  if (pattern.test(content)) {
    add("FAIL", label, `${relativePath} contiene ${pattern}`);
    return;
  }

  add("PASS", label, relativePath);
}

function runSourceContracts() {
  const publicAuthRoutes = [
    "src/app/api/signup/route.ts",
    "src/app/api/transport/agencies/apply/route.ts",
  ];

  for (const route of publicAuthRoutes) {
    if (!assertFile(route)) continue;
    assertContains(route, /auth\.signUp/, "Registro publico usa signUp");
    assertContains(route, /captchaToken/, "Registro publico soporta captchaToken");
    assertNotContains(route, /auth\.admin\.createUser/, "Registro publico sin createUser admin");
    assertNotContains(route, /email_confirm\s*:\s*true/, "Registro publico sin auto-confirmacion");
    assertContains(route, /createApiRequestContext/, "Registro publico con request-id");
  }

  const criticalApiRoutes = [
    "src/app/api/orders/route.ts",
    "src/app/api/panel/orders/[orderId]/send-delivery/route.ts",
    "src/app/api/transport/panel/orders/[transportOrderId]/status/route.ts",
  ];

  for (const route of criticalApiRoutes) {
    if (!assertFile(route)) continue;
    assertContains(route, /createApiRequestContext/, "API critica con request-id");
    assertContains(route, /logApi(Error|Event)/, "API critica con log estructurado");
  }

  const routeFiles = listFiles("src/app/api")
    .filter((entry) => normalizePathForContract(entry).endsWith("/route.ts"))
    .map(normalizePathForContract);

  const publicApiRoutes = new Set([
    "src/app/api/catalog/product-options/route.ts",
    "src/app/api/orders/route.ts",
    "src/app/api/signup/route.ts",
    "src/app/api/transport/agencies/apply/route.ts",
  ]);

  for (const route of routeFiles) {
    const normalizedRoute = normalizePathForContract(route);
    const content = read(route);

    if (publicApiRoutes.has(normalizedRoute)) continue;

    if (normalizedRoute.startsWith("src/app/api/admin/auth-check/")) {
      if (/auth\.getUser/.test(content) && /isFounderEmail/.test(content)) {
        add("PASS", "Contrato admin auth-check", normalizedRoute);
      } else {
        add("FAIL", "Contrato admin auth-check", `${normalizedRoute} debe validar usuario fundador.`);
      }
      continue;
    }

    if (normalizedRoute.startsWith("src/app/api/admin/")) {
      if (/requireAdminAuth/.test(content)) {
        add("PASS", "Contrato admin protegido", normalizedRoute);
      } else {
        add("FAIL", "Contrato admin protegido", `${normalizedRoute} sin requireAdminAuth.`);
      }
      continue;
    }

    if (normalizedRoute.startsWith("src/app/api/panel/")) {
      if (/requirePanelAuth/.test(content)) {
        add("PASS", "Contrato panel protegido", normalizedRoute);
      } else {
        add("FAIL", "Contrato panel protegido", `${normalizedRoute} sin requirePanelAuth.`);
      }
      continue;
    }

    if (normalizedRoute.startsWith("src/app/api/transport/")) {
      if (/requireTransportAgencyAuth/.test(content)) {
        add("PASS", "Contrato transporte protegido", normalizedRoute);
      } else {
        add("FAIL", "Contrato transporte protegido", `${normalizedRoute} sin requireTransportAgencyAuth.`);
      }
      continue;
    }

    if (normalizedRoute.startsWith("src/app/api/cron/")) {
      if (/CRON_SECRET/.test(content)) {
        add("PASS", "Contrato cron protegido", normalizedRoute);
      } else {
        add("FAIL", "Contrato cron protegido", `${normalizedRoute} sin CRON_SECRET.`);
      }
      continue;
    }

    if (normalizedRoute.startsWith("src/app/api/integrations/")) {
      if (/isValidEntrega2Webhook|webhook/i.test(content)) {
        add("PASS", "Contrato webhook protegido", normalizedRoute);
      } else {
        add("FAIL", "Contrato webhook protegido", `${normalizedRoute} sin validacion de webhook.`);
      }
    }
  }

  const requiredMigrations = [
    "supabase/migrations/20260710151755_private_transport_order_broadcast.sql",
    "supabase/migrations/20260711010328_distributed_rate_limits.sql",
  ];

  for (const migration of requiredMigrations) assertFile(migration);

  const directServiceRoleHits = listFiles("src")
    .filter((entry) => /\.(ts|tsx)$/.test(entry))
    .filter((entry) => normalizePathForContract(entry) !== "src/lib/supabase/admin.ts")
    .filter((entry) => /SUPABASE_SERVICE_ROLE_KEY/.test(read(entry)));

  if (directServiceRoleHits.length) {
    add("FAIL", "Service role encapsulado", directServiceRoleHits.join(", "));
  } else {
    add("PASS", "Service role encapsulado", "Solo se referencia en lib/supabase/admin.ts.");
  }
}

function url(routePath) {
  return new URL(routePath, baseUrl).toString();
}

async function fetchWithTimeout(routePath, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), hardBudgetMs);
  const start = performance.now();

  try {
    const response = await fetch(url(routePath), {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "VendeMasPredeploySmoke/1.0",
        ...(init.headers || {}),
      },
    });
    const text = await response.text();
    return {
      routePath,
      status: response.status,
      ok: response.ok,
      ms: Math.round(performance.now() - start),
      requestId: response.headers.get("x-request-id") || "",
      bodyPreview: text.slice(0, 160),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runHttpSmoke() {
  if (skipHttp) {
    add("WARN", "HTTP smoke", "Omitido por PREDEPLOY_SKIP_HTTP=true.");
    return;
  }

  const readOnlyRoutes = [
    "/",
    "/marketplace",
    `/${storeSlug}`,
    `/${storeSlug}/carrito`,
    "/transporte",
    "/panel/login",
  ];

  for (const routePath of readOnlyRoutes) {
    const result = await fetchWithTimeout(routePath);
    if (!result.ok || result.ms > hardBudgetMs) {
      add("FAIL", "HTTP read-only", `${routePath} status ${result.status} ${result.ms}ms`);
    } else {
      add("PASS", "HTTP read-only", `${routePath} ${result.status} ${result.ms}ms`);
    }
  }

  const negativeApiChecks = [
    { routePath: "/api/signup", method: "POST", expected: [400, 413, 429] },
    { routePath: "/api/orders", method: "POST", expected: [400, 413, 429] },
    { routePath: "/api/transport/agencies/apply", method: "POST", expected: [400, 413, 429] },
  ];

  for (const check of negativeApiChecks) {
    const result = await fetchWithTimeout(check.routePath, {
      method: check.method,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": `predeploy-${Date.now()}`,
      },
      body: "{}",
    });

    if (!check.expected.includes(result.status)) {
      add(
        "FAIL",
        "API negativa segura",
        `${check.routePath} status ${result.status}; body: ${result.bodyPreview}`
      );
      continue;
    }

    add(
      result.requestId ? "PASS" : "WARN",
      "API negativa segura",
      `${check.routePath} status ${result.status}${result.requestId ? ` requestId ${result.requestId}` : " sin X-Request-Id en deploy actual"}`
    );
  }
}

runSourceContracts();
await runHttpSmoke();

const failures = results.filter((entry) => entry.status === "FAIL");

for (const result of results) {
  console.log(`[${result.status}] ${result.label}${result.detail ? ` - ${result.detail}` : ""}`);
}

console.log("");
console.log(
  failures.length
    ? "Resultado: NO listo para deploy. Corrige los FAIL antes de produccion."
    : "Resultado: smoke predeploy OK. Si los WARN son esperados, puedes continuar con QA manual."
);

process.exit(failures.length ? 1 : 0);
