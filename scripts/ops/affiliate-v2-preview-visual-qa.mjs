import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
if (!/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/.test(input.base)) {
  throw new Error('Unexpected preview URL');
}
if (!Array.isArray(input.profiles) || input.profiles.length !== 3) throw new Error('Three demo profiles required');
const output = 'tmp/referrals-v2-visual';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const profile of input.profiles) {
    if (!['seller', 'creator', 'delivery'].includes(profile.name) ||
        !/^preview-(aliado|creador|delivery)@somos\.test$/.test(profile.email)) throw new Error('Unexpected profile');
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 850 } });
      const page = await context.newPage();
      const failures = [];
      page.on('pageerror', (error) => failures.push(error.message));
      await page.goto(`${input.base}/panel/login?next=${encodeURIComponent(profile.path)}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await page.getByLabel('Email', { exact: true }).fill(profile.email);
      await page.getByLabel('Contraseña', { exact: true }).fill(profile.password);
      await page.waitForTimeout(250);
      await page.locator('form button[type=submit]').click();
      try {
        await page.waitForURL((url) => url.pathname !== '/panel/login', { timeout: 20_000 });
      } catch {
        const alerts = await page.locator('[role="alert"]').allInnerTexts();
        const visible = (await page.locator('body').innerText()).slice(-900);
        throw new Error(`Login did not redirect: ${profile.name}, path=${new URL(page.url()).pathname}, alerts=${JSON.stringify(alerts)}, visible=${JSON.stringify(visible)}`);
      }
      if (new URL(page.url()).pathname !== profile.path) {
        await page.goto(`${input.base}${profile.path}`, { waitUntil: 'domcontentloaded' });
      }
      await page.getByText('Vista de demostración.', { exact: false }).waitFor({ timeout: 20_000 });
      const summary = await page.evaluate(() => ({
        heading: document.querySelector('h1')?.textContent?.trim(),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        body: document.body.innerText,
      }));
      const storeCount = await page.locator('section[aria-label="Comercios referidos"] [data-affiliate-store]').count();
      if (summary.overflow || failures.length || !summary.body.includes(profile.expectedCode) || storeCount !== 3 ||
          !summary.body.includes('Por suscripciones') || !summary.body.toLowerCase().includes('fee de pedidos') ||
          !summary.body.includes('Mis datos para recibir pagos') || !summary.body.includes('Ganancias totales') || summary.body.includes('Fee generado')) {
        throw new Error(`Visual QA failed: ${profile.name}/${width}, overflow=${summary.overflow}, errors=${failures.length}, stores=${storeCount}, code=${summary.body.includes(profile.expectedCode)}, subscriptions=${summary.body.includes('Por suscripciones')}, fee=${summary.body.toLowerCase().includes('fee de pedidos')}, payout=${summary.body.includes('Mis datos para recibir pagos')}, earnings=${summary.body.includes('Ganancias totales')}`);
      }
      const firstStore = page.locator('[data-affiliate-store]').first();
      await firstStore.click();
      if (await firstStore.getAttribute('aria-expanded') !== 'true' ||
          !(await page.locator(`#${await firstStore.getAttribute('aria-controls')}`).innerText()).includes('Suscripcion')) {
        throw new Error(`Commerce earnings did not expand: ${profile.name}/${width}`);
      }
      await page.screenshot({ path: `${output}/${profile.name}-${width}.png`, fullPage: true });
      results.push({ profile: profile.name, width, overflow: false, pageErrors: 0, codeVisible: true });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
process.stdout.write(JSON.stringify({ results, screenshots: output }) + '\n');
