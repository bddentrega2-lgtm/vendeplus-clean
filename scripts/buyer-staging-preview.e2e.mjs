import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const cloud = process.argv.includes('--cloud');
const base = cloud ? JSON.parse(await readFile('tmp/buyer-staging/preview-deployment.json', 'utf8')).url : 'http://127.0.0.1:3107';
if (cloud && !/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/.test(base)) throw new Error('Unexpected preview URL');
const output = `tmp/buyer-staging/qa-${cloud ? 'cloud' : 'local'}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [], errors = [], backendHosts = new Set();
const expectedBackend = 'xpqmmdmixpyqruykkbkf.supabase.co';
function pass(name) { results.push(name); console.log(`PASS ${name}`); }
try {
  const context = await browser.newContext();
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname.endsWith('.supabase.co')) {
      backendHosts.add(url.hostname);
      assert.equal(url.hostname, expectedBackend, 'Unexpected database request');
    }
    if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
    await route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(`${base}/marketplace`);
  assert.equal(response.status(), 200);
  const csp = response.headers()['content-security-policy'];
  assert.ok(csp.includes(expectedBackend));
  assert.ok(!csp.includes('rvmtjtuztewcrmodrodb'));
  await page.getByRole('dialog', { name: 'Elige tu ciudad' }).waitFor();
  await page.getByRole('button', { name: 'Caracas Demo', exact: true }).click();
  await page.locator('.market-directory-toolbar').waitFor();
  await page.getByRole('link', { name: /Cocina Demo/ }).first().waitFor();
  assert.equal(await page.getByRole('link', { name: /Tienda Demo/ }).count(), 0);
  pass('city filter uses fictional staging catalog');
  await page.reload();
  await page.locator('.market-directory-toolbar').waitFor();
  assert.equal(await page.getByRole('dialog', { name: 'Elige tu ciudad' }).count(), 0);
  pass('city preference survives reload');

  for (const width of [320, 390, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('button', { name: 'Mapa', exact: true }).click();
    await page.locator('.market-map-pin').first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.market-map-logo img')].some(img => img.complete && img.naturalWidth > 0));
    await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile-loaded')].some(img => img.complete && img.naturalWidth > 0));
    await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile')].every(img => img.complete && img.naturalWidth > 0 && getComputedStyle(img).opacity === '1'));
    assert.equal(Math.round((await page.locator('.market-map-pin').first().boundingBox()).width), 44);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${output}/map-${width}.png` });
    await page.getByRole('button', { name: 'Cerrar mapa', exact: true }).click();
    await page.screenshot({ path: `${output}/marketplace-${width}.png` });
    pass(`map and marketplace ${width}px`);
  }
  await page.goto(`${base}/cocina-demo`);
  await page.getByRole('heading', { name: 'Cocina Demo', exact: true }).first().waitFor();
  await page.getByText('Combo Demo', { exact: true }).first().waitFor();
  pass('fictional visual catalog available');
  for (const path of ['/api/buyer/orders', '/api/panel/context', '/api/panel/orders', '/api/admin/stores']) {
    const response = await context.request.get(`${base}${path}`);
    assert.equal(response.status(), 401, path);
    pass(`${path} denies anonymous requests`);
  }
  await page.goto(`${base}/mi-cuenta`);
  await page.getByRole('button', { name: 'Continuar con Google', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/account-390.png` });
  let oauthChecked = false;
  await page.route(`https://${expectedBackend}/auth/v1/authorize**`, async route => {
    const url = new URL(route.request().url());
    backendHosts.add(url.hostname);
    assert.equal(url.searchParams.get('provider'), 'google');
    assert.equal(url.searchParams.get('redirect_to'), `${base}/auth/buyer-callback`);
    assert.equal(url.searchParams.get('code_challenge_method'), 's256');
    assert.ok(url.searchParams.get('code_challenge'));
    const response = await context.request.get(url.toString(), { maxRedirects: 0 });
    assert.equal(response.status(), 302);
    const google = new URL(response.headers().location);
    assert.equal(google.hostname, 'accounts.google.com');
    assert.equal(google.searchParams.get('redirect_uri'), `https://${expectedBackend}/auth/v1/callback`);
    assert.ok(google.searchParams.get('client_id')?.endsWith('.apps.googleusercontent.com'));
    oauthChecked = true;
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'OAuth handoff checked. No account signed in.' });
  });
  await page.getByRole('button', { name: 'Continuar con Google', exact: true }).click();
  await page.getByText('OAuth handoff checked. No account signed in.').waitFor();
  assert.ok(oauthChecked);
  pass('Google handoff uses staging, correct callback and PKCE (no real login)');
  assert.deepEqual(errors, []);
  assert.deepEqual([...backendHosts], [expectedBackend]);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, results, errors, backendHosts: [...backendHosts], realGoogleLoginTested: false }, null, 2));
  await browser.close();
}
