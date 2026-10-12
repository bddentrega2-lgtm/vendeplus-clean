import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const keys = JSON.parse(Buffer.concat(chunks).toString('utf8'));
if (keys.ref !== 'xpqmmdmixpyqruykkbkf' || typeof keys.anon !== 'string' || typeof keys.service !== 'string') {
  throw new Error('Staging credentials required');
}
for (const [key, role] of [[keys.anon, 'anon'], [keys.service, 'service_role']]) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  if (claims.ref !== keys.ref || claims.role !== role) throw new Error('Wrong staging key');
}
const base = 'http://127.0.0.1:3107';
const db = createClient(`https://${keys.ref}.supabase.co`, keys.service, { auth: { persistSession: false } });
const publicAuth = createClient(`https://${keys.ref}.supabase.co`, keys.anon, { auth: { persistSession: false } });
const suffix = randomBytes(5).toString('hex');
const email = `qa-affiliate-${suffix}@example.invalid`;
const password = randomBytes(24).toString('base64url');
let userId = '';
let codeId = '';
let membershipId = '';
const checks = [];
let passed = false;

async function read(path, token) {
  const response = await fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}
async function savePayout(path, token, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}
function assert(condition, name) {
  if (!condition) throw new Error(`QA failed: ${name}`);
  checks.push(name);
}

try {
  const { data: agency, error: agencyError } = await db.from('transport_agencies')
    .select('id').eq('slug', 'delivery-referidos-demo').single();
  if (agencyError || !agency) throw agencyError || new Error('Demo agency missing');
  const { data: created, error: userError } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (userError || !created.user) throw userError || new Error('Could not create QA account');
  userId = created.user.id;
  const { data: code, error: codeError } = await db.from('affiliate_codes').insert({
    code: `QA${suffix.toUpperCase()}`, name: 'QA isolated ally', partner_type: 'seller',
    beneficiary_email: email, discount_percent: 25, setup_commission_percent: 50,
    commission_percent: 25, duration_months: 1,
  }).select('id').single();
  if (codeError || !code) throw codeError || new Error('Could not create QA code');
  codeId = code.id;
  const { data: session, error: loginError } = await publicAuth.auth.signInWithPassword({ email, password });
  if (loginError || !session.session?.access_token) throw loginError || new Error('Could not log in');
  const token = session.session.access_token;

  const mine = await read('/api/affiliates/me', token);
  assert(mine.status === 200 && mine.body.codes?.length === 1 && mine.body.codes[0].id === codeId,
    'individual sees only own code');
  assert(Array.isArray(mine.body.stores) && !('pendingUsd' in mine.body), 'individual does not receive uncollected fee estimate');
  const payout = await savePayout('/api/affiliates/payout', token, {
    holderName: 'QA Operator', bankName: 'Banco Demo', documentNumber: 'V12345678', phone: '04121234567',
  });
  assert(payout.status === 200 && payout.body.payout?.phone === '04121234567', 'individual can save own payout details');
  const ownPayout = await read('/api/affiliates/payout', token);
  assert(ownPayout.status === 200 && ownPayout.body.payout?.holderName === 'QA Operator', 'individual can read own payout details');
  const invalidPayout = await savePayout('/api/affiliates/payout', token, {
    holderName: 'QA Operator', bankName: 'Banco Demo', documentNumber: 'V12345678', phone: '123',
  });
  assert(invalidPayout.status === 400, 'invalid payout phone is rejected');
  const admin = await read('/api/admin/affiliates', token);
  assert(admin.status === 403, 'individual cannot read admin affiliates');
  const commissions = await read(`/api/admin/affiliates/commissions?allyKey=${encodeURIComponent(`email:${email}`)}`, token);
  assert(commissions.status === 403, 'individual cannot read admin commission pages');
  const anonymousCommissions = await read(`/api/admin/affiliates/commissions?allyKey=${encodeURIComponent(`email:${email}`)}`);
  assert(anonymousCommissions.status === 401, 'anonymous cannot read admin commission pages');
  const noAgency = await read(`/api/transport/panel/affiliates?agencyId=${agency.id}`, token);
  assert(noAgency.status === 403, 'individual cannot read agency before membership');
  const noAgencyPayout = await read(`/api/affiliates/payout?agencyId=${agency.id}`, token);
  assert(noAgencyPayout.status === 403, 'individual cannot read agency payout details');

  const { data: membership, error: memberError } = await db.from('transport_agency_users')
    .insert({ agency_id: agency.id, user_id: userId, email, role: 'owner' }).select('id').single();
  if (memberError || !membership) throw memberError || new Error('Could not create QA membership');
  membershipId = membership.id;
  const summary = await read(`/api/transport/panel/affiliates?agencyId=${agency.id}&summary=1`, token);
  assert(summary.status === 200 && summary.body.enabled === true, 'agency owner sees referral tab');
  const agencyView = await read(`/api/transport/panel/affiliates?agencyId=${agency.id}`, token);
  assert(agencyView.status === 200 && agencyView.body.codes?.every((item) => item.code === 'DELIVERYDEMO'),
    'agency sees only agency codes');
  const agencyPayout = await read(`/api/affiliates/payout?agencyId=${agency.id}`, token);
  assert(agencyPayout.status === 200, 'agency owner can read agency payout details');
  const otherAgency = await read(`/api/transport/panel/affiliates?agencyId=${randomUUID()}`, token);
  assert(otherAgency.status === 403, 'agency owner cannot read another agency');
  const { error: roleError } = await db.from('transport_agency_users').update({ role: 'operator' }).eq('id', membershipId);
  if (roleError) throw roleError;
  const operator = await read(`/api/transport/panel/affiliates?agencyId=${agency.id}`, token);
  assert(operator.status === 403, 'agency operator cannot read referral earnings');
  const operatorPayout = await read(`/api/affiliates/payout?agencyId=${agency.id}`, token);
  assert(operatorPayout.status === 403, 'agency operator cannot read payout details');

  const creator = await read('/api/affiliate-code?code=CREADORDEMO');
  assert(creator.status === 200 && creator.body.dueUsd === 10, 'creator discount is USD 10');
  const delivery = await read('/api/affiliate-code?code=DELIVERYDEMO');
  assert(delivery.status === 200 && delivery.body.dueUsd === 5, 'delivery discount is USD 5');
  const noAuth = await read('/api/affiliates/me');
  assert(noAuth.status === 401, 'anonymous cannot read affiliate earnings');
  const noAuthPayout = await read('/api/affiliates/payout');
  assert(noAuthPayout.status === 401, 'anonymous cannot read payout details');

  passed = true;
} finally {
  const { error: payoutError } = await db.from('affiliate_payout_accounts').delete().eq('beneficiary_email', email);
  if (payoutError) throw payoutError;
  if (membershipId) {
    const { error } = await db.from('transport_agency_users').delete().eq('id', membershipId);
    if (error) throw error;
  }
  if (codeId) {
    const { error } = await db.from('affiliate_codes').delete().eq('id', codeId);
    if (error) throw error;
  }
  if (userId) {
    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
  await publicAuth.auth.signOut({ scope: 'local' }).catch(() => {});
}
if (passed) process.stdout.write(JSON.stringify({ stage: keys.ref, checks, temporaryAccessRemoved: true }) + '\n');
