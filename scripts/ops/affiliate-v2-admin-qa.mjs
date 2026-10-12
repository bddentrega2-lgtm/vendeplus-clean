import { mkdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
if (input.ref !== 'xpqmmdmixpyqruykkbkf' || typeof input.anon !== 'string' ||
    typeof input.service !== 'string' || !/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/.test(input.base)) {
  throw new Error('Staging preview credentials and URL required');
}
for (const [key, role] of [[input.anon, 'anon'], [input.service, 'service_role']]) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  if (claims.ref !== input.ref || claims.role !== role) throw new Error('Wrong staging key');
}
const service = createClient(`https://${input.ref}.supabase.co`, input.service, { auth: { persistSession: false } });
const publicAuth = createClient(`https://${input.ref}.supabase.co`, input.anon, { auth: { persistSession: false } });
const { data: link, error: linkError } = await service.auth.admin.generateLink({ type: 'magiclink', email: 'preview-admin@somos.test' });
if (linkError || !link.properties?.hashed_token) throw linkError || new Error('Admin QA link unavailable');
const { data: login, error: loginError } = await publicAuth.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
if (loginError || !login.session?.access_token) throw loginError || new Error('Admin QA login unavailable');

await mkdir('tmp/referrals-v2-admin-visual', { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 850 } });
    try {
      const establish = await context.request.post(`${input.base}/api/auth/panel-session`, { data: { accessToken: login.session.access_token } });
      if (establish.status() !== 200) throw new Error(`Admin session failed: ${establish.status()}`);
      const api = await context.request.get(`${input.base}/api/admin/affiliates`);
      const payload = await api.json();
      if (api.status() !== 200) throw new Error(`Admin list API failed: ${api.status()}`);
      const demos = payload.balances?.filter((row) => row.demo);
      if (demos?.length !== 3 || demos.some((row) => row.commerceCount !== 3 ||
          !row.partnerTypes?.length || row.setupPendingCount + row.setupPaidCount !== 3 ||
          row.feePendingCount + row.feePaidCount < 10 ||
          !Number.isFinite(Number(row.setupPendingUsd)) || !Number.isFinite(Number(row.feePaidUsd)))) {
        throw new Error('Admin demo list is incomplete');
      }
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await page.goto(`${input.base}/admin/aliados`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Aliados referidores' }).waitFor({ timeout: 20_000 });
      const section = page.locator('section[aria-label="Lista de aliados"]');
      await section.getByText('Demo · no liquidable').first().waitFor({ timeout: 20_000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      if (overflow || pageErrors.length || await section.getByText('Ya pagado').count() < 3 ||
          await section.getByText('Pedidos con fee cobrado').count() < 1) {
        throw new Error(`Admin visual QA failed: width=${width}, overflow=${overflow}, errors=${pageErrors.length}`);
      }
      await page.screenshot({ path: `tmp/referrals-v2-admin-visual/admin-${width}.png`, fullPage: true });
      await page.getByRole('textbox', { name: 'Buscar aliado' }).fill('CREADORDEMO');
      if (await section.getByText('Demo · no liquidable').count() !== 1) throw new Error(`Admin search failed at ${width}px`);
      await section.getByRole('button', { expanded: false }).first().click();
      await section.getByText('Codigos y pago movil').waitFor();
      results.push({ width, demoRows: demos.length, overflow: false, pageErrors: 0, search: 'ok', details: 'ok' });
      await page.close();
      await context.request.delete(`${input.base}/api/auth/panel-session`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await publicAuth.auth.signOut({ scope: 'local' }).catch(() => {});
}
process.stdout.write(JSON.stringify({ stage: input.ref, results }) + '\n');
