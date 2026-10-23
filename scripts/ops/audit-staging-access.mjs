import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const input = [];
for await (const chunk of process.stdin) input.push(chunk);
const keys = JSON.parse(Buffer.concat(input).toString('utf8').replace(/^\uFEFF/, ''));
const ref = 'nmuypksuaxwyonilzoqs';
if (keys.ref !== ref) throw new Error('Wrong audit staging');
for (const [key, role] of [[keys.anon, 'anon'], [keys.service, 'service_role']]) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  if (claims.ref !== ref || claims.role !== role) throw new Error('Wrong staging credentials');
}
const base = `https://${ref}.supabase.co`;
if (process.argv[2] === 'qa') {
  const deployment = JSON.parse(await readFile('tmp/audit-staging-recovery/preview-deployment.json', 'utf8'));
  if (deployment.stage !== ref || !/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/.test(deployment.url)) throw new Error('Wrong QA deployment');
  const { testKitchenApi } = await import('../kitchen-api.e2e.mjs');
  await testKitchenApi(keys, deployment.url);
  process.exit(0);
}
async function request(path, { method = 'GET', body, prefer } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { apikey: keys.service, Authorization: `Bearer ${keys.service}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Staging request failed: ${method} ${path.split('?')[0]} HTTP ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
const stores = await request('/rest/v1/stores?select=id,slug&order=slug');
if (stores.length !== 2 || !stores.every(s => ['cocina-demo', 'tienda-demo'].includes(s.slug))) throw new Error('Unexpected demo database');
const accounts = [
  { email: 'preview-audit@somos.test', role: 'commerce' },
  { email: 'preview-audit-admin@somos.test', role: 'admin' },
];
const { users } = await request('/auth/v1/admin/users?page=1&per_page=100');
if (users.some(user => !accounts.some(a => a.email === user.email))) throw new Error('Non-demo identities present');
await mkdir('tmp/audit-staging-recovery', { recursive: true });
const artifact = 'tmp/audit-staging-recovery/access.json';
let saved;
try { saved = JSON.parse(await readFile(artifact, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (saved && saved.ref !== ref) throw new Error('Wrong access artifact');
saved ||= { ref, accounts: [] };
for (const account of accounts) {
  let user = users.find(u => u.email === account.email);
  let entry = saved.accounts.find(a => a.email === account.email);
  if (!user) {
    entry = { ...account, password: randomBytes(24).toString('base64url') };
    // Save a recoverable credential before creating only this fictional QA identity.
    saved.accounts = [...saved.accounts.filter(a => a.email !== account.email), entry];
    await writeFile(artifact, JSON.stringify(saved, null, 2));
    user = await request('/auth/v1/admin/users', { method: 'POST', body: { email: entry.email, password: entry.password, email_confirm: true } });
  }
  if (!entry) throw new Error('Existing QA account has no saved access; refusing to reset it automatically');
  if (account.role === 'commerce') {
    const memberships = await request(`/rest/v1/store_users?user_id=eq.${user.id}&select=store_id`);
    for (const store of stores) {
      if (!memberships.some(m => m.store_id === store.id)) {
        await request('/rest/v1/store_users', { method: 'POST', body: { user_id: user.id, store_id: store.id, role: 'owner' } });
      }
    }
  }
}
await writeFile('tmp/audit-staging-recovery/ACCESO-PREVIEW.txt', [
  'SOLO PREVIEW AISLADO. Estas cuentas no existen en produccion.',
  ...saved.accounts.flatMap(a => ['', a.role === 'admin' ? 'Administrador de prueba' : 'Comercio de prueba', `Correo: ${a.email}`, `Clave: ${a.password}`]),
].join('\r\n'));
console.log('Two fictional QA accounts ready; credentials saved only in tmp/audit-staging-recovery/ACCESO-PREVIEW.txt. No email sent.');
