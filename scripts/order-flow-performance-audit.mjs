import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

for (const file of [resolve("../.env.local"), resolve(".env.local")]) {
  if (existsSync(file)) Object.assign(process.env, parseEnv(readFileSync(file, "utf8")));
}

const baseUrl = process.env.PERF_BASE_URL || "https://www.somos-ve.com";
const storeSlugs = (process.env.PERF_STORE_SLUGS || "realza,queje-olga,shibui,joshi-sushi")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const panelStoreSlug = process.env.PERF_PANEL_STORE_SLUG || "smash";
const skipPublic = process.env.PERF_SKIP_PUBLIC === "1";
const skipPanel = process.env.PERF_SKIP_PANEL === "1";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
})) {
  if (!value) throw new Error(`Falta ${name}.`);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const outputDir = resolve("tmp/order-flow-performance-audit");
mkdirSync(outputDir, { recursive: true });

const runId = randomUUID().slice(0, 8);
const email = `qa-performance-${runId}@invalid.local`;
const password = `Qa!${randomUUID()}aA1`;
let userId = "";
let browser;

function appUrl(path) {
  return new URL(path, baseUrl).toString();
}

function percentile(values, position) {
  const ordered = [...values].sort((left, right) => left - right);
  if (!ordered.length) return 0;
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * position) - 1))];
}

async function measureFetch(label, url, init = {}, attempts = 3) {
  const samples = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = performance.now();
    const response = await fetch(url, init);
    const body = await response.text();
    const durationMs = Math.round(performance.now() - startedAt);
    assert.ok(response.ok, `${label} fallo (${response.status}): ${body.slice(0, 300)}`);
    samples.push({
      attempt,
      durationMs,
      bytes: Buffer.byteLength(body),
      cacheControl: response.headers.get("cache-control"),
      vercelCache: response.headers.get("x-vercel-cache"),
      age: response.headers.get("age"),
    });
  }
  return {
    label,
    samples,
    medianMs: percentile(samples.map((sample) => sample.durationMs), 0.5),
    p95Ms: percentile(samples.map((sample) => sample.durationMs), 0.95),
  };
}

async function findOptionProduct(storeId) {
  const { data, error } = await admin
    .from("products")
    .select("id, name, sort_order, product_variants(id), product_option_group_products(id)")
    .eq("store_id", storeId)
    .eq("is_available", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const products = data || [];
  return products.find((product) => product.product_option_group_products?.length && !product.product_variants?.length)
    || products.find((product) => product.product_option_group_products?.length)
    || null;
}

async function measureBrowserCustomization(store, product = null) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "es-VE",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  const optionRequests = [];
  const requestStartedAt = new Map();
  page.on("request", (request) => {
    if (request.url().includes("/api/catalog/product-options")) {
      requestStartedAt.set(request, performance.now());
    }
  });
  page.on("response", async (response) => {
    if (!response.url().includes("/api/catalog/product-options")) return;
    const request = response.request();
    optionRequests.push({
      url: response.url(),
      durationMs: Math.round(performance.now() - (requestStartedAt.get(request) || performance.now())),
      status: response.status(),
      cacheControl: response.headers()["cache-control"] || null,
      vercelCache: response.headers()["x-vercel-cache"] || null,
      age: response.headers().age || null,
    });
  });

  const navigationStartedAt = performance.now();
  await page.goto(appUrl(`/${store.slug}`), { waitUntil: "domcontentloaded" });
  const catalogReadyMs = Math.round(performance.now() - navigationStartedAt);
  const productReady = await page.locator(".catalog-product").first().waitFor()
    .then(() => true)
    .catch(() => false);
  if (!productReady) {
    const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 500);
    await page.screenshot({ path: resolve(outputDir, `${store.slug}-catalog-unavailable.png`) });
    await context.close();
    return {
      store: store.slug,
      product: null,
      apiProduct: product?.name || null,
      catalogReadyMs,
      firstProductReadyMs: null,
      dialogReadyMs: null,
      dialogLabel: null,
      optionRequests,
      browserErrors,
      bodyText,
      unavailableCatalog: true,
    };
  }
  const firstProductReadyMs = Math.round(performance.now() - navigationStartedAt);

  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("vendeplus_cart_")) localStorage.removeItem(key);
    }
  });
  const cards = page.locator(".catalog-product");
  let openedProduct = "";
  let clickStartedAt = 0;
  let dialog = page.locator('[role="dialog"]:visible').last();
  for (let index = 0; index < await cards.count(); index += 1) {
    const card = cards.nth(index);
    const button = card.locator(".catalog-add");
    if (!await button.count() || await button.isDisabled().catch(() => true)) continue;
    await card.scrollIntoViewIfNeeded();
    const variant = card.locator("select");
    if (await variant.count()) {
      const value = await variant.locator("option:not([disabled])").evaluateAll(
        (options) => options.map((option) => option.value).find(Boolean) || "",
      );
      if (value) await variant.selectOption(value);
    }
    clickStartedAt = performance.now();
    await button.click({ force: true });
    if (await dialog.waitFor({ timeout: 4_000 }).then(() => true).catch(() => false)) {
      openedProduct = (await card.locator("h3").first().textContent().catch(() => ""))?.trim() || `producto-${index + 1}`;
      break;
    }
  }
  if (!openedProduct) {
    await context.close();
    return {
      store: store.slug,
      product: null,
      apiProduct: product?.name || null,
      catalogReadyMs,
      firstProductReadyMs,
      dialogReadyMs: null,
      dialogLabel: null,
      optionRequests,
      unavailableAtAuditTime: true,
    };
  }
  let label = await dialog.getAttribute("aria-label");
  if (label?.startsWith("Presentaciones")) {
    const choices = dialog.locator("button").filter({ hasNot: page.locator('[aria-label="Cerrar"]') });
    await choices.first().click();
    dialog = page.locator('[role="dialog"]:visible').last();
    await dialog.waitFor();
    label = await dialog.getAttribute("aria-label");
  }
  const dialogReadyMs = Math.round(performance.now() - clickStartedAt);
  await page.screenshot({ path: resolve(outputDir, `${store.slug}-extras.png`) });
  await context.close();
  return {
    store: store.slug,
    product: openedProduct,
    apiProduct: product?.name || null,
    catalogReadyMs,
    firstProductReadyMs,
    dialogReadyMs,
    dialogLabel: label,
    optionRequests,
  };
}

