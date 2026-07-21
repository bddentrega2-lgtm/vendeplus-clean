import { performance } from "node:perf_hooks";

const baseUrl = process.env.LOAD_BASE_URL || "https://somos-ve.com";
const storeSlug = process.env.LOAD_STORE_SLUG || "armario";
const concurrency = Number(process.env.LOAD_CONCURRENCY || 4);
const hardBudgetMs = Number(process.env.LOAD_HARD_BUDGET_MS || 12000);

const paths = [
  "/",
  "/marketplace",
  `/${storeSlug}`,
  `/${storeSlug}/carrito`,
  "/transporte",
];

function url(path) {
  return new URL(path, baseUrl).toString();
}

async function measure(path) {
  const start = performance.now();
  const response = await fetch(url(path), {
    headers: { "User-Agent": "VendeMasLoadSmoke/1.0" },
  });
  await response.arrayBuffer();
  const ms = Math.round(performance.now() - start);
  return { path, status: response.status, ok: response.ok, ms };
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index] || 0;
}

const jobs = [];
for (let index = 0; index < concurrency; index += 1) {
  for (const path of paths) jobs.push(path);
}

const results = await Promise.all(jobs.map((path) => measure(path)));
const failures = results.filter((entry) => !entry.ok || entry.ms > hardBudgetMs);

for (const path of paths) {
  const entries = results.filter((entry) => entry.path === path);
  const times = entries.map((entry) => entry.ms);
  const avg = Math.round(times.reduce((sum, value) => sum + value, 0) / times.length);
  console.log(
    `${path} - avg ${avg}ms - p95 ${percentile(times, 95)}ms - max ${Math.max(...times)}ms - status ${entries
      .map((entry) => entry.status)
      .join(",")}`
  );
}

if (failures.length) {
  throw new Error(
    `Load smoke fallo: ${failures
      .slice(0, 5)
      .map((entry) => `${entry.path} status ${entry.status} ${entry.ms}ms`)
      .join(" | ")}`
  );
}

console.log(`Load smoke OK contra ${baseUrl} con concurrencia ${concurrency}.`);
