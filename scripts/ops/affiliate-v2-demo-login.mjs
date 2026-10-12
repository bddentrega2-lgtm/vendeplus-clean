import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const keys = JSON.parse(Buffer.concat(chunks).toString('utf8'));
if (keys.ref !== 'xpqmmdmixpyqruykkbkf') throw new Error('Staging only');
for (const [key, role] of [[keys.anon, 'anon'], [keys.service, 'service_role']]) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  if (claims.ref !== keys.ref || claims.role !== role) throw new Error('Wrong staging key');
}

const deployment = JSON.parse(await readFile('tmp/buyer-staging/preview-deployment.json', 'utf8'));
const origin = deployment.url;
if (deployment.stage !== keys.ref || !/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/.test(origin)) {
  throw new Error('Unexpected preview deployment');
}
const url = `https://${keys.ref}.supabase.co`;
const admin = createClient(url, keys.service, { auth: { persistSession: false } });
const results = [];
const adminOnly = process.argv.includes('--admin-only');

for (const account of [
  { email: 'preview-admin@somos.test', endpoint: '/api/admin/affiliates', panel: '/admin/aliados' },
  { email: 'preview-aliado@somos.test', endpoint: '/api/affiliates/me', panel: '/aliados' },
].filter((account) => !adminOnly || account.email === 'preview-admin@somos.test')) {
  const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  let user = users.users.find((item) => item.email?.toLowerCase() === account.email);
  const password = `SomosDemo-${randomBytes(9).toString('base64url')}!`;
  if (user) {
    if (!user.email_confirmed_at) throw new Error(`Demo email not confirmed: ${account.email}`);
    const { error } = await admin.auth.admin.updateUserById(user.id, { password });
    if (error) throw error;
  } else {
    if (adminOnly) throw new Error('Existing preview admin not found; no account created.');
    const { data, error } = await admin.auth.admin.createUser({ email: account.email, password, email_confirm: true });
    if (error || !data.user) throw error || new Error(`Could not create ${account.email}`);
    user = data.user;
  }
  const auth = createClient(url, keys.anon, { auth: { persistSession: false } });
  const { data: login, error: loginError } = await auth.auth.signInWithPassword({ email: account.email, password });
  if (loginError || !login.session?.access_token) throw loginError || new Error(`Login failed: ${account.email}`);
  const response = await fetch(`${origin}${account.endpoint}`, {
    headers: { Authorization: `Bearer ${login.session.access_token}` },
  });
  if (response.status !== 200) throw new Error(`Panel access failed: ${account.email} (${response.status})`);
  results.push({ email: account.email, password, url: `${origin}${account.panel}` });
  await auth.auth.signOut();
}

process.stdout.write(JSON.stringify({ stagingOnly: true, accounts: results }) + '\n');
