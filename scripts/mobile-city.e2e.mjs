import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { parseEnv } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const base = process.env.SOMOS_QA_BASE_URL || "http://127.0.0.1:3107";
if (base !== "http://127.0.0.1:3107" && !/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/.test(base)) throw new Error("QA requires local or exact project preview URL");
const output = base.startsWith("https:") ? "tmp/mobile-cloud/city" : "tmp/mobile-city";
await mkdir(output, { recursive: true });
const env = parseEnv(await readFile("../.env.local", "utf8"));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
// Read-only public store metadata supplies realistic fixtures. No customer location is used.
const { data: stores, error } = await db.from("stores").select("slug,latitude,longitude,city:service_cities(slug,name)").eq("is_active", true).eq("marketplace_visible", true).eq("is_test", false);
if (error) throw error;
const target = stores.find((store) => store.city?.slug === "maracay" && Number(store.latitude) > 0 && Number(store.longitude) < 0);
const other = stores.find((store) => store.city?.slug && store.city.slug !== target?.city.slug);
assert.ok(target && other, "Need two public cities with a geolocated Maracay store");
const browser = await chromium.launch({ headless: true });
const results = [];
const contexts = [];
const errors = [];
async function pageFor({ native = true, outcome = "success", preference = null, blockedStorage = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  contexts.push(context);
  await context.route("**/api/**", (route) => ["GET", "HEAD"].includes(route.request().method()) ? route.continue() : route.fulfill({ status: 503, json: { error: "QA read-only" } }));
  await context.addInitScript(({ native, outcome, preference, latitude, longitude, blockedStorage }) => {
    window.qaRequiredPickerSeen = false;
    new MutationObserver(() => {
      if (document.querySelector('.market-city-overlay[data-required="true"]')) window.qaRequiredPickerSeen = true;
    }).observe(document, { childList: true, subtree: true });
    if (native) window.Capacitor = { isNativePlatform: () => true };
    if (preference && !localStorage.getItem("somos_mobile_v1_market_city")) localStorage.setItem("somos_mobile_v1_market_city", JSON.stringify(preference));
    if (blockedStorage) {
      const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
      const blocked = key => key.includes('marketplace') || key.includes('market_city');
      Storage.prototype.getItem = function(key) { if (blocked(key)) throw new Error('Storage disabled'); return get.call(this, key); };
      Storage.prototype.setItem = function(key, value) { if (blocked(key)) throw new Error('Storage disabled'); return set.call(this, key, value); };
    }
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      getCurrentPosition(success, failure) {
        sessionStorage.setItem("qa-location-calls", String(Number(sessionStorage.getItem("qa-location-calls") || 0) + 1));
        const deliver = () => ['denied', 'unavailable', 'timeout'].includes(outcome) ? failure({ code: { denied: 1, unavailable: 2, timeout: 3 }[outcome], PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2 }) : success({ coords: { latitude: outcome === "remote" ? 40 : latitude, longitude: outcome === "remote" ? -3 : longitude, accuracy: 100 } });
        if (outcome === "delayed") window.qaDeliverLocation = deliver;
        else setTimeout(deliver, 0);
      },
    } });
  }, { native, outcome, preference, latitude: Number(target.latitude), longitude: Number(target.longitude), blockedStorage });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  return page;
}
async function check(name, run) {
  try { await run(); results.push({ name, pass: true }); console.log(`PASS ${name}`); }
  catch (error) {
    const page = contexts.at(-1)?.pages()[0];
    const diagnostic = await page?.evaluate(() => ({ calls: sessionStorage.getItem("qa-location-calls"), preference: localStorage.getItem("somos_mobile_v1_market_city"), dialogs: [...document.querySelectorAll('[role="dialog"]')].map((node) => node.textContent) })).catch(() => null);
    results.push({ name, pass: false, error: error.message, diagnostic });
    console.log(`FAIL ${name}: ${error.message}; ${JSON.stringify(diagnostic)}`);
    await page?.screenshot({ path: `${output}/failure-${results.length}.png` }).catch(() => {});
  }
}
const preference = (mode, city) => ({ mode, city, updatedAt: Date.now() });
const cityButton = (page, name) => page.getByRole("button", { name, exact: true }).filter({ visible: true });
try {
  for (const native of [false, true]) await check(`${native ? 'Native' : 'Web'}: city before catalog, GPS only after choosing it`, async () => {
    const page = await pageFor({ native });
    await page.goto(`${base}/marketplace`, { waitUntil: "domcontentloaded" });
    const dialog = page.getByRole('dialog', { name: 'Elige tu ciudad' });
    await dialog.waitFor();
    assert.equal(await page.locator('.market-product-card').count(), 0);
    assert.equal(await dialog.getByRole('button', { name: 'Cerrar', exact: true }).count(), 0);
    assert.equal(await dialog.getByRole('button', { name: 'Todas las ciudades', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('qa-location-calls')), null);
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(), true);
    await page.keyboard.press('Tab');
    assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true);
    for (const width of [320, 390, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => [...document.querySelectorAll('.market-city-picker img')].every(image => image.complete && image.naturalWidth > 0));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `${output}/entry-${native ? 'native' : 'web'}-${width}.png` });
    }
    await dialog.getByRole('button', { name: 'Usar mi ubicacion', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await cityButton(page, target.city.name).waitFor();
    await page.getByRole("heading", { name: "Todos los comercios", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem("qa-location-calls")), "1");
    const links = await page.locator('a[href]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
    assert.ok(stores.some((store) => store.city?.slug === target.city.slug && links.includes(`/${store.slug}`)));
    assert.equal(stores.some((store) => store.city?.slug !== target.city.slug && links.includes(`/${store.slug}`)), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.equal(await page.evaluate(() => localStorage.getItem("somos-marketplace-location-v1")), null);
    await page.screenshot({ path: `${output}/auto-city.png` });
    await page.reload({ waitUntil: "domcontentloaded" });
    await cityButton(page, target.city.name).waitFor();
    assert.equal(await page.evaluate(() => window.qaRequiredPickerSeen), false, 'Saved city must not flash the initial chooser');
    assert.equal(await page.evaluate(() => sessionStorage.getItem("qa-location-calls")), "1");
  });
  await check("Manual choice wins over an in-flight location and survives reload", async () => {
    const page = await pageFor({ outcome: "delayed" });
    await page.goto(`${base}/marketplace`, { waitUntil: "domcontentloaded" });
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Usar mi ubicacion', exact: true }).click();
    await page.waitForFunction(() => typeof window.qaDeliverLocation === "function");
    const choices = await dialog.locator('.market-city-choices button').allTextContents();
    const manualCity = choices.find((name) => name.trim() && name !== target.city.name);
    assert.ok(manualCity, "Need another available city in the displayed catalog");
    await dialog.getByRole("button", { name: manualCity, exact: true }).click();
    await page.evaluate(() => window.qaDeliverLocation());
    await cityButton(page, manualCity).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await cityButton(page, manualCity).waitFor();
    assert.equal(await page.evaluate(() => window.qaRequiredPickerSeen), false);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("qa-location-calls")), "1");
  });
  for (const outcome of ["denied", "remote", "unavailable", "timeout"]) await check(`${outcome}: choose city, never repeatedly request permission or invent city`, async () => {
    const page = await pageFor({ outcome });
    await page.goto(`${base}/marketplace`, { waitUntil: "domcontentloaded" });
    await page.getByRole("dialog", { name: "Elige tu ciudad" }).waitFor();
    await page.getByRole('button', { name: 'Usar mi ubicacion', exact: true }).click();
    await page.locator('.market-city-message').waitFor();
    assert.equal(await page.locator('.market-product-card').count(), 0);
    await page.screenshot({ path: `${output}/${outcome}.png` });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("dialog", { name: "Elige tu ciudad" }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem("qa-location-calls")), "1");
    await page.getByRole('dialog').getByRole('button', { name: target.city.name, exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  });
  await check("Old all-cities default requires a city; explicit all-cities choice remains available afterwards", async () => {
    const page = await pageFor({ preference: preference("manual", "Todas") });
    await page.goto(`${base}/marketplace`);
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem("qa-location-calls")), null);
    await page.getByRole('dialog').getByRole('button', { name: target.city.name, exact: true }).click();
    await cityButton(page, target.city.name).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Todas las ciudades', exact: true }).click();
    await page.reload();
    await page.locator('.market-directory-toolbar').waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
    await cityButton(page, 'Todas las ciudades').waitFor();
  });
  await check("Web and partner marketplace never request location automatically", async () => {
    for (const entry of [{ native: false, path: "/marketplace" }, { native: true, path: "/transporte/entrega2/marketplace" }]) {
      const page = await pageFor({ native: entry.native });
      await page.goto(`${base}${entry.path}`);
      await page.getByRole('dialog', { name: 'Elige tu ciudad' }).waitFor();
      assert.equal(await page.evaluate(() => sessionStorage.getItem("qa-location-calls")), null);
    }
  });
  await check('Blocked storage still permits manual city selection', async () => {
    const page = await pageFor({ native: false, blockedStorage: true });
    await page.goto(`${base}/marketplace`);
    await page.getByRole('dialog').getByRole('button', { name: target.city.name, exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await cityButton(page, target.city.name).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('qa-location-calls')), null);
  });
  await check('SSR waits for saved city without flashing chooser or unfiltered catalog', async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto(`${base}/marketplace`);
    await page.locator('.market-city-loading').waitFor();
    assert.equal(await page.getByRole('dialog', { name: 'Elige tu ciudad' }).count(), 0);
    assert.equal(await page.locator('.market-product-card').count(), 0);
  });
  results.push({ name: "No React runtime errors", pass: errors.length === 0, errors });
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
}
if (results.some((result) => !result.pass)) process.exitCode = 1;
