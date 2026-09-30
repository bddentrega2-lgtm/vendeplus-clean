import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createHmac } from "node:crypto";

const base = "http://127.0.0.1:3107";
const output = "tmp/mobile-polish";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const results = [];
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await context.addInitScript(() => {
  window.__alerts = [];
  window.__notificationPermission = false;
  window.Capacitor = { isNativePlatform: () => true, Plugins: { SomosOrderAlerts: {
    status: async () => ({ granted: window.__notificationPermission }),
    enable: async () => { window.__notificationPermission = true; return { granted: true }; },
    show: async value => { window.__alerts.push(value); },
    clear: async () => {}, settings: async () => {},
  } } };
  localStorage.setItem("somos_mobile_v1_market_city", JSON.stringify({ mode: "manual", city: "Todas", updatedAt: Date.now() }));
  if (!localStorage.getItem("somos-marketplace-preferences-v1")) localStorage.setItem("somos-marketplace-preferences-v1", JSON.stringify({ city: "Todas", view: "home", cityConfirmed: true }));
});
await context.route("**/api/**", route => ["GET", "HEAD"].includes(route.request().method()) ? route.continue() : route.fulfill({ status: 503, json: { error: "QA: escritura bloqueada" } }));
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(25000);
async function capture(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].filter(img => {
    const box = img.getBoundingClientRect();
    return img.checkVisibility() && box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0 && box.left < innerWidth && box.right > 0;
  }).every(img => img.complete)).catch(async error => {
    console.log(await page.evaluate(() => [...document.images].filter(img => !img.complete).map(img => ({ src: img.currentSrc, loading: img.loading, box: img.getBoundingClientRect().toJSON() }))));
    await page.screenshot({ path: `${output}/${name}-incomplete.png` });
    throw error;
  });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: overflow horizontal`);
  await page.screenshot({ path: `${output}/${name}.png` });
  results.push({ name, pass: true });
  console.log(`PASS ${name}`);
}
try {
  await page.goto(base);
  await page.waitForURL("**/marketplace");
  await page.locator(".native-brand").waitFor();
  await page.locator(".market-product-card img").first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.market-product-card img')].some(img => img.complete && img.naturalWidth > 0));
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await capture(`marketplace-${width}`);
    const product = await page.locator(".market-product-card").first().boundingBox();
    assert.ok(product.y + product.height < 770, "First product must fit above navigation");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.market-search-area > div:first-child > button').click();
  await page.getByRole('dialog').waitFor();
  await capture('city-picker');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('link', { name: 'Ingresar a mi negocio' }).click();
  await page.waitForURL('**/panel/login');
  await page.locator('.native-login-brand').waitFor();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await capture(`login-${width}`);
  }
  await page.getByPlaceholder('Tu contrase\u00f1a').fill('qa-local-only');
  await page.getByRole('button', { name: 'Mostrar contrase\u00f1a' }).click();
  assert.equal(await page.getByPlaceholder('Tu contrase\u00f1a').getAttribute('type'), 'text');
  await page.goto(`${base}/smash?vista=visual`);
  await page.locator('.catalog-product').first().waitFor();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await capture(`catalog-${width}`);
    assert.equal(await page.locator('.catalog-add').evaluateAll(buttons => buttons.every(button => parseFloat(getComputedStyle(button).fontSize) <= 12)), true, 'Catalog controls must keep compact typography');
    assert.equal(await page.locator('.catalog-product-actions').evaluateAll(rows => rows.every(row => {
      const price = row.querySelector('.catalog-product-price').getBoundingClientRect();
      const action = row.querySelector('.catalog-add').getBoundingClientRect();
      return price.right <= action.left && action.top < price.bottom && action.bottom > price.top && action.right <= row.getBoundingClientRect().right + 1;
    })), true, 'Visual catalog: prices and actions must not overlap');
    assert.equal(await page.locator('.catalog-product-visual .catalog-product-price > p.text-sm').evaluateAll(prices => prices.every(price => {
      const range = document.createRange(); range.selectNodeContents(price);
      return range.getClientRects().length === 1;
    })), true, 'Visual catalog: the USD amount must not break across lines');
  }
  await page.locator('.catalog-categories').scrollIntoViewIfNeeded();
  const categoryTop = await page.locator('.catalog-categories').boundingBox();
  assert.ok(categoryTop.y >= 63, 'Categories must stay below native header');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('.catalog-product-visual').last().scrollIntoViewIfNeeded();
    await capture(`catalog-grid-${width}`);
  }

  // Private screens use simulated data and a local-only proxy cookie. No real account is used.
  await page.goto(`${base}/marketplace`);
  await page.getByRole('button', { name: 'Promos', exact: true }).click();
  await page.getByRole('heading', { name: /Todas las ofertas|No hay ofertas activas/ }).first().waitFor();
  await capture('promotions-390');
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('somos-marketplace-preferences-v1')).view === 'home');
  await page.evaluate(() => localStorage.setItem('vendeplus_cart_smash', JSON.stringify([{ productId: 'qa', productName: 'Prueba', quantity: 1, unitPriceUsd: 1, selectedOptions: [] }])));
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 10.5, longitude: -66.9 });
  await page.getByRole('button', { name: 'Mis datos', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('QA Perfil');
  await page.getByLabel('Telefono', { exact: true }).fill('04120000000');
  await page.getByLabel('Tipo de cedula', { exact: true }).selectOption('E');
  await page.getByLabel('Cedula (opcional)', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Guardar datos', exact: true }).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('somos_customer_profile_v1')).idNumber), 'E-12345678');
  await page.getByRole('button', { name: 'Agregar ubicacion', exact: true }).click();
  await page.getByLabel('Direccion o referencia', { exact: true }).fill('Direccion ficticia de QA');
  await page.getByRole('button', { name: 'Guardar ubicacion', exact: true }).click();
  await page.getByText('Completa el nombre, la direccion y el punto en el mapa.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Usar mi ubicacion actual', exact: true }).click();
  await page.locator('.vendeplus-destination-marker').waitFor();
  assert.equal(await page.getByText('Ajusta el pin si necesitas precisar.', { exact: true }).count(), 1);
  assert.equal(await page.getByText(/Punto guardado/).count(), 0);
  await page.locator('.native-profile .leaflet-container').scrollIntoViewIfNeeded();
  assert.equal(await page.getByRole('button', { name: 'Usar mi ubicacion actual', exact: true }).evaluate(button => getComputedStyle(button).color !== getComputedStyle(button).backgroundColor), true);
  await capture('frequent-location-editor');
  await page.getByRole('button', { name: 'Guardar ubicacion', exact: true }).click();
  await page.getByText('Ubicacion guardada en este dispositivo.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('somos_frequent_location_v1')).location.latitude), 10.5);
  await page.reload();
  await page.getByRole('button', { name: 'Mis datos', exact: true }).click();
  assert.equal(await page.getByLabel('Cedula (opcional)', { exact: true }).inputValue(), '12345678');
  assert.equal(await page.getByLabel('Tipo de cedula', { exact: true }).inputValue(), 'E');
  await page.getByRole('button', { name: 'Editar ubicacion guardada', exact: true }).click();
  await page.getByLabel('Nombre de la ubicacion', { exact: true }).fill('Trabajo');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('dialog').getByText('Casa', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Cerrar mis datos' }).click();
  await page.goto(`${base}/smash/checkout`);
  assert.equal(await page.getByLabel('Nombre', { exact: true }).inputValue(), 'QA Perfil');
  assert.equal(await page.getByRole('button', { name: 'Guardar ubicacion', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Agregar ubicacion', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Usar Casa', exact: true }).click();
  assert.equal(await page.getByPlaceholder('Ej: casa azul, portón negro, frente a la panadería...').inputValue(), 'Direccion ficticia de QA');
  await page.locator('.frequent-location').scrollIntoViewIfNeeded();
  await capture('frequent-location-checkout');
  await page.getByRole('button', { name: 'Mis datos', exact: true }).click();
  await page.getByRole('dialog').getByText('Direccion ficticia de QA', { exact: true }).waitFor();
  await capture('frequent-location-profile');
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar ubicacion guardada' }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('somos_frequent_location_v1')), null);
  await page.getByRole('button', { name: 'Cerrar mis datos' }).click();
  const env = parseEnv(await readFile('../.env.local', 'utf8'));
  const secret = env.PANEL_SESSION_COOKIE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_JWT_SECRET;
  const payload = Buffer.from(JSON.stringify({ sid: 'qa-only', secret: 'qa', sub: 'qa-polish', email: 'qa@example.invalid', exp: Math.floor(Date.now() / 1000) + 3600, founder: false })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  await context.addCookies([{ name: 'somos_panel_session', value: `${payload}.${signature}`, url: base, httpOnly: true }]);
  const stores = [{ id: 'qa-store', slug: 'qa-store', name: 'Smash Test', subscription_status: 'active', table_orders_access_enabled: true }, { id: 'qa-store-2', slug: 'qa-store-2', name: 'Sede de prueba', subscription_status: 'active' }];
  const products = [
    { id: 'qa-product-1', store_id: 'qa-store', name: 'Hamburguesa doble con queso y papas', price_usd: 8.5, is_available: true, image_url: '/brand/new-somos-preview/somos-isotipo-preview.png', categories: { name: 'Hamburguesas' }, variants: [] },
    { id: 'qa-product-2', store_id: 'qa-store', name: 'Papas con queso', price_usd: 3.5, is_available: false, image_url: '/brand/new-somos-preview/somos-isotipo-preview.png', categories: { name: 'Adicionales' }, variants: [] },
  ];
  const orders = [{ id: 'qa-order-1', store_id: 'qa-store', public_code: 'SO-0928-123456', customer_name: 'Cliente de prueba', customer_phone: '', delivery_type: 'pickup', status: 'received', payment_status: 'pending', payment_method: 'Efectivo', total_usd: 12, subtotal_usd: 12, created_at: new Date().toISOString(), stores: stores[0], order_items: [] }];
  let notificationError = false;
  let notificationEmpty = false;
  const privateRoute = route => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 503, json: { error: 'QA: escritura bloqueada' } });
    const url = new URL(route.request().url());
    const status = url.searchParams.get('status');
    const storeId = url.searchParams.get('storeId');
    if (status === 'received' && notificationError) return route.fulfill({ status: 503, json: { error: 'QA' } });
    // Match the real API filters so an invalid status cannot pass the notification test.
    const filteredOrders = orders.filter(order => (!status || status === 'all' || order.status === status) && (!storeId || storeId === 'all' || order.store_id === storeId));
    return route.fulfill({ json: { userId: 'qa-polish', isFounderMode: false, stores, selectedStoreId: 'qa-store', achievementFeatures: {}, achievements: [], orders: notificationEmpty ? [] : filteredOrders, products, categories: [], announcements: [{ id: 'qa-news', title: 'Novedad de prueba', message: 'Mensaje de prueba', kind: 'news' }], page: { hasMore: false } } });
  };
  await context.route('**/api/panel/**', privateRoute);
  await page.evaluate(() => sessionStorage.setItem('vendeplus_panel_token', `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.qa`));
  for (const screen of ['productos', 'pedidos']) {
    await page.goto(`${base}/panel/${screen}`);
    await page.getByRole('navigation', { name: 'Mi negocio', exact: true }).waitFor();
    await page.getByText(screen === 'productos' ? 'Hamburguesa doble con queso y papas' : 'SO-0928-123456', { exact: true }).first().waitFor();
    if (screen === 'pedidos') assert.equal(await page.getByLabel(/pedidos sin revisar/).count(), 0, 'Read badge must stay cleared after navigation');
    const tutorial = page.getByRole('button', { name: 'Cerrar tutorial' });
    await tutorial.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await tutorial.isVisible()) await tutorial.click();
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await capture(`${screen}-${width}`);
      if (screen === 'productos') {
        const edit = page.locator('.product-edit summary').first();
        const box = await edit.boundingBox();
        assert.equal(box.width, 44);
        assert.equal(await edit.evaluate(el => {
          const button = el.getBoundingClientRect();
          const status = el.parentElement.previousElementSibling.getBoundingClientRect();
          return button.right <= status.left || button.bottom <= status.top || button.top >= status.bottom;
        }), true, 'Edit button must not overlap product status');
        if (width === 320) await page.getByLabel('1 pedidos sin revisar', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Notificaciones de pedidos', exact: true }).click();
        await page.locator('#panel-order-notifications').getByText('SO-0928-123456', { exact: true }).waitFor();
        assert.equal(await page.getByLabel(/pedidos sin revisar/).count(), 0, 'Opening the bell clears its unread badge');
        await capture(`order-notifications-${width}`);
        await page.getByRole('button', { name: 'Novedades de Somos', exact: true }).click();
        await page.locator('#panel-news').getByText('Novedad de prueba').waitFor();
        assert.equal(await page.locator('#panel-order-notifications').count(), 0);
        await capture(`news-${width}`);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#panel-news').count(), 0);
      }
    }
    if (screen === 'productos') {
      await page.getByRole('button', { name: 'Notificaciones de pedidos', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__alerts.length), 0, 'Do not notify historical pending orders');
      await page.getByRole('checkbox', { name: 'Sonido y notificacion' }).check();
      await page.getByRole('button', { name: 'Probar', exact: true }).click();
      await page.waitForFunction(() => window.__alerts.length === 1);
      await page.keyboard.press('Escape');
      orders.unshift({ ...orders[0], id: 'qa-new-order', public_code: 'SO-0929-000001', created_at: new Date().toISOString() });
      orders.unshift({ ...orders[0], id: 'qa-payment-pending', public_code: 'SO-0929-000002', status: 'accepted' });
      await page.waitForFunction(() => window.__alerts.length === 2, null, { timeout: 22000 });
      assert.equal(await page.evaluate(() => window.__alerts[1].id), 'qa-polish:qa-store:qa-new-order', 'The real polling timer must notify the received order only');
      await page.getByLabel('1 pedidos sin revisar', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Notificaciones de pedidos', exact: true }).click();
      await page.locator('#panel-order-notifications').getByText('SO-0929-000001', { exact: true }).waitFor();
      assert.equal(await page.getByLabel(/pedidos sin revisar/).count(), 0);
      assert.equal(await page.locator('#panel-order-notifications').getByText('SO-0929-000002', { exact: true }).count(), 0, 'An accepted order with pending payment is not a new order');
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForTimeout(1000);
      assert.equal(await page.evaluate(() => window.__alerts.length), 2, 'Do not repeat order alerts');
      await capture('native-order-alerts');
      await page.getByRole('checkbox', { name: 'Sonido y notificacion' }).uncheck();
      await page.keyboard.press('Escape');
      await page.locator('.product-edit summary').first().click();
      assert.equal(await page.locator('.product-edit').first().getAttribute('open'), '');
      await capture('edit-product');
      await page.locator('.product-edit summary').first().click();
      await page.getByRole('combobox', { name: 'Sede activa' }).filter({ visible: true }).selectOption('qa-store-2');
      await page.getByRole('button', { name: 'Notificaciones de pedidos', exact: true }).click();
      await page.getByText('No tienes pedidos pendientes.', { exact: true }).waitFor();
      assert.equal(await page.locator('#panel-order-notifications').getByText('SO-0928-123456').count(), 0, 'Do not leak other store orders');
      await page.keyboard.press('Escape');
      await page.getByRole('combobox', { name: 'Sede activa' }).filter({ visible: true }).selectOption('qa-store');
      notificationError = true;
      await page.getByRole('button', { name: 'Notificaciones de pedidos', exact: true }).click();
      await page.locator('#panel-order-notifications').getByRole('alert').waitFor();
      notificationError = false;
      notificationEmpty = true;
      await page.locator('#panel-order-notifications').getByRole('button', { name: 'Reintentar' }).click();
      await page.getByText('No tienes pedidos pendientes.', { exact: true }).waitFor();
      notificationEmpty = false;
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Crear producto', exact: true }).click();
      await capture('create-product');
      await page.getByRole('button', { name: 'Cancelar', exact: true }).first().click();
    }
  }
  await page.getByRole('button', { name: 'Negocio', exact: true }).click();
  await capture('business-menu');
  await page.getByRole('button', { name: 'Cerrar menu' }).click();
  for (const width of [390, 1366]) {
    const web = await browser.newPage({ viewport: { width, height: 900 } });
    await web.goto(`${base}/marketplace`);
    assert.equal(await web.locator('.native-buyer-header').count(), 0);
    await web.screenshot({ path: `${output}/web-${width}.png` });
    await web.context().addCookies(await context.cookies(base));
    await web.context().route('**/api/panel/**', privateRoute);
    await web.addInitScript(() => sessionStorage.setItem('vendeplus_panel_token', `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.qa`));
    await web.goto(`${base}/panel/productos`);
    await web.locator('.product-edit summary').first().waitFor();
    const tour = web.getByRole('button', { name: 'Cerrar tutorial' });
    await tour.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await tour.isVisible()) await tour.click();
    await web.getByRole('button', { name: 'Notificaciones de pedidos', exact: true }).click();
    await web.locator('#panel-order-notifications').getByText('SO-0928-123456', { exact: true }).waitFor();
    assert.equal(await web.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Web panel overflow');
    await web.screenshot({ path: `${output}/web-orders-${width}.png` });
    await web.getByRole('button', { name: 'Novedades de Somos', exact: true }).click();
    await web.locator('#panel-news').getByText('Novedad de prueba').waitFor();
    await web.screenshot({ path: `${output}/web-news-${width}.png` });
    await web.close();
  }
  assert.deepEqual(errors, [], 'React runtime errors');
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ results, errors }, null, 2));
}
