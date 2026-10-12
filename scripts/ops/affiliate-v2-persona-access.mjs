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

const url = `https://${keys.ref}.supabase.co`;
const deployment = JSON.parse(await readFile('tmp/buyer-staging/preview-deployment.json', 'utf8'));
const origin = deployment.url;
if (deployment.stage !== keys.ref || !/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/.test(origin)) {
  throw new Error('Unexpected preview deployment');
}
const admin = createClient(url, keys.service, { auth: { persistSession: false } });
const { data: agency, error: agencyError } = await admin.from('transport_agencies')
  .select('id').eq('slug', 'delivery-referidos-demo').single();
if (agencyError || !agency) throw agencyError || new Error('Demo agency missing');
const { data: code, error: codeError } = await admin.from('affiliate_codes')
  .select('id, beneficiary_email').eq('code', 'CREADORDEMO').eq('partner_type', 'creator').single();
if (codeError || !code || !['preview-aliado@somos.test', 'preview-creador@somos.test'].includes(code.beneficiary_email)) {
  throw codeError || new Error('Creator code has unexpected owner');
}

const access = [];
for (const account of [
  { email: 'preview-creador@somos.test', path: '/api/affiliates/me', panel: '/aliados' },
  { email: 'preview-delivery@somos.test', path: `/api/transport/panel/affiliates?agencyId=${agency.id}`, panel: '/transporte/panel/referidos' },
]) {
  const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  let user = users.users.find((item) => item.email?.toLowerCase() === account.email);
  const password = `SomosDemo-${randomBytes(9).toString('base64url')}!`;
  if (user) {
    if (!user.email_confirmed_at) throw new Error(`Demo email not confirmed: ${account.email}`);
    const { error } = await admin.auth.admin.updateUserById(user.id, { password });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: account.email, password, email_confirm: true });
    if (error || !data.user) throw error || new Error(`Could not create ${account.email}`);
    user = data.user;
  }
  if (account.email === 'preview-creador@somos.test') {
    const { error } = await admin.from('affiliate_codes')
      .update({ beneficiary_email: account.email, commission_percent: 50 }).eq('id', code.id);
    if (error) throw error;
  } else {
    const { error: removeError } = await admin.from('transport_agency_users').delete()
      .eq('agency_id', agency.id).eq('email', 'preview-aliado@somos.test');
    if (removeError) throw removeError;
    const { error: addError } = await admin.from('transport_agency_users').upsert({
      agency_id: agency.id, user_id: user.id, email: account.email, role: 'owner',
    }, { onConflict: 'agency_id,email' });
    if (addError) throw addError;
  }
  const auth = createClient(url, keys.anon, { auth: { persistSession: false } });
  const { data: login, error: loginError } = await auth.auth.signInWithPassword({ email: account.email, password });
  if (loginError || !login.session?.access_token) throw loginError || new Error(`Login failed: ${account.email}`);
  const response = await fetch(`${origin}${account.path}`, {
    headers: { Authorization: `Bearer ${login.session.access_token}` },
  });
  if (response.status !== 200) throw new Error(`Panel access failed: ${account.email} (${response.status})`);
  access.push({ email: account.email, password, panel: account.panel });
  await auth.auth.signOut();
}

process.stdout.write(JSON.stringify({ stagingOnly: true, access }) + '\n');
