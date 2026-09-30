import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = "http://127.0.0.1:3107", output = "tmp/buyer-marketplace";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [], errors = [];
const readonly = route => ["GET", "HEAD"].includes(route.request().method()) ? route.continue() : route.abort();
const user = { id: "10000000-0000-4000-8000-000000000001", email: "comprador@example.test", app_metadata: { providers: ["google"] }, user_metadata: {}, aud: "authenticated", created_at: "2026-09-29T12:00:00Z" };
const token = [Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"), "mock-signature"].join(".");
const session = { access_token: token, refresh_token: "test-only-not-real", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user };
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile-loaded, .leaflet-popup')].every(element => getComputedStyle(element).opacity === '1'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: horizontal overflow`);
  await page.screenshot({ path: `${output}/${name}.png` });
  results.push({ name, pass: true }); console.log(`PASS ${name}`);
}
try {
  const context = await browser.newContext();
  await context.addInitScript(() => localStorage.setItem('somos-marketplace-preferences-v1', JSON.stringify({ city: 'Todas', view: 'home', cityConfirmed: true })));
  await context.route("**/*", readonly);
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.stack || error.message));
  await page.goto(`${base}/marketplace`);
  await page.locator('.market-directory-toolbar').waitFor();
  assert.equal(await page.getByLabel('Empresa de delivery', { exact: true }).count(), 0);
  for (const width of [320, 390, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("button", { name: "Mapa", exact: true }).click();
    assert.equal(await page.getByLabel('Empresa de delivery en el mapa').count(), 0);
    await page.locator(".market-map-marker").first().waitFor();
    const pin = await page.locator('.market-map-pin').first().boundingBox();
    assert.equal(Math.round(pin.width), 44);
    assert.equal(Math.round(pin.height), 56);
    assert.equal(Math.round((await page.locator('.market-map-pin .market-map-logo').first().boundingBox()).width), 40);
    assert.equal(await page.locator('.market-map-pin').first().evaluate(element => getComputedStyle(element, '::after').borderTopWidth), '18px');
    assert.equal(await page.locator('.market-map-logo img[style]').count(), 0);
    await page.waitForFunction(() => [...document.querySelectorAll('.market-map-logo img')].some(image => image.complete && image.naturalWidth > 0));
    await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile')].some(image => image.complete && image.naturalWidth > 0));
    await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile, .market-map-logo img')].every(image => image.complete));
    const canvas = await page.locator('.market-map-canvas').boundingBox();
    assert.ok(canvas.width > width - 20 && canvas.height > 400);
    await capture(page, `map-${width}`);
    if (width === 390 && await page.locator('.market-map-cluster').count()) {
      const zoomBefore = new URL(await page.locator('.leaflet-tile').first().getAttribute('src')).pathname.split('/')[1];
      await page.locator('.market-map-cluster').first().click();
      await page.waitForFunction(zoom => [...document.querySelectorAll('.leaflet-tile')].some(image => new URL(image.src).pathname.split('/')[1] !== zoom), zoomBefore);
      await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile, .market-map-logo img')].every(image => image.complete));
      await capture(page, 'map-cluster-expanded');
      await page.locator('.market-map-marker:not(.market-map-cluster)').first().click();
      await page.locator('.market-map-popup a').waitFor();
      assert.ok((await page.locator('.market-map-popup a').getAttribute('href')).startsWith('/'));
      assert.equal(await page.locator('.market-map-popup .market-map-pin').count(), 0);
      await capture(page, 'map-store-popup');
    }
    await page.locator('.leaflet-control-zoom-in').click();
    await page.getByRole("button", { name: "Cerrar mapa", exact: true }).click();
  }
  await page.getByRole('button', { name: 'Mapa', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog', { name: 'Mapa del Marketplace' }).count(), 0);
  await page.goto(`${base}/mi-cuenta`);
  await page.getByRole('button', { name: 'Continuar con Google' }).waitFor();
  await capture(page, 'account-guest');
  await page.close(); await context.close();

  const buyer = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await buyer.route('**/*', readonly);
  await buyer.addInitScript(value => {
    localStorage.setItem('somos_buyer_auth_v1', JSON.stringify(value));
    window.Capacitor = { isNativePlatform: () => true, Plugins: { SomosBuyerAuth: {
      consume: async () => ({}), getRedirectUrl: async () => ({ url: 'com.somosve.app.staging://buyer-auth' }), open: async ({ url }) => { window.__buyerOAuthURL = url; },
    } } };
  }, session);
  const completed = { id: "30000000-0000-4000-8000-000000000001", public_code: "SO-0929-000001", status: "completed", created_at: "2026-09-29T12:00:00Z", total_usd: 12.5, delivery_type: "pickup", rating: null, stores: { name: "Comercio de prueba", slug: "smash" }, order_items: [{ product_name: "Producto de prueba con nombre largo", quantity: 2, total_usd: 12.5, variant_name: "Grande", order_item_options: [{ option_name: "Extra queso" }] }] };
  let reviewRequests = 0, historyError = false;
  await buyer.route('**/api/buyer/orders?*', route => {
    assert.equal(route.request().headers().authorization, `Bearer ${token}`);
    const page = new URL(route.request().url()).searchParams.get('page');
    return route.fulfill(historyError ? { status: 503, json: { error: 'Historial no disponible temporalmente.' } } : { status: 200, json: { orders: page === '1' ? [] : [completed, { ...completed, id: "30000000-0000-4000-8000-000000000002", public_code: "SO-0929-000002", status: "received" }], hasMore: page === '0' } });
  });
  await buyer.route('**/api/buyer/reviews', route => {
    reviewRequests++;
    assert.deepEqual(route.request().postDataJSON(), { orderId: completed.id, rating: 4, observation: "" });
    return route.fulfill({ status: 200, json: { ok: true } });
  });
  await buyer.route('**/auth/v1/logout*', route => route.fulfill({ status: 204, body: '' }));
  const account = await buyer.newPage(); account.on('pageerror', error => errors.push(error.message));
  await account.goto(`${base}/mi-cuenta`);
  await account.getByText(completed.public_code, { exact: true }).waitFor();
  assert.equal(await account.locator('.buyer-rating').count(), 1);
  for (const width of [320, 390, 1366]) { await account.setViewportSize({ width, height: 844 }); await capture(account, `history-${width}`); }
  await account.getByRole('radio', { name: '4 estrellas', exact: true }).check();
  await account.getByRole('button', { name: 'Guardar calificacion' }).click();
  await account.getByText('Calificacion guardada.', { exact: true }).waitFor(); assert.equal(reviewRequests, 1);
  await capture(account, 'rating-saved');
  await account.getByRole('button', { name: 'Pagina siguiente' }).click();
  await account.getByText('Aun no tienes pedidos en esta cuenta', { exact: true }).waitFor();
  await account.getByRole('button', { name: 'Pagina anterior' }).click();
  await account.getByText(completed.public_code, { exact: true }).waitFor();
  historyError = true;
  await account.getByRole('button', { name: 'Actualizar pedidos' }).click();
  await account.getByRole('alert').filter({ hasText: 'Historial no disponible' }).waitFor();
  historyError = false;
  await account.getByRole('button', { name: 'Actualizar pedidos' }).click();
  await account.locator('.buyer-error').waitFor({ state: 'hidden' });
  await account.getByRole('button', { name: 'Salir', exact: true }).click();
  await account.getByRole('button', { name: 'Continuar con Google' }).waitFor();
  assert.equal(await account.locator('.buyer-order').count(), 0);
  await capture(account, 'signed-out');
  await account.getByRole('button', { name: 'Continuar con Google' }).click();
  await account.waitForFunction(() => Boolean(window.__buyerOAuthURL));
  const oauth = new URL(await account.evaluate(() => window.__buyerOAuthURL));
  assert.equal(oauth.protocol, 'https:');
  assert.equal(oauth.searchParams.get('provider'), 'google');
  assert.equal(oauth.searchParams.get('redirect_to'), 'com.somosve.app.staging://buyer-auth');
  assert.ok(oauth.searchParams.get('code_challenge'));
  assert.equal(oauth.searchParams.get('code_challenge_method'), 's256');
  results.push({ name: 'native-google-pkce-request-mocked', pass: true });
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ results, errors }, null, 2));
}
