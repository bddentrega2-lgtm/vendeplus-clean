import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

const base = 'http://127.0.0.1:3107';
const output = 'tmp/referrals-independent-visual';
await mkdir(output, { recursive: true });
const image = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#007a69' } }).png().toBuffer();
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [390, 1280]) {
    for (const discount of [0, 50]) {
      const context = await browser.newContext({ viewport: { width, height: 850 } });
      try {
        // Mock only this visual form submission; real API creation is tested by the journey suite.
        await context.route('**/api/signup', (route) => route.fulfill({ status: 201, json: { request: {
          request_code: 'SOL-QADEMO', setup_base_usd: 20, setup_discount_percent: discount, setup_due_usd: 20 * (1 - discount / 100),
        }, message: 'Solicitud guardada.' } }));
        await context.route('**/api/affiliate-code?*', (route) => route.fulfill({ json: { valid: true, kind: 'affiliate', discountPercent: discount, dueUsd: 20 * (1 - discount / 100) } }));
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${base}/registro${discount ? '?ref=DEMO50' : ''}`, { waitUntil: 'networkidle' });
        await page.getByLabel('Nombre del comercio', { exact: true }).fill('Comercio Demo');
        await page.getByLabel('Nombre del representante', { exact: true }).fill('Operador Demo');
        await page.getByPlaceholder('V-12345678', { exact: true }).fill('V-12345678');
        await page.locator('input[type=file]').setInputFiles({ name: 'demo.png', mimeType: 'image/png', buffer: image });
        await page.getByRole('combobox', { name: /^Ciudad donde opera/ }).selectOption({ index: 1 });
        await page.getByLabel('WhatsApp', { exact: true }).fill('584120000000');
        await page.getByLabel('Email', { exact: true }).fill('demo@example.invalid');
        await page.getByRole('combobox', { name: /semana promedio/ }).selectOption('starting');
        await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
        await page.getByRole('heading', { name: 'Solicitud recibida' }).waitFor();
        const whatsapp = await page.getByRole('link', { name: 'Enviar solicitud a Somos' }).getAttribute('href');
        const text = new URL(whatsapp).searchParams.get('text');
        assert.ok(text.includes(discount ? 'Descuento: 50% (US$10.00)' : 'Descuento: sin descuento.'));
        assert.ok(text.includes(`Total a pagar: US$${discount ? '10.00' : '20.00'}`));
        assert.ok(text.includes('Pago pendiente'));
        assert.equal(await page.getByRole('link', { name: /Reportar pago inicial/ }).count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: `${output}/signup-success-${discount}-${width}.png`, fullPage: true });
        console.log(JSON.stringify({ width, discount, whatsapp: 'PASS', submission: 'mocked', overflow: false }));
      } finally { await context.close(); }
    }
  }
} finally { await browser.close(); }
