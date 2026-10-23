import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const dir = 'tmp/audit-staging-recovery';
const deployment = JSON.parse(await readFile(`${dir}/preview-deployment.json`, 'utf8'));
const access = JSON.parse(await readFile(`${dir}/access.json`, 'utf8'));
assert.equal(deployment.stage, 'nmuypksuaxwyonilzoqs');
assert.equal(access.ref, deployment.stage);
assert.match(deployment.url, /^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/);
const browser = await chromium.launch({ headless: true });
const checks = [];
const kitchenId = '51000000-0000-4000-8000-000000000001';
const shopId = '51000000-0000-4000-8000-000000000002';
async function api(context, path, headers, expected = 200, data) {
  const response = await context.request.fetch(deployment.url + path, {
    method: data === undefined ? 'GET' : 'POST', headers, data, timeout: 45000,
  });
  const body = await response.json();
  assert.equal(response.status(), expected, `${path}: ${JSON.stringify(body).slice(0, 350)}`);
  checks.push({ api: path, status: response.status(), summary: body.summary, page: body.page });
  console.log(`PASS HTTP ${response.status()} ${path}`);
  return body;
}
try {
  for (const account of access.accounts) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    const authResponses = [];
    page.on('pageerror', error => { const entry = { path: new URL(page.url()).pathname, message: error.message }; errors.push(entry); checks.push({ browserError: entry }); });
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname.includes('/auth/') || url.pathname.includes('/api/panel/context')) authResponses.push({ host: url.host, path: url.pathname, status: response.status() });
    });
    const hydrated = page.waitForResponse(response => new URL(response.url()).pathname === '/api/panel/context', { timeout: 45000 });
    await page.goto(`${deployment.url}/panel/login`, { waitUntil: 'domcontentloaded' });
    await hydrated;
    await page.getByLabel('Email', { exact: true }).fill(account.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Entrar al panel', exact: true }).click();
    try {
      await page.waitForURL(url => !url.pathname.includes('login') && /\/(panel|admin)/.test(url.pathname), { timeout: 45000, waitUntil: 'domcontentloaded' });
    } catch (error) {
      await page.screenshot({ path: `${dir}/login-failure-${account.role}.png` });
      console.log(JSON.stringify({ role: account.role, path: new URL(page.url()).pathname, alerts: await page.getByRole('alert').allTextContents(), authResponses, errors }));
      throw error;
    }
    await page.locator('h1').first().waitFor({ timeout: 45000 });
    assert.deepEqual((await page.getByRole('alert').allTextContents()).filter(text => text.trim()), [], 'Login error visible');
    checks.push({ role: account.role, loginPath: new URL(page.url()).pathname, heading: await page.locator('h1').first().innerText() });
    await page.screenshot({ path: `${dir}/login-${account.role}.png` });
    const routes = account.role === 'admin'
      ? [['/admin', '/api/admin/summary'], ['/admin/comercios', '/api/admin/stores'], ['/admin/aliados', '/api/admin/affiliates']]
      : [['/panel/clientes', '/api/panel/customers'], ['/panel/estadisticas', '/api/panel/stats']];
    let authHeaders;
    for (const [path, endpoint] of routes) {
      const responses = [];
      const listener = response => {
        if (new URL(response.url()).pathname.startsWith(endpoint)) responses.push(response);
      };
      page.on('response', listener);
      const loaded = page.waitForResponse(response => new URL(response.url()).pathname.startsWith(endpoint), { timeout: 60000 });
      await page.goto(deployment.url + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const response = await loaded;
      await response.finished();
      const body = await response.json();
      assert.equal(response.status(), 200, `${path}: ${JSON.stringify(body).slice(0, 350)}`);
      const requestHeaders = await response.request().allHeaders();
      authHeaders = Object.fromEntries(Object.entries(requestHeaders).filter(([key]) => key === 'authorization' || key.startsWith('x-panel-')));
      await page.locator('h1').first().waitFor({ timeout: 30000 });
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.screenshot({ path: `${dir}/${path.replaceAll('/', '-')}-${width}.png`, fullPage: true });
        const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
        assert.ok(layout.scrollWidth <= width + 2, `${path} overflow at ${width}: ${layout.scrollWidth}`);
        checks.push({ route: path, ...layout, headings: await page.locator('h1,h2').allTextContents(), summary: body.summary });
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      checks.push({ route: path, selects: await page.locator('select').evaluateAll(elements => elements.map(e => ({ value: e.value, options: Array.from(e.options, o => ({ value: o.value, text: o.text })) }))), responses: responses.map(r => ({ path: new URL(r.url()).pathname, status: r.status() })) });
      page.off('response', listener);
      if (path === '/panel/estadisticas' || path === '/panel/clientes') {
        const isStats = path.endsWith('estadisticas');
        const selector = isStats ? 'select:has(option[value="today"])' : 'select:has(option[value="frequent"])';
        // Exercise uncached filters; revisiting the initial filter intentionally uses the read cache.
        for (const value of isStats ? ['today', 'previous_month'] : ['frequent', 'new']) {
          const filtered = page.waitForResponse(r => {
            const url = new URL(r.url());
            return url.pathname === endpoint && (url.searchParams.get(isStats ? 'range' : 'segment') || 'all') === value;
          }, { timeout: 45000 });
          await page.locator(selector).selectOption(value);
          assert.equal((await filtered).status(), 200);
          assert.equal(await page.locator(selector).inputValue(), value);
          checks.push({ uiFilter: path, value, status: 200 });
        }
      }
      if (path === '/admin') {
        for (const [period, label] of [['day', 'D\u00eda'], ['week', 'Semana'], ['month', 'Mes']]) {
          const filtered = page.waitForResponse(r => new URL(r.url()).pathname === endpoint && new URL(r.url()).searchParams.get('period') === period, { timeout: 45000 });
          await page.getByRole('button', { name: label, exact: true }).click();
          assert.equal((await filtered).status(), 200);
          assert.equal(await page.getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed'), 'true');
          checks.push({ uiFilter: path, period, status: 200 });
        }
      }
      console.log(`PASS desktop/mobile ${path}`);
    }
    if (account.role === 'commerce') {
      for (const range of ['today', 'last_7_days', 'last_30_days', 'this_month', 'previous_month']) {
        await api(context, `/api/panel/stats?range=${range}&storeId=${kitchenId}`, authHeaders);
      }
      await api(context, `/api/panel/stats?range=custom&start=2020-01-01&end=2020-01-02&storeId=${shopId}`, authHeaders);
      await api(context, '/api/panel/stats?range=custom&start=bad&end=bad', authHeaders, 400);
      await api(context, '/api/panel/stats?storeId=51000000-0000-4000-8000-000000000099', authHeaders, 403);
      await api(context, '/api/admin/summary', authHeaders, 403);
      for (const storeId of [kitchenId, shopId]) {
        const scoped = { ...authHeaders, 'x-panel-store-id': storeId };
        await api(context, '/api/panel/customers?limit=25&offset=0', scoped);
        const absent = await api(context, '/api/panel/customers?search=QA-NOT-EXISTS', scoped);
        assert.equal(absent.customers.length, 0);
        const later = await api(context, '/api/panel/customers?limit=25&offset=1000', scoped);
        assert.equal(later.customers.length, 0);
      }
    } else {
      for (const period of ['day', 'week', 'month']) await api(context, `/api/admin/summary?period=${period}&anchor=2026-10-21`, authHeaders);
    }
    assert.deepEqual(errors, [], 'Browser runtime error');
    await context.close();
  }
  const publicContext = await browser.newContext();
  await api(publicContext, '/api/panel/customers', {}, 401);
  await api(publicContext, '/api/panel/stats', {}, 401);
  await api(publicContext, '/api/admin/summary', {}, 401);
  await api(publicContext, '/api/delivery/quote', {}, 400, {});
  await api(publicContext, '/api/delivery/quote', {}, 400, { storeId: kitchenId, latitude: 100, longitude: 0 });
  const quote = await api(publicContext, '/api/delivery/quote', {}, 200, { storeId: kitchenId, latitude: 10.247, longitude: -67.596, subtotalUsd: 10 });
  assert.equal(quote.ok, true);
  assert.ok(quote.quote.quoteToken);
  checks.push({ deliveryQuote: { ...quote.quote, quoteToken: '[present]' } });
  await publicContext.close();
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    const response = await page.goto(`${deployment.url}/cocina-demo`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.getByText('Combo Demo', { exact: true }).first().waitFor({ timeout: 30000 });
    assert.equal(response.status(), 200);
    assert.ok((await page.locator('body').innerText()).includes('Combo Demo'));
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(layout.scrollWidth <= layout.width + 2, 'Catalog horizontal overflow');
    await page.screenshot({ path: `${dir}/catalog-${width}.png` });
    checks.push({ catalogWidth: width, status: response.status(), ...layout });
    await context.close();
  }
  await writeFile(`${dir}/browser-smoke.json`, JSON.stringify({ passed: true, checks }, null, 2));
  console.log(JSON.stringify({ passed: true, checks }));
} finally {
  await writeFile(`${dir}/browser-smoke-progress.json`, JSON.stringify({ checks }, null, 2));
  await browser.close();
}
