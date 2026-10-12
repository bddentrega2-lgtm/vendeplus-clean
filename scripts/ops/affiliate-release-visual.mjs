import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = 'https://www.somos-ve.com';
const output = 'tmp/referrals-release-visual';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 850 }, serviceWorkers: 'block' });
    // This production check never submits a registration, payment or order.
    await context.route('**/*', async (route) => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) return route.abort();
      return route.continue();
    });
    for (const path of ['/registro', '/aliados', '/smash/checkout', '/realza/checkout', '/shibui/carrito']) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const response = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
      assert.equal(response.status(), 200, `${path}: status`);
      if (path === '/aliados') await page.locator('a[href="/panel/login?next=/aliados"]').waitFor();
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        text: document.body.innerText,
      }));
      assert.equal(layout.overflow, false, `${path}/${width}: overflow`);
      assert.equal(errors.length, 0, `${path}/${width}: JavaScript errors`);
      assert.ok(layout.text.trim().length > 20, `${path}/${width}: blank page`);
      if (path === '/registro') assert.match(layout.text, /20[.,]00/, 'Setup payment visible');
      await page.screenshot({ path: `${output}/${path.slice(1).replaceAll('/', '-')}-${width}.png`, fullPage: true });
      const result = { path, width, status: 200, overflow: false, errors: 0 };
      results.push(result);
      console.log(JSON.stringify(result));
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(`${output}/results.json`, JSON.stringify({ base, time: new Date().toISOString(), readOnly: true, results }, null, 2));
