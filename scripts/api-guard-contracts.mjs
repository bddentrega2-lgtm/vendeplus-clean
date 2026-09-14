import { readdirSync, readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join, relative, sep } from "node:path";

const API_ROOT = join(process.cwd(), "src", "app", "api");

const PUBLIC_SERVICE_ROLE_ROUTES = {
  "src/app/api/auth/panel-session/route.ts": [/supabase\.auth\.getUser\(token\)/],
  "src/app/api/cities/route.ts": [/export async function GET/, /\.select\(/],
  "src/app/api/catalog/cart-suggestions/route.ts": [
    /\.eq\("slug", storeSlug\)/,
    /\.eq\("is_active", true\)/,
    /\.eq\("is_available", true\)/,
  ],
  "src/app/api/cron/exchange-rates/route.ts": [/CRON_SECRET/],
  "src/app/api/cron/payment-receipts-cleanup/route.ts": [/CRON_SECRET/],
  "src/app/api/delivery/quote/route.ts": [
    /checkDistributedRateLimit/,
    /signDeliveryQuote/,
  ],
  "src/app/api/integrations/entrega2/driver-location/route.ts": [
    /isValidEntrega2Webhook\(request\.headers\)/,
  ],
  "src/app/api/integrations/entrega2/order-status/route.ts": [
    /isValidEntrega2Webhook\(request\.headers\)/,
  ],
  "src/app/api/orders/payment-receipt/route.ts": [
    /checkDistributedRateLimit/,
    /sharp\(input\)/,
  ],
  "src/app/api/orders/route.ts": [
    /checkDistributedRateLimit/,
    /createOrderAtomic/,
  ],
  "src/app/api/signup/route.ts": [
    /checkDistributedRateLimit/,
    /captchaToken/,
  ],
  "src/app/api/table-orders/status/route.ts": [
    /getStoreIdByTableOrderToken/,
  ],
  "src/app/api/transport/agencies/apply/route.ts": [
    /checkDistributedRateLimit/,
    /captchaToken/,
  ],
  "src/app/api/transport/particulares/[agencySlug]/route.ts": [
    /checkDistributedRateLimit/,
    /premium_dispatch_enabled === true/,
  ],
};

const GUARD_PATTERNS = {
  admin: [/requireAdminAuth\(request\)/],
  panel: [/requirePanelAuth\(request\)/, /getPanelAuthContext\(request\)/],
  transport: [/requireTransportAgencyAuth\(request\)/],
};

function toRepoPath(path) {
  return relative(process.cwd(), path).split(sep).join("/");
}

function listRouteFiles(directory) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...listRouteFiles(path));
    } else if (entry === "route.ts") {
      files.push(path);
    }
  }

  return files;
}

function routeKind(routePath) {
  if (routePath.startsWith("src/app/api/admin/")) return "admin";
  if (routePath.startsWith("src/app/api/panel/")) return "panel";
  if (routePath.startsWith("src/app/api/transport/")) return "transport";
  return null;
}

function hasAnyPattern(source, patterns) {
  return patterns.some((pattern) => pattern.test(source));
}

export function auditApiGuards() {
  const findings = [];
  const routeFiles = listRouteFiles(API_ROOT)
    .map((path) => ({ path, repoPath: toRepoPath(path), source: readFileSync(path, "utf8") }))
    .filter(({ source }) => source.includes("createSupabaseAdminClient"));

  for (const { repoPath, source } of routeFiles) {
    const publicRequirements = PUBLIC_SERVICE_ROLE_ROUTES[repoPath];
    if (publicRequirements) {
      const missing = publicRequirements.filter((pattern) => !pattern.test(source));
      if (missing.length) {
        findings.push(`${repoPath}: ruta publica service_role sin contrato requerido (${missing.map(String).join(", ")})`);
      }
      continue;
    }

    const kind = routeKind(repoPath);
    if (!kind) {
      findings.push(`${repoPath}: usa service_role sin clasificacion admin/panel/transport/public`);
      continue;
    }

    if (!hasAnyPattern(source, GUARD_PATTERNS[kind])) {
      findings.push(`${repoPath}: usa service_role en ruta ${kind} sin guardia ${kind}`);
    }
  }

  return {
    checkedRoutes: routeFiles.length,
    publicServiceRoleRoutes: Object.keys(PUBLIC_SERVICE_ROLE_ROUTES).length,
    findings,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = auditApiGuards();
  if (result.findings.length) {
    console.error(result.findings.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      `API guard contracts OK: ${result.checkedRoutes} service_role routes checked; ${result.publicServiceRoleRoutes} public routes allowlisted.`
    );
  }
}
