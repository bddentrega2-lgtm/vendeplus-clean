import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { chromium } from 'playwright';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const keys = JSON.parse(Buffer.concat(chunks).toString('utf8'));
if (keys.ref !== 'xpqmmdmixpyqruykkbkf') throw new Error('Only isolated staging is allowed');
for (const [key, role] of [[keys.anon, 'anon'], [keys.service, 'service_role']]) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  if (claims.ref !== keys.ref || claims.role !== role) throw new Error('Wrong staging credential');
}
const base = 'http://127.0.0.1:3107';
const db = createClient(`https://${keys.ref}.supabase.co`, keys.service, { auth: { persistSession: false } });
const runId = randomBytes(5).toString('hex');
const report = { runId, stage: keys.ref, base, startedAt: new Date().toISOString(), scenarios: [], blockers: [], cleaned: false };
const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#007a69' } }).png().toBuffer();
const sessions = [];
const fixtures = [];
let current;
let admin;
const cents = (value) => Math.round(Number(value) * 100);
function check(condition, label) {
  if (!condition) throw new Error(label);
  current?.checks.push(label);
}
async function query(builder) {
  const result = await builder;
  if (result.error) throw new Error(`${result.error.code || ''} ${result.error.message}`);
  return result.data;
}
async function http(path, { token, method = 'GET', body, status = 200, ip } = {}) {
  const headers = { 'x-forwarded-for': ip || `qa-ref-${runId}-${current?.number || 0}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60_000) });
  const result = await response.json().catch(() => ({}));
  if (status !== null && response.status !== status) throw new Error(`${method} ${path} expected ${status}, received ${response.status}: ${result.error || JSON.stringify(result)}`);
  return { status: response.status, body: result };
}
async function login(email) {
  const { properties } = await query(db.auth.admin.generateLink({ type: 'magiclink', email }));
  const client = createClient(`https://${keys.ref}.supabase.co`, keys.anon, { auth: { persistSession: false } });
  const data = await query(client.auth.verifyOtp({ type: 'magiclink', token_hash: properties.hashed_token }));
  sessions.push(client);
  return data.session.access_token;
}
async function setupAlly(fixture, spec) {
  if (spec.direct) return;
  const email = `qa-ref-${runId}-${spec.number}-ally@example.invalid`;
  const { user } = await query(db.auth.admin.createUser({ email, email_confirm: true }));
  fixture.allyUser = user.id;
  fixture.allyEmail = email;
  fixture.allyToken = await login(email);
  if (spec.type === 'delivery') {
    const agency = await query(db.from('transport_agencies').insert({ name: `QA Referidos ${runId}`, slug: `qa-ref-${runId}`, contact_name: 'QA', contact_email: email, contact_phone: '584120000000' }).select('id').single());
    fixture.agencyId = agency.id;
    await query(db.from('transport_agency_users').insert({ agency_id: agency.id, user_id: user.id, email, role: 'owner' }));
  }
  const { body } = await http('/api/admin/affiliates', { token: admin, method: 'POST', status: 201, body: {
    code: `QA${runId.toUpperCase()}${spec.number}`, name: `QA aliado ${spec.number}`, partnerType: spec.type || 'seller',
    beneficiaryEmail: fixture.agencyId ? '' : email, transportAgencyId: fixture.agencyId || '',
    discountPercent: spec.discount, setupCommissionPercent: spec.setup, commissionPercent: spec.fee, durationMonths: spec.months,
  } });
  fixture.code = body.code;
  const preview = await http(`/api/affiliate-code?code=${fixture.code.code}`);
  check(cents(preview.body.dueUsd) === cents(20 * (1 - spec.discount / 100)), 'Referral link uses server price');
  const linkPage = await fetch(`${base}/registro?ref=${fixture.code.code}`);
  check(linkPage.status === 200, 'Referral registration page opens');
}
async function register(fixture, spec, cityId) {
  const form = new FormData();
  const fields = {
    storeName: `QA Referidos ${runId} ${spec.number}`, representativeName: 'Operador QA', representativeIdNumber: 'V12345678',
    email: `qa-ref-${runId}-${spec.number}@example.invalid`, whatsapp: `58412000${String(spec.number).padStart(4, '0')}`,
    businessType: 'food', cityId, weeklyOrderVolume: 'starting', referralCode: fixture.code?.code || '',
    setupDueUsd: '0', setupCommissionPercent: '100',
  };
  fixture.email = fields.email;
  fixture.phone = fields.whatsapp;
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set('logo', new Blob([image], { type: 'image/png' }), 'qa.png');
  const { body } = await http('/api/signup', { method: 'POST', body: form, status: 201 });
  fixture.requestId = body.request.id;
  fixture.requestCode = body.request.request_code;
  fixture.dueUsd = spec.direct ? 20 : 20 * (1 - spec.discount / 100);
  check(cents(body.request.setup_due_usd) === cents(fixture.dueUsd), 'Tampered initial amount is ignored');
  const request = await query(db.from('commerce_registration_requests').select('auth_user_id,store_id,logo_path,setup_payment_status').eq('id', fixture.requestId).single());
  fixture.logoPath = request.logo_path;
  check(!request.auth_user_id && !request.store_id && request.setup_payment_status === 'pending', 'No account or store before admin approval');
  await http('/api/admin/registration-requests', { method: 'PATCH', body: { id: fixture.requestId, action: 'approve' }, status: 401 });
  check(true, 'Anonymous registration cannot approve its own account');
  if (spec.number === 12) await independentWorkflowVisual(fixture);
}
async function independentWorkflowVisual(fixture) {
  const browser = await chromium.launch({ headless: true });
  await mkdir('tmp/referrals-independent-visual', { recursive: true });
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 850 } });
      try {
        const auth = await context.request.post(`${base}/api/auth/panel-session`, { data: { accessToken: admin } });
        check(auth.status() === 200, `Visual admin session ${width}`);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${base}/admin/solicitudes`, { waitUntil: 'networkidle' });
        const row = page.locator('article').filter({ hasText: fixture.requestCode });
        await row.waitFor();
        check(await row.getByRole('button', { name: 'Aprobar comercio', exact: true }).isEnabled(), `Unpaid merchant approve button enabled ${width}`);
        check(await row.getByRole('button', { name: 'Aprobar pago', exact: true }).isEnabled(), `Independent payment button enabled ${width}`);
        check(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `Requests fit at ${width}`);
        await page.screenshot({ path: `tmp/referrals-independent-visual/requests-${width}.png`, fullPage: true });
        await page.goto(`${base}/admin/aliados`, { waitUntil: 'networkidle' });
        await page.getByRole('textbox', { name: 'Buscar aliado' }).fill(fixture.code.code);
        await page.locator('section[aria-label="Lista de aliados"]').getByRole('button', { expanded: false }).click();
        await page.getByRole('button', { name: `Mensaje de bienvenida ${fixture.code.code}`, exact: true }).click();
        const message = await page.getByRole('textbox', { name: 'Mensaje para el aliado' }).inputValue();
        check(message.includes(fixture.allyEmail) && message.includes(`/registro?ref=${fixture.code.code}`), `Welcome contains correct Google email and referral link ${width}`);
        const share = await page.getByRole('link', { name: 'Compartir por WhatsApp' }).getAttribute('href');
        check(new URL(share).searchParams.get('text') === message, `WhatsApp shares complete welcome ${width}`);
        check(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `Welcome fits at ${width}`);
        check(errors.length === 0, `No UI errors at ${width}`);
        await page.screenshot({ path: `tmp/referrals-independent-visual/welcome-${width}.png`, fullPage: true });
        await context.request.delete(`${base}/api/auth/panel-session`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
async function initialPayment(fixture, spec) {
  if (spec.approveFirst) {
    const early = await http('/api/admin/registration-requests', { token: admin, method: 'PATCH', body: { id: fixture.requestId, action: 'approve' } });
    fixture.storeId = early.body.request.store_id;
    const state = await query(db.from('commerce_registration_requests').select('auth_user_id,setup_paid_usd,setup_payment_status,status').eq('id', fixture.requestId).single());
    fixture.merchantUser = state.auth_user_id;
    const store = await query(db.from('stores').select('logo_url').eq('id', fixture.storeId).single());
    fixture.publicLogoPath = store.logo_url?.split('/product-images/')[1];
    check(state.status === 'approved' && state.setup_payment_status === 'pending' && state.setup_paid_usd === null, 'Access approval never invents income');
    const commissions = await query(db.from('affiliate_commissions').select('id').eq('store_id', fixture.storeId));
    check(commissions.length === 0, 'No commission for an unpaid approved merchant');
    const pending = await http(`/api/admin/registration-requests?status=payment_pending&search=${fixture.requestCode}`, { token: admin });
    check(pending.body.requests.some((row) => row.id === fixture.requestId) === (fixture.dueUsd > 0), 'Payment filter finds approved unpaid merchants and excludes zero totals');
  }
  if (spec.legacy) {
    await query(db.from('commerce_registration_requests').update({ setup_payment_status: 'legacy' }).eq('id', fixture.requestId));
    fixture.dueUsd = 0;
    await http('/api/admin/registration-requests', { token: admin, method: 'PATCH', status: 409,
      body: { id: fixture.requestId, action: 'confirm_payment', reference: 'QA-LEGACY', paidUsd: 20 } });
    check(true, 'Prior registration cannot be charged a new initial payment');
  } else if (fixture.dueUsd > 0) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ requestCode: fixture.requestCode, email: fixture.email, whatsapp: fixture.phone, reference: `QA-${runId}` })) form.set(key, value);
    form.set('proof', new Blob([image], { type: 'image/png' }), 'qa-proof.png');
    if (!spec.whatsappPayment) await http('/api/signup/payment', { method: 'POST', body: form });
    if (spec.retry) {
      if (!spec.whatsappPayment) await http('/api/signup/payment', { method: 'POST', body: form, status: 409 });
      await http('/api/admin/registration-requests', { token: admin, method: 'PATCH', body: { id: fixture.requestId, action: 'confirm_payment', paidUsd: fixture.dueUsd - 1 }, status: 400 });
    }
    const confirmation = { id: fixture.requestId, action: 'confirm_payment', reference: `QA-${runId}`, paidUsd: fixture.dueUsd };
    if (spec.approveFirst && spec.retry) {
      const responses = await Promise.all([1, 2].map(() => http('/api/admin/registration-requests', { token: admin, method: 'PATCH', body: confirmation, status: null })));
      check(responses.map((r) => r.status).sort().join(',') === '200,409', 'Concurrent payment confirmation records income only once');
    } else await http('/api/admin/registration-requests', { token: admin, method: 'PATCH', body: confirmation });
    const paid = await query(db.from('commerce_registration_requests').select('setup_paid_usd,setup_payment_status,status').eq('id', fixture.requestId).single());
    check(cents(paid.setup_paid_usd) === cents(fixture.dueUsd) && paid.setup_payment_status === 'confirmed', 'Verified receipt stores exact amount');
    if (!spec.approveFirst) check(paid.status === 'pending', 'Confirming payment does not approve the merchant');
  } else {
    await http('/api/admin/registration-requests', { token: admin, method: 'PATCH', body: { id: fixture.requestId, action: 'waive_payment' } });
  }
  if (spec.freeze) await http('/api/admin/affiliates', { token: admin, method: 'PATCH', body: { id: fixture.code.id, discountPercent: 90, setupCommissionPercent: 10, commissionPercent: 10, durationMonths: 1 } });
  const approval = await http('/api/admin/registration-requests', { token: admin, method: 'PATCH', body: { id: fixture.requestId, action: 'approve' } });
  fixture.storeId = approval.body.request.store_id;
  const registration = await query(db.from('commerce_registration_requests').select('auth_user_id,setup_payment_proof_path').eq('id', fixture.requestId).single());
  if (spec.legacy) {
    const payment = await query(db.from('commerce_registration_requests').select('setup_payment_status,setup_paid_usd').eq('id', fixture.requestId).single());
    check(payment.setup_payment_status === 'legacy' && payment.setup_paid_usd === null, 'Prior registration approved without inventing a collected payment');
  }
  fixture.merchantUser = registration.auth_user_id;
  fixture.proofPath = registration.setup_payment_proof_path;
  fixture.merchantToken = await login(fixture.email);
  const store = await query(db.from('stores').select('plan_type,logo_url').eq('id', fixture.storeId).single());
  fixture.publicLogoPath = store.logo_url?.split('/product-images/')[1];
  check(store.plan_type === 'trial', 'Approved merchant starts in trial');
  if (spec.retry) {
    await http('/api/admin/registration-requests', { token: admin, method: 'PATCH', body: { id: fixture.requestId, action: 'approve' } });
    await http('/api/admin/registration-requests', { token: admin, method: 'PATCH', body: { id: fixture.requestId, action: 'confirm_payment', paidUsd: fixture.dueUsd }, status: 409 });
    check(true, 'Initial confirmation and approval cannot duplicate earnings');
  }
  await query(db.from('stores').update({ marketplace_visible: false, manual_open_status: 'open', request_customer_id_number: false, payment_proof_required: false, payment_methods: ['Efectivo'], payment_proof_mode: 'disabled' }).eq('id', fixture.storeId));
  const product = await query(db.from('products').insert({ store_id: fixture.storeId, name: 'Producto QA', price_usd: 2, is_available: true }).select('id').single());
  fixture.productId = product.id;
  const commissions = await query(db.from('affiliate_commissions').select('amount_usd').eq('store_id', fixture.storeId).eq('kind', 'setup'));
  fixture.expectedSetup = spec.direct ? 0 : Math.round(fixture.dueUsd * spec.setup) / 100;
  check(commissions.length === (fixture.expectedSetup > 0 ? 1 : 0), 'Exactly one setup commission after approval and collection, or none when ineligible');
  check(cents(commissions.reduce((sum, row) => sum + Number(row.amount_usd), 0)) === cents(fixture.expectedSetup), 'Initial commission uses confirmed discounted payment');
  if (fixture.code) {
    const referral = await query(db.from('affiliate_referrals').select('*').eq('registration_request_id', fixture.requestId).single());
    check(!referral.fee_started_at, 'Fee commission window has not started during trial');
    check(Number(referral.commission_percent) === spec.fee && Number(referral.duration_months) === spec.months, 'Original referral terms remain frozen');
  }
  current.emailDelivery = approval.body.emailSent ? 'SMTP accepted test address; inbox not verified' : 'Test address email unavailable; account approval succeeded';
}
async function order(fixture, { manual = false, cancelled = false, trial = false, createdAt } = {}) {
  const idempotencyKey = randomUUID();
  const item = { productId: fixture.productId, quantity: 1, priceUsd: 0.01, name: 'Tampered', selectedOptions: [] };
  const body = manual ? { storeId: fixture.storeId, idempotencyKey, customerName: 'QA Cliente', customerPhone: fixture.phone, deliveryType: 'pickup', paymentMethod: 'Efectivo', items: [item] }
    : { storeId: fixture.storeId, idempotencyKey, order: { items: [item], form: { customerName: 'QA Cliente', customerPhone: fixture.phone, deliveryType: 'pickup', paymentMethod: 'Efectivo', notes: 'Simulacion referidos' }, quote: {}, totals: { totalUsd: 0.01 } } };
  const response = await http(manual ? '/api/panel/orders' : '/api/orders', { token: manual ? fixture.merchantToken : undefined, method: 'POST', body });
  const orderId = response.body.orderId || response.body.order?.id;
  check(Boolean(orderId), 'Order persisted through order API');
  if (createdAt) await query(db.from('orders').update({ created_at: createdAt }).eq('id', orderId));
  if (cancelled) await http('/api/panel/orders', { token: fixture.merchantToken, method: 'PATCH', body: { id: orderId, status: 'cancelled', cancellationReason: 'Otro', cancellationDetail: 'Prueba de referido' } });
  const row = await query(db.from('orders').select('platform_service_fee_usd,subtotal_usd,status').eq('id', orderId).single());
  check(cents(row.platform_service_fee_usd) === (manual || trial ? 0 : 10), 'Order fee matches modality and plan');
  check(cents(row.subtotal_usd) === 200, 'Server recalculates product amount');
  return orderId;
}
async function activate(fixture, spec) {
  if (spec.expired) {
    fixture.windowStart = new Date(Date.now() - 62 * 86400_000).toISOString();
    await query(db.rpc('activate_affiliate_fee_window', { p_store_id: fixture.storeId, p_at: fixture.windowStart }));
  }
  await http('/api/panel/subscription-payments', { token: fixture.merchantToken, method: 'POST', body: { storeId: fixture.storeId, action: 'choose_plan', planId: 'per_service', serviceFeePayer: 'merchant' } });
  if (spec.expired) await query(db.from('stores').update({ subscription_started_at: fixture.windowStart }).eq('id', fixture.storeId));
  if (fixture.code) {
    const referral = await query(db.from('affiliate_referrals').select('fee_started_at,fee_ends_at').eq('registration_request_id', fixture.requestId).single());
    check(Boolean(referral.fee_started_at), 'Fee activation starts the commission window');
    fixture.initialWindow = referral.fee_started_at;
  }
}
async function feePayment(fixture, spec) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ storeId: fixture.storeId, paymentReference: `QA-FEE-${runId}-${spec.number}`, paymentBank: 'Banco QA', paidAt: new Date().toISOString().slice(0, 10) })) form.set(key, value);
  form.set('proof', new Blob([image], { type: 'image/png' }), 'qa-fee.png');
  let payment = (await http('/api/panel/subscription-payments', { token: fixture.merchantToken, method: 'POST', body: form })).body.payment;
  check(cents(payment.amount_usd) === spec.orders * 10, 'Merchant fee statement counts charged orders including cancelled');
  check((await query(db.from('affiliate_commissions').select('id').eq('store_id', fixture.storeId).eq('kind', 'fee'))).length === 0, 'Reported fee is not earned until SOMOS confirms collection');
  if (spec.rejectFee) {
    await http('/api/admin/subscription-payments', { token: admin, method: 'PATCH', body: { paymentId: payment.id, action: 'reject' } });
    check((await query(db.from('affiliate_commissions').select('id').eq('store_id', fixture.storeId).eq('kind', 'fee'))).length === 0, 'Rejected fee payment creates no affiliate earnings');
    payment = (await http('/api/panel/subscription-payments', { token: fixture.merchantToken, method: 'POST', body: form })).body.payment;
  }
  await http('/api/admin/subscription-payments', { token: admin, method: 'PATCH', body: { paymentId: payment.id, action: 'approve' } });
  if (spec.retry) {
    const retry = await http('/api/admin/subscription-payments', { token: admin, method: 'PATCH', body: { paymentId: payment.id, action: 'approve' }, status: null });
    check(retry.status >= 400, 'Repeated fee approval is rejected');
  }
  const balance = await http(`/api/panel/subscription-payments?storeId=${fixture.storeId}`, { token: fixture.merchantToken });
  check(cents(balance.body.serviceUsageByStore?.[fixture.storeId]?.amountUsd) === 0, 'Merchant fee balance returns to zero after approval');
  if (fixture.code) {
    const referral = await query(db.from('affiliate_referrals').select('fee_started_at').eq('registration_request_id', fixture.requestId).single());
    check(referral.fee_started_at === fixture.initialWindow, 'Paying fee never restarts the commission period');
  }
}
async function settle(fixture, spec) {
  const feeOrders = spec.expired ? 2 : spec.orders;
  fixture.expectedFee = spec.direct ? 0 : feeOrders * Math.round(10 * spec.fee / 100) / 100;
  const commissions = await query(db.from('affiliate_commissions').select('id,kind,amount_usd,status').eq('store_id', fixture.storeId));
  check(cents(commissions.filter((item) => item.kind === 'fee').reduce((sum, row) => sum + Number(row.amount_usd), 0)) === cents(fixture.expectedFee), 'Fee commission equals collected eligible orders');
  if (spec.direct) {
    check(!commissions.length, 'Direct registration sends all revenue to SOMOS');
    return;
  }
  const dashboardPath = fixture.agencyId ? `/api/transport/panel/affiliates?agencyId=${fixture.agencyId}` : '/api/affiliates/me';
  const before = (await http(dashboardPath, { token: fixture.allyToken })).body;
  check(!before.demo && before.stores.length === 1, 'Real ally dashboard reads generated records, not demo fixtures');
  check(cents(before.stores[0].setupPendingUsd) === cents(fixture.expectedSetup) && cents(before.stores[0].feePendingUsd) === cents(fixture.expectedFee), 'Ally dashboard agrees with expected pending balance');
  const adminBefore = (await http('/api/admin/affiliates', { token: admin })).body;
  const summary = adminBefore.balances.find((entry) => entry.codes.includes(fixture.code.code));
  check(summary?.commerceCount === 1 && cents(summary.setupPendingUsd) === cents(fixture.expectedSetup) && cents(summary.feePendingUsd) === cents(fixture.expectedFee), 'Admin aggregate agrees with ally dashboard');
  const accessible = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page++) {
    const detail = (await http(`/api/admin/affiliates/commissions?allyKey=${encodeURIComponent(summary.allyKey)}&page=${page}`, { token: admin })).body;
    totalPages = detail.pagination.totalPages;
    accessible.push(...detail.commissions);
    check(detail.commissions.length <= 100 && detail.commissions.every((row) => row.codeId === fixture.code.id), 'Commission page is bounded and belongs only to the selected ally');
  }
  const accessibleIds = new Set(accessible.map((row) => row.id));
  check(accessible.length === accessibleIds.size && accessible.length === commissions.length && commissions.every((row) => accessibleIds.has(row.id)), 'All payable commissions are reachable once, including older history');
  current.commissionPages = totalPages;
  if (spec.volume) await checkPaginationUi(fixture, totalPages);
  const payout = { holderName: 'Operador QA', bankName: 'Banco QA', documentNumber: 'V12345678', phone: '04120000000' };
  await http(`/api/affiliates/payout${fixture.agencyId ? `?agencyId=${fixture.agencyId}` : ''}`, { token: fixture.allyToken, method: 'PUT', body: payout });
  for (let start = 0; start < accessible.length; start += 100) {
    const ids = accessible.slice(start, start + 100).map((row) => row.id);
    const body = { commissionIds: ids, paidAt: new Date().toISOString().slice(0, 10), method: 'Pago Movil QA', reference: `QA-${runId}-${spec.number}-${start}` };
    await http('/api/admin/affiliates/settlements', { token: admin, method: 'POST', body });
    if (spec.retry) await http('/api/admin/affiliates/settlements', { token: admin, method: 'POST', body, status: 409 });
  }
  const after = (await http(dashboardPath, { token: fixture.allyToken })).body;
  const final = after.stores[0];
  check(cents(final.setupPendingUsd) === 0 && cents(final.feePendingUsd) === 0 && cents(final.setupPaidUsd) === cents(fixture.expectedSetup) && cents(final.feePaidUsd) === cents(fixture.expectedFee), 'Settlement moves exact amounts from pending to paid');
  const adminAfter = (await http('/api/admin/affiliates', { token: admin })).body.balances.find((entry) => entry.codes.includes(fixture.code.code));
  check(cents(adminAfter.setupPaidUsd) === cents(fixture.expectedSetup) && cents(adminAfter.feePaidUsd) === cents(fixture.expectedFee) && adminAfter.feePaidCount === feeOrders, 'Admin paid amounts and order counts match settlement');
  const empty = (await http(`/api/admin/affiliates/commissions?allyKey=${encodeURIComponent(summary.allyKey)}`, { token: admin })).body;
  check(empty.commissions.length === 0 && empty.pagination.total === 0, 'Liquidated commissions disappear from payable pages');
}
async function checkPaginationUi(fixture, totalPages) {
  await mkdir('tmp/referrals-v2-journeys/visual', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 850 } });
      try {
        const session = await context.request.post(`${base}/api/auth/panel-session`, { data: { accessToken: admin } });
        check(session.status() === 200, 'Admin browser session established');
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${base}/admin/aliados`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('textbox', { name: 'Buscar aliado' }).fill(fixture.code.code);
        const list = page.locator('section[aria-label="Lista de aliados"]');
        await list.getByRole('button', { expanded: false }).first().click();
        await page.getByText(`Pagina 1 de ${totalPages}`, { exact: false }).waitFor({ timeout: 20_000 });
        check(await list.getByRole('checkbox').count() === 100, 'Browser displays exactly one page of commissions');
        await list.getByRole('checkbox').first().check();
        check(await page.getByRole('button', { name: /^Liquidar US\$/ }).isEnabled(), 'Selecting a commission enables liquidation');
        for (let number = 2; number <= totalPages; number++) {
          await page.getByRole('button', { name: 'Pagina siguiente de comisiones' }).click();
          await page.getByText(`Pagina ${number} de ${totalPages}`, { exact: false }).waitFor();
          check(await page.getByRole('button', { name: 'Liquidar US$0.00', exact: true }).isDisabled(), 'Page navigation clears prior selection');
        }
        check(await list.getByRole('checkbox').count() === 11, 'Browser reaches the eleven oldest previously inaccessible commissions');
        check(!await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `No horizontal overflow at ${width}px`);
        check(errors.length === 0, `No browser errors at ${width}px`);
        await page.getByRole('button', { name: 'Pagina anterior de comisiones' }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `tmp/referrals-v2-journeys/visual/pagination-${width}.png` });
        await context.request.delete(`${base}/api/auth/panel-session`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
async function cleanup(f) {
  if (f.storeId) {
    const payments = await query(db.from('store_subscription_payments').select('proof_url').eq('store_id', f.storeId));
    const paths = payments.map((p) => p.proof_url).filter(Boolean);
    if (paths.length) await query(db.storage.from('subscription-receipts').remove(paths));
    const commissions = await query(db.from('affiliate_commissions').select('id').eq('store_id', f.storeId));
    const ids = commissions.map((row) => row.id);
    for (let start = 0; start < ids.length; start += 100) {
      await query(db.from('affiliate_settlement_items').delete().in('commission_id', ids.slice(start, start + 100)));
      await query(db.from('affiliate_commission_adjustments').delete().in('commission_id', ids.slice(start, start + 100)));
    }
    await query(db.from('affiliate_commissions').delete().eq('store_id', f.storeId));
    if (f.code) await query(db.from('affiliate_settlements').delete().eq('affiliate_code_id', f.code.id));
    const orders = await query(db.from('orders').select('id').eq('store_id', f.storeId));
    for (let start = 0; start < orders.length; start += 100) await query(db.from('affiliate_fee_allocations').delete().in('order_id', orders.slice(start, start + 100).map((row) => row.id)));
  }
  if (f.requestId) {
    await query(db.from('affiliate_referrals').delete().eq('registration_request_id', f.requestId));
    const request = await query(db.from('commerce_registration_requests').select('logo_path,setup_payment_proof_path,auth_user_id,store_id').eq('id', f.requestId).maybeSingle());
    if (request) {
      f.merchantUser ||= request.auth_user_id;
      f.storeId ||= request.store_id;
      const paths = [request.logo_path, request.setup_payment_proof_path].filter(Boolean);
      if (paths.length) await query(db.storage.from('commerce-registration-assets').remove(paths));
    }
    await query(db.from('commerce_registration_requests').delete().eq('id', f.requestId));
  }
  if (f.storeId) {
    await query(db.from('store_subscription_payments').delete().eq('store_id', f.storeId));
    await query(db.from('orders').delete().eq('store_id', f.storeId));
    await query(db.from('stores').delete().eq('id', f.storeId));
  }
  if (f.publicLogoPath) await query(db.storage.from('product-images').remove([f.publicLogoPath]));
  if (f.code) await query(db.from('affiliate_codes').delete().eq('id', f.code.id));
  if (f.allyEmail) await query(db.from('affiliate_payout_accounts').delete().eq('beneficiary_email', f.allyEmail));
  if (f.agencyId) {
    await query(db.from('affiliate_payout_accounts').delete().eq('transport_agency_id', f.agencyId));
    await query(db.from('transport_agency_users').delete().eq('agency_id', f.agencyId));
    await query(db.from('transport_agencies').delete().eq('id', f.agencyId));
  }
  if (f.merchantUser) await query(db.auth.admin.deleteUser(f.merchantUser));
  if (f.allyUser) await query(db.auth.admin.deleteUser(f.allyUser));
  f.cleaned = true;
}

const cases = [
  { number: 1, name: 'Vendedor: US$15 inicial y 50% del fee por 3 meses', discount: 0, setup: 75, fee: 50, months: 3, orders: 10 },
  { number: 2, name: 'Creador: 50% descuento y 100% del pago inicial', type: 'creator', discount: 50, setup: 100, fee: 50, months: 1, orders: 12 },
  { number: 3, name: 'Delivery: 75% descuento, cobro desde panel de empresa', type: 'delivery', discount: 75, setup: 50, fee: 30, months: 2, orders: 15 },
  { number: 4, name: 'Registro directo: sin comision de referido', direct: true, orders: 10 },
  { number: 5, name: 'Exoneracion completa: solo comision del fee', discount: 100, setup: 100, fee: 50, months: 3, orders: 10 },
  { number: 6, name: 'Prueba gratis, pedidos manuales y cancelados', discount: 25, setup: 50, fee: 50, months: 2, orders: 10, modalities: true },
  { number: 7, name: 'Comprobante en revision, pago rechazado y luego aprobado', discount: 0, setup: 75, fee: 50, months: 3, orders: 10, rejectFee: true },
  { number: 8, name: 'Reintentos: sin duplicar suscripcion, fee ni liquidacion', discount: 50, setup: 100, fee: 50, months: 1, orders: 10, retry: true },
  { number: 9, name: 'Condiciones originales protegidas y 510 pedidos', discount: 0, setup: 75, fee: 50, months: 3, orders: 510, freeze: true, volume: true },
  { number: 10, name: 'Vencimiento: cobro tardio de pedidos elegibles', discount: 0, setup: 75, fee: 50, months: 1, orders: 10, expired: true },
  { number: 11, name: 'Registro anterior: aprobacion sin cobro retroactivo', direct: true, legacy: true, orders: 1 },
  { number: 12, name: 'Aprobar vendedor antes del pago por WhatsApp, confirmacion simultanea', discount: 0, setup: 75, fee: 50, months: 3, orders: 1, approveFirst: true, whatsappPayment: true, retry: true },
  { number: 13, name: 'Creador aprobado, comprobante posterior y descuento', type: 'creator', discount: 50, setup: 100, fee: 50, months: 1, orders: 1, approveFirst: true, retry: true },
  { number: 14, name: 'Directo aprobado antes del pago sin comision', direct: true, orders: 1, approveFirst: true, whatsappPayment: true },
  { number: 15, name: 'Exonerado aprobado primero sin ingreso ficticio', discount: 100, setup: 100, fee: 50, months: 1, orders: 1, approveFirst: true },
  { number: 16, name: 'Delivery pago primero, aprobacion despues', type: 'delivery', discount: 75, setup: 50, fee: 30, months: 2, orders: 1, whatsappPayment: true, retry: true },
];
try {
  admin = await login('preview-admin@somos.test');
  await http('/api/admin/affiliates', { token: admin });
  const buckets = await query(db.storage.listBuckets());
  if (!buckets.some((bucket) => bucket.id === 'product-images')) {
    await query(db.storage.createBucket('product-images', { public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] }));
    report.stagingSetup = 'Created missing public product-images bucket used by registration approval';
  }
  const cities = await query(db.from('service_cities').select('id').eq('is_active', true).limit(1));
  for (const spec of cases.filter((entry) => entry.number >= Number(process.env.SOMOS_REFERRAL_QA_START || 1))) {
    current = { number: spec.number, name: spec.name, checks: [], status: 'running' };
    report.scenarios.push(current);
    const fixture = { number: spec.number };
    fixtures.push(fixture);
    try {
      await setupAlly(fixture, spec);
      await register(fixture, spec, cities[0].id);
      await initialPayment(fixture, spec);
      if (spec.modalities) await order(fixture, { trial: true });
      await activate(fixture, spec);
      if (spec.modalities) await order(fixture, { manual: true });
      const publicCount = spec.volume ? 2 : spec.orders;
      for (let index = 0; index < publicCount; index++) {
        await order(fixture, { cancelled: spec.modalities && index < 4,
          createdAt: spec.expired && index < 2 ? new Date(Date.parse(fixture.windowStart) + (index + 1) * 86400_000).toISOString() : undefined });
      }
      if (spec.volume) {
        // Bulk load tests history limits; two orders above use the real API.
        const rows = Array.from({ length: spec.orders - publicCount }, (_, index) => ({
          store_id: fixture.storeId, public_code: `QA-${runId}-${index}`, customer_name: 'QA Volumen', customer_phone: fixture.phone,
          delivery_type: 'pickup', payment_method: 'Efectivo', status: 'received', platform_service_fee_usd: 0.1,
        }));
        for (let start = 0; start < rows.length; start += 100) await query(db.from('orders').insert(rows.slice(start, start + 100)));
      }
      await feePayment(fixture, spec);
      await settle(fixture, spec);
      current.initialPaidUsd = fixture.dueUsd;
      current.setupCommissionUsd = fixture.expectedSetup;
      current.feeCommissionUsd = fixture.expectedFee;
      current.orderCount = spec.orders;
      current.status = 'passed';
    } catch (error) {
      current.status = 'failed'; current.error = error.message;
      if (fixture.requestId) current.registrationDiagnostic = await query(db.from('commerce_registration_requests').select('status,activation_error,setup_payment_status').eq('id', fixture.requestId).maybeSingle());
    } finally {
      try { await cleanup(fixture); current.cleaned = true; }
      catch (error) { current.cleanupError = error.message; }
    }
    process.stdout.write(JSON.stringify({ number: current.number, status: current.status, checks: current.checks.length, error: current.error, cleanupError: current.cleanupError }) + '\n');
    await mkdir('tmp/referrals-v2-journeys', { recursive: true });
    await writeFile('tmp/referrals-v2-journeys/latest.json', JSON.stringify(report, null, 2));
    if (!fixture.cleaned || current.status === 'failed') break;
  }
} finally {
  for (const client of sessions) await client.auth.signOut({ scope: 'local' }).catch(() => {});
  report.cleaned = fixtures.every((fixture) => fixture.cleaned);
  report.finishedAt = new Date().toISOString();
  await mkdir('tmp/referrals-v2-journeys', { recursive: true });
  await writeFile('tmp/referrals-v2-journeys/latest.json', JSON.stringify(report, null, 2));
  await writeFile(`tmp/referrals-v2-journeys/${runId}.json`, JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ runId, passed: report.scenarios.filter((row) => row.status === 'passed').length, total: report.scenarios.length, blockers: report.blockers, cleaned: report.cleaned }) + '\n');
  if (!report.cleaned || report.scenarios.some((row) => row.status !== 'passed') || report.blockers.length) process.exitCode = 1;
}
