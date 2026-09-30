import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.SOMOS_QA_BASE_URL;
if (!base || !/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/.test(base)) throw new Error("Set an exact project preview URL");
const output = "tmp/mobile-cloud/navigation";
await mkdir(output, { recursive: true });
const results = [];
const errors = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
// No real orders, login attempts or writes, including requests outside the app origin.
await context.route("**/*", (route) => ["GET", "HEAD"].includes(route.request().method()) ? route.continue() : route.fulfill({ status: 503, json: { error: "Read-only QA" } }));
await context.addInitScript(() => {
  window.Capacitor = { isNativePlatform: () => true };
  if (!localStorage.getItem("somos_mobile_v1_market_city")) localStorage.setItem("somos_mobile_v1_market_city", JSON.stringify({ mode: "manual", city: "Todas", updatedAt: Date.now() }));
  if (!localStorage.getItem("somos-marketplace-preferences-v1")) localStorage.setItem("somos-marketplace-preferences-v1", JSON.stringify({ city: "Todas", view: "home", cityConfirmed: true }));
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.on("pageerror", (error) => errors.push(error.message));
async function check(name, run) {
  try { await run(); results.push({ name, pass: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, pass: false, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); await page.screenshot({ path: `${output}/failure-${results.length}.png` }).catch(() => {}); }
}
try {
  await check("HTTPS opens without Vercel login and native home stays in preview", async () => {
    const response = await page.goto(base, { waitUntil: "domcontentloaded" });
    assert.equal(response.status(), 200);
    await page.waitForURL(`${base}/marketplace`);
    await page.getByRole("navigation", { name: "Comprar", exact: true }).waitFor();
    await page.waitForFunction(() => [...document.images].filter((image) => image.getClientRects().length && image.naturalWidth > 0).length >= 3);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${output}/marketplace.png` });
  });
  await check("Buyer profile closes with native Back and survives reload", async () => {
    await page.getByRole("button", { name: "Mis datos", exact: true }).click();
    await page.getByLabel("Nombre", { exact: true }).fill("QA Preview");
    await page.getByLabel("Telefono", { exact: true }).fill("04120000000");
    await page.getByRole("button", { name: "Guardar datos" }).click();
    await page.getByRole("status").filter({ hasText: "Datos guardados" }).waitFor();
    assert.equal(await page.evaluate(() => window.somosNativeBack()), true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Mis datos", exact: true }).click();
    assert.equal(await page.getByLabel("Nombre", { exact: true }).inputValue(), "QA Preview");
    await page.getByRole("button", { name: "Cerrar mis datos" }).click();
  });
  await check("Offline status recovers without losing buyer navigation", async () => {
    await context.setOffline(true);
    await page.getByRole("status").filter({ hasText: "Sin conexion" }).waitFor();
    await context.setOffline(false);
    await page.getByRole("status").filter({ hasText: "Sin conexion" }).waitFor({ state: "hidden" });
    await page.getByRole("navigation", { name: "Comprar", exact: true }).waitFor();
  });
  await check("Test catalog and cart remain on the preview origin", async () => {
    const response = await page.goto(`${base}/smash`, { waitUntil: "domcontentloaded" });
    assert.equal(response.status(), 200);
    await page.getByRole("navigation", { name: "Comprar", exact: true }).waitFor();
    await page.goto(`${base}/smash/carrito`, { waitUntil: "domcontentloaded" });
    assert.equal(new URL(page.url()).origin, base);
    assert.equal(context.pages().length, 1);
    await page.screenshot({ path: `${output}/cart.png` });
  });
  await check("Business login remains internal without exposing a private panel", async () => {
    await page.goto(`${base}/marketplace`, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "Ingresar a mi negocio", exact: true }).click();
    await page.waitForURL(`${base}/panel/login`);
    await page.locator('input[type="email"]').waitFor();
    await page.locator('input[type="password"]').waitFor();
    assert.equal(context.pages().length, 1);
    await page.screenshot({ path: `${output}/login.png` });
  });
  await check("Private APIs reject anonymous requests on the public preview", async () => {
    for (const path of ["/api/panel/context", "/api/panel/orders", "/api/panel/products", "/api/panel/printing/settings", "/api/admin/stores"]) {
      const response = await context.request.get(`${base}${path}`);
      assert.equal(response.status(), 401, path);
      assert.match(response.headers()["content-type"], /application\/json/);
    }
  });
  await check("Browser presentation stays unchanged on mobile and desktop", async () => {
    for (const width of [390, 1366]) {
      const web = await browser.newPage({ viewport: { width, height: 900 } });
      await web.route("**/*", (route) => ["GET", "HEAD"].includes(route.request().method()) ? route.continue() : route.abort());
      await web.goto(`${base}/marketplace`, { waitUntil: "domcontentloaded" });
      assert.equal(await web.locator(".native-buyer-nav").count(), 0);
      await web.screenshot({ path: `${output}/browser-${width}.png` });
      await web.close();
    }
  });
  results.push({ name: "No React errors", pass: errors.length === 0, errors });
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ base, results }, null, 2));
}
if (results.some((result) => !result.pass)) process.exitCode = 1;
