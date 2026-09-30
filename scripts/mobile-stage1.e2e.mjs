import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createHmac } from "node:crypto";

const base = "http://127.0.0.1:3107";
const output = "tmp/mobile-stage1";
await mkdir(output, { recursive: true });
const results = [];
const browser = await chromium.launch({ headless: true });
const nativeContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await nativeContext.addInitScript(() => {
  window.Capacitor = { isNativePlatform: () => true };
  if (!localStorage.getItem("somos_mobile_v1_market_city")) localStorage.setItem("somos_mobile_v1_market_city", JSON.stringify({ mode: "manual", city: "Todas", updatedAt: Date.now() }));
  if (!localStorage.getItem("somos-marketplace-preferences-v1")) localStorage.setItem("somos-marketplace-preferences-v1", JSON.stringify({ city: "Todas", view: "home", cityConfirmed: true }));
});
// All mutations are intercepted. These tests cannot create real orders or change a store.
await nativeContext.route("**/api/**", async (route) => {
  if (!["GET", "HEAD"].includes(route.request().method())) return route.fulfill({ status: 503, json: { error: "Simulacion local" } });
  return route.continue();
});
const page = await nativeContext.newPage();
page.setDefaultTimeout(18000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function check(name, run) {
  try { await run(); results.push({ name, pass: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, pass: false, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); await page.screenshot({ path: `${output}/failure-${results.length}.png` }).catch(() => {}); }
}

try {
  await check("Visitante entra al Marketplace sin bienvenida y con una sola barra", async () => {
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/marketplace");
    await page.locator('nav[aria-label="Comprar"]').waitFor();
    assert.equal(await page.locator('nav[aria-label="Navegación del Marketplace"]').isVisible(), false);
    assert.equal(await page.getByText("Ingresar a mi negocio", { exact: true }).isVisible(), true);
    await page.locator("input").first().waitFor();
    await page.screenshot({ path: `${output}/buyer-mobile.png` });
  });
  await check("Mis datos es local y Atrás cierra la capa sin salir", async () => {
    await page.getByRole("button", { name: "Mis datos", exact: true }).click();
    await page.getByLabel("Nombre", { exact: true }).fill("Prueba local");
    await page.getByLabel("Telefono", { exact: true }).fill("04120000000");
    await page.getByRole("button", { name: "Guardar datos" }).click();
    assert.match(await page.getByRole("dialog").innerText(), /No son una cuenta verificada/);
    assert.equal(await page.evaluate(() => window.somosNativeBack()), true);
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => window.somosNativeBack()), false);
  });
  await check("Buscar reutiliza el buscador y recupera el filtro", async () => {
    await page.getByRole("button", { name: "Buscar", exact: true }).last().click();
    const input = page.locator("input").first();
    await input.fill("smash");
    await page.reload();
    await page.waitForFunction(() => document.querySelector("input")?.value === "smash");
    await input.fill("");
  });
  await check("Espacio para teclado simulado y pantallas pequenas sin desbordamiento", async () => {
    await page.locator("input").first().focus();
    await page.setViewportSize({ width: 390, height: 500 });
    await page.locator(".native-buyer-nav").waitFor({ state: "hidden" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(".native-buyer-nav").waitFor({ state: "visible" });
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    }
    await page.screenshot({ path: `${output}/buyer-mobile.png` });
  });
  await check("Carrito persiste al recargar y aparece en el inicio", async () => {
    await page.evaluate(() => { localStorage.setItem("vendeplus_cart_smash", JSON.stringify([{ productId: "qa", productName: "Prueba", quantity: 2, unitPriceUsd: 1, selectedOptions: [] }])); window.dispatchEvent(new Event("vendeplus-cart-change")); });
    await page.locator('.native-carts a[href="/smash/carrito"]').waitFor();
    await page.reload();
    await page.locator('.native-carts a[href="/smash/carrito"]').waitFor();
  });
  await check("Borrador vuelve tras recarga sin referencia ni comprobante", async () => {
    await page.goto(`${base}/smash/checkout`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("somos_mobile_v1_checkout_smash") || "{}").key);
    const name = page.getByPlaceholder("Ej: Ana Rodríguez");
    await name.fill("Cliente Borrador");
    await page.getByPlaceholder("Ej: 0412-0000000").fill("04129999999");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("somos_mobile_v1_checkout_smash") || "{}").form?.customerName === "Cliente Borrador");
    const original = await page.evaluate(() => JSON.parse(localStorage.getItem("somos_mobile_v1_checkout_smash")));
    assert.equal("paymentReceiptToken" in original.form, false);
    await page.reload();
    await page.waitForTimeout(1000);
    await page.waitForFunction(() => document.querySelector('input[placeholder="Ej: Ana Rodríguez"]')?.value === "Cliente Borrador");
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("somos_mobile_v1_checkout_smash")));
    assert.equal(original.key, restored.key);
    await page.screenshot({ path: `${output}/checkout-mobile.png` });
  });
  await check("Desconexion muestra estado claro y conserva carrito", async () => {
    await nativeContext.setOffline(true);
    await page.getByText("Sin conexion. No se enviaran pedidos.").waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("vendeplus_cart_smash"))[0].quantity), 2);
    await nativeContext.setOffline(false);
    await page.getByText("Sin conexion. No se enviaran pedidos.").waitFor({ state: "hidden" });
  });
  await check("Confirmacion simulada vacia carrito y borrador, doble toque y regreso no reenvian", async () => {
    let orderRequests = 0;
    await nativeContext.route("**/api/orders", async (route) => {
      orderRequests += 1;
      const data = route.request().postDataJSON();
      assert.match(data.idempotencyKey, /^[0-9a-f-]{36}$/i);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({ json: { orderId: "qa-only", order: { ...data.order, databaseId: "qa-only", quote: { ...data.order.quote, quoteToken: "qa-never-persist" } } } });
    });
    await nativeContext.route("**/api/table-orders/**", (route) => route.fulfill({ json: { order: { status: "completed", payment_status: "paid" } } }));
    await page.evaluate(() => sessionStorage.setItem("somos_table_order_v1_smash", JSON.stringify({ storeToken: "qa-only-not-a-real-token", tableId: "qa-table", tableName: "Prueba local", tableZone: null, paymentMethods: ["Efectivo"], fulfillmentMode: "table_service" })));
    await page.reload({ waitUntil: "domcontentloaded" });
    const button = page.getByRole("button", { name: "Confirmar pedido", exact: true });
    await button.waitFor();
    const payment = page.locator("select").filter({ has: page.locator('option[value="Efectivo"]') });
    await payment.selectOption("Efectivo");
    await page.getByText(/Paga en caja antes de la/).waitFor();
    assert.equal(await button.isEnabled(), true, "Comercio de pruebas debe estar abierto");
    await button.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await button.evaluate((element) => { element.click(); element.click(); });
    try { await page.waitForURL("**/smash/confirmacion", { waitUntil: "domcontentloaded" }); }
    catch (error) { throw new Error(`${error.message}; requests=${orderRequests}; errors=${await page.locator('p.text-red-700').allTextContents()}`); }
    await page.getByRole("heading", { name: "Pedido enviado" }).waitFor();
    assert.equal(orderRequests, 1);
    const state = await page.evaluate(() => ({ cart: JSON.parse(localStorage.getItem("vendeplus_cart_smash")), draft: localStorage.getItem("somos_mobile_v1_checkout_smash"), last: JSON.parse(localStorage.getItem("vendeplus_last_order_smash")) }));
    assert.deepEqual(state.cart, []);
    assert.equal(state.draft, null);
    assert.equal(state.last.form.paymentReceiptToken, "");
    assert.equal(state.last.tableOrder.storeToken, "");
    assert.equal(state.last.quote.quoteToken, undefined);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.goto(`${base}/smash/checkout`, { waitUntil: "domcontentloaded" });
    assert.equal(orderRequests, 1);
    assert.equal(await page.evaluate(() => localStorage.getItem("somos_mobile_v1_checkout_smash")), null);
  });

  // A signed but nonexistent local session only passes the page middleware.
  // Every panel API is mocked; production would reject this nonexistent session.
  const env = parseEnv(await readFile("../.env.local", "utf8"));
  const secret = env.PANEL_SESSION_COOKIE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_JWT_SECRET;
  const payload = Buffer.from(JSON.stringify({ sid: "qa-not-a-real-session", secret: "qa", sub: "qa-A", email: "qa@example.invalid", exp: Math.floor(Date.now()/1000)+3600, founder: false })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  await nativeContext.addCookies([{ name: "somos_panel_session", value: `${payload}.${signature}`, url: base, httpOnly: true }]);
  let userId = "qa-A";
  let authorized = true;
  let unavailable = false;
  const stores = ["A", "B"].map((id) => ({ id, slug: `qa-${id.toLowerCase()}`, name: `Negocio ${id}`, subscription_status: "active", table_orders_access_enabled: true }));
  await nativeContext.route("**/api/panel/**", (route) => {
    if (unavailable) return route.fulfill({ status: 503, json: { error: "Prueba sin conexion" } });
    if (!authorized) return route.fulfill({ status: 401, json: { error: "Sesion finalizada" } });
    const storeId = route.request().headers()["x-panel-store-id"] || "A";
    return route.fulfill({ json: { userId, isFounderMode: false, stores, selectedStoreId: storeId, achievementFeatures: {}, achievements: [], orders: [], products: [], categories: [], announcements: [], page: { hasMore: false } } });
  });
  await page.evaluate(() => sessionStorage.setItem("vendeplus_panel_token", `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000)+3600 }))}.qa`));
  await check("Panel conserva selector, mesa y herramientas sin duplicar barras", async () => {
    await page.goto(`${base}/panel/productos`, { waitUntil: "domcontentloaded" });
    await page.getByRole("navigation", { name: "Mi negocio", exact: true }).waitFor();
    const tutorial = page.getByRole("button", { name: "Cerrar tutorial" });
    if (await tutorial.isVisible()) await tutorial.click();
    await page.getByLabel("Sede activa").filter({ visible: true }).selectOption("B");
    await page.waitForFunction(() => localStorage.getItem("somos_mobile_v1_private_store") === '"B"');
    await page.getByRole("button", { name: "Negocio", exact: true }).click();
    assert.equal(await page.getByRole("link", { name: "Impresión", exact: true }).filter({ visible: true }).count(), 1);
    assert.equal(await page.evaluate(() => window.somosNativeBack()), true);
    await page.getByRole("dialog", { name: "Mas opciones" }).waitFor({ state: "hidden" });
    await page.screenshot({ path: `${output}/business-mobile.png` });
  });
  await check("Comprar recuerda espacio y el arranque de comercio revalida la sede", async () => {
    const expires = Math.floor(Date.now()/1000)+3600;
    const session = { access_token: `e30.${Buffer.from(JSON.stringify({ sub: "qa-A", exp: expires })).toString("base64url")}.qa`, refresh_token: "qa-invalid", expires_at: expires, expires_in: 3600, token_type: "bearer", user: { id: "qa-A", email: "qa@example.invalid" } };
    const authKey = `sb-${new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
    await nativeContext.route("**/auth/v1/**", (route) => route.fulfill({ json: { user: session.user } }));
    await nativeContext.route("**/api/auth/panel-session", (route) => route.fulfill({ json: { ok: true } }));
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: authKey, value: session });
    await page.getByRole("link", { name: "Comprar", exact: true }).click();
    await page.waitForURL("**/marketplace");
    assert.equal(await page.evaluate(() => localStorage.getItem("somos_mobile_v1_space")), '"buy"');
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/marketplace");
    await page.evaluate(() => localStorage.setItem("somos_mobile_v1_space", '"business"'));
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/panel/productos");
    await page.getByRole("navigation", { name: "Mi negocio", exact: true }).waitFor();
    assert.equal(await page.getByLabel("Sede activa").filter({ visible: true }).inputValue(), "B");
  });
  await check("Revalidacion fallida tapa datos y conserva filtro al reconectar", async () => {
    const search = page.getByPlaceholder("Buscar producto...");
    await search.fill("Borrador filtro");
    unavailable = true;
    await page.evaluate(() => window.dispatchEvent(new Event("somos:resume")));
    await page.getByRole("button", { name: "Reintentar", exact: true }).waitFor();
    assert.equal(await search.isVisible(), false);
    unavailable = false;
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await search.waitFor({ state: "visible" });
    assert.equal(await search.inputValue(), "Borrador filtro");
  });
  await check("Cambio de cuenta elimina filtros privados anteriores", async () => {
    await page.evaluate(() => localStorage.setItem("somos_mobile_v1_private_qa-old-filter", '"secret-old"'));
    userId = "qa-B";
    await page.evaluate(() => window.dispatchEvent(new Event("somos:resume")));
    await page.waitForFunction(() => localStorage.getItem("somos_mobile_v1_account") === '"qa-B"');
    assert.equal(await page.evaluate(() => localStorage.getItem("somos_mobile_v1_private_qa-old-filter")), null);
  });
  await check("Sesion revocada oculta el panel y limpia preferencias privadas", async () => {
    authorized = false;
    await page.evaluate(() => window.dispatchEvent(new Event("somos:resume")));
    await page.getByRole("alert").filter({ hasText: "Inicia sesion" }).waitFor();
    assert.equal(await page.getByRole("navigation", { name: "Mi negocio", exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem("somos_mobile_v1_account")), null);
  });
  for (const width of [390, 1366]) await check(`Web sin Capacitor conserva su navegacion (${width}px)`, async () => {
    const web = await browser.newPage({ viewport: { width, height: 900 } });
    await web.goto(`${base}/marketplace`);
    await web.locator('.market-city-choices button').first().click();
    await web.getByRole('dialog', { name: 'Elige tu ciudad' }).waitFor({ state: 'hidden' });
    assert.equal(await web.locator(".native-buyer-nav").count(), 0);
    assert.equal(await web.locator('nav[aria-label="Navegación del Marketplace"]').isVisible(), width === 390);
    await web.screenshot({ path: `${output}/web-${width}.png` });
    await web.close();
  });
  results.push({ name: "Sin errores de React", pass: errors.length === 0, errors });
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
}
if (results.some((result) => !result.pass)) process.exitCode = 1;