async function createPanelSession(storeId) {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  userId = created.user.id;
  const { error: membershipError } = await admin.from("store_users").insert({
    store_id: storeId,
    user_id: userId,
    role: "owner",
  });
  if (membershipError) throw membershipError;
  const { data: signedIn, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
  if (signInError || !signedIn.session) throw signInError || new Error("No se creo la sesion temporal.");
  return signedIn.session.access_token;
}

const report = {
  baseUrl,
  generatedAt: new Date().toISOString(),
  public: [],
  browser: [],
  panel: [],
};

try {
  const { data: stores, error: storesError } = await admin
    .from("stores")
    .select("id, slug, name, is_active, is_test")
    .in("slug", [...storeSlugs, panelStoreSlug]);
  if (storesError) throw storesError;

  if (!skipPublic) {
    browser = await chromium.launch({ headless: true });
    for (const slug of storeSlugs) {
      const store = stores.find((entry) => entry.slug === slug);
      assert.ok(store?.is_active, `No se encontro activo ${slug}.`);
      const product = await findOptionProduct(store.id);
      report.public.push(await measureFetch(`${slug}:catalogo`, appUrl(`/${slug}`), {}, 2));
      if (product) {
        const optionUrl = appUrl(`/api/catalog/product-options?storeSlug=${encodeURIComponent(slug)}&productId=${encodeURIComponent(product.id)}`);
        report.public.push(await measureFetch(`${slug}:extras:${product.name}`, optionUrl, {}, 3));
      }
      report.browser.push(await measureBrowserCustomization(store, product));
    }
  }

  const panelStore = stores.find((entry) => entry.slug === panelStoreSlug);
  if (!skipPanel) {
    assert.ok(panelStore?.is_test, "El comercio del panel debe existir y estar marcado como prueba.");
    const token = await createPanelSession(panelStore.id);
    const headers = {
      Authorization: `Bearer ${token}`,
      "X-Panel-Store-Id": panelStore.id,
    };
    report.panel.push(await measureFetch(
    "panel:pedidos-compactos",
    appUrl(`/api/panel/orders?storeId=${panelStore.id}&compact=true&limit=40&offset=0`),
    { headers },
    4,
    ));
    const { data: recentOrder, error: recentOrderError } = await admin
      .from("orders")
      .select("id")
      .eq("store_id", panelStore.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentOrderError) throw recentOrderError;
    if (recentOrder?.id) {
      report.panel.push(await measureFetch(
        "panel:detalle-pedido",
        appUrl(`/api/panel/orders?orderId=${encodeURIComponent(recentOrder.id)}`),
        { headers },
        3,
      ));
    }
    report.panel.push(await measureFetch(
      "panel:productos",
      appUrl("/api/panel/products?limit=120&offset=0"),
      { headers },
      4,
    ));
  }
} finally {
  if (browser) await browser.close();
  await authClient.auth.signOut();
  if (userId) {
    await admin.from("store_users").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    const { count, error } = await admin
      .from("store_users")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw error;
    assert.equal(count, 0, "No se limpio el acceso temporal de performance.");
  }
}

writeFileSync(resolve(outputDir, "results.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
