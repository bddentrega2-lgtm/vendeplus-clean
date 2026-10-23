import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const keys = JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, ''));
const ref = 'nmuypksuaxwyonilzoqs';
assert.equal(keys.ref, ref);
for (const [key, role] of [[keys.anon, 'anon'], [keys.service, 'service_role']]) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  assert.equal(claims.ref, ref);
  assert.equal(claims.role, role);
}
const dir = 'tmp/audit-staging-recovery';
const deployment = JSON.parse(await readFile(`${dir}/preview-deployment.json`, 'utf8'));
const access = JSON.parse(await readFile(`${dir}/access.json`, 'utf8'));
assert.equal(deployment.stage, ref);
assert.equal(access.ref, ref);
assert.match(deployment.url, /^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/);
const base = `https://${ref}.supabase.co`;
const storeId = '51000000-0000-4000-8000-000000000001';
const shopId = '51000000-0000-4000-8000-000000000002';
const checks = [];
async function request(url, { method = 'GET', headers = {}, body, expected = 200 } = {}) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const text = await response.text();
  const result = text ? JSON.parse(text) : null;
  assert.equal(response.status, expected, `${method} ${new URL(url).pathname}: ${text.slice(0, 250)}`);
  return result;
}
const db = (path, options = {}) => request(base + '/rest/v1/' + path, { ...options, headers: { apikey: keys.service, Authorization: `Bearer ${keys.service}`, Prefer: 'return=representation', ...options.headers } });
const anon = (path, expected = 200) => request(base + '/rest/v1/' + path, { headers: { apikey: keys.anon, Authorization: `Bearer ${keys.anon}` }, expected });
const account = access.accounts.find(a => a.role === 'commerce');
const session = await request(base + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: keys.anon }, body: { email: account.email, password: account.password } });
const panel = (path, scope = storeId, expected = 200) => request(deployment.url + path, { headers: { Authorization: `Bearer ${session.access_token}`, 'x-panel-store-id': scope }, expected });
const stores = await db('stores?select=id,slug,latitude,longitude');
assert.deepEqual(stores.map(s => s.slug).sort(), ['cocina-demo', 'tienda-demo']);
const store = stores.find(s => s.id === storeId);
assert.ok(store.latitude != null && store.longitude != null);
assert.equal((await db(`store_transport_agency_connections?store_id=eq.${storeId}&select=id`)).length, 0, 'Do not replace existing delivery connection');
const orders = await db(`orders?store_id=eq.${storeId}&select=id,store_id,customer_id,customer_phone,created_at,status,subtotal_usd,total_usd`);
const product = (await db(`products?store_id=eq.${storeId}&select=id,name,price_usd&limit=1`))[0];
assert.ok(product);
const marker = `QA-MATRIX-${randomUUID().slice(0, 8)}`;
const customerIds = Array.from({ length: 29 }, () => randomUUID());
const order = { id: randomUUID(), store_id: storeId, customer_id: customerIds[0], customer_phone: '00000009999', created_at: new Date().toISOString(), status: 'received', subtotal_usd: Number(product.price_usd), total_usd: Number(product.price_usd) };
const agencies = [randomUUID(), randomUUID()];
const connections = [randomUUID(), randomUUID()];
const snapshots = { orderCount: orders.length };
try {
  const rows = customerIds.map((id, i) => ({
    id, store_id: i === 28 ? shopId : storeId, name: `${marker}-${String(i).padStart(2, '0')}`,
    phone: i === 0 ? order.customer_phone : `0000000${String(i).padStart(4, '0')}`,
    phone_normalized: i === 0 ? order.customer_phone.replace(/\D/g, '') : `0000000${String(i).padStart(4, '0')}`,
    orders_count: i === 0 ? 3 : 1, total_spent_usd: i === 0 ? 30 : 10, average_ticket_usd: 10,
    last_order_id: null,
    last_order_at: new Date(Date.now() - i * 60000).toISOString(), preferred_fulfillment: i === 0 ? 'delivery' : 'pickup',
  }));
  await db('customers', { method: 'POST', body: rows, expected: 201 });
  await request(base + '/rest/v1/rpc/create_order_atomic', {
    method: 'POST', headers: { apikey: keys.service, Authorization: `Bearer ${keys.service}` },
    body: { p_order: { ...order, public_code: marker, idempotency_key: randomUUID(), customer_name: 'Synthetic QA', delivery_type: 'pickup', payment_method: 'Efectivo', payment_status: 'pending', platform_service_fee_usd: 0 },
      p_items: [{ product_id: product.id, product_name: product.name, quantity: 1, unit_price_usd: Number(product.price_usd), total_usd: Number(product.price_usd), options: [] }] },
  });
  orders.push(...await db(`orders?id=eq.${order.id}&select=id,store_id,customer_id,customer_phone,created_at,status,subtotal_usd,total_usd`));
  await db(`customers?id=in.(${[customerIds[0], customerIds[1], customerIds[28]].join(',')})`, { method: 'PATCH', body: { last_order_id: order.id } });
  const first = await panel(`/api/panel/customers?search=${marker}&limit=25&offset=0`);
  assert.equal(first.customers.length, 25);
  assert.equal(first.summary.total, 28);
  assert.equal(first.page.hasMore, true);
  assert.equal(first.customers.find(c => c.id === customerIds[0]).last_order?.id, order.id);
  assert.equal(first.customers.find(c => c.id === customerIds[1]).last_order, null, 'Same-store different customer leaked');
  const second = await panel(`/api/panel/customers?search=${marker}&limit=25&offset=25`);
  assert.equal(second.customers.length, 3);
  assert.equal(second.page.hasMore, false);
  assert.equal(new Set([...first.customers, ...second.customers].map(c => c.id)).size, 28);
  const shop = await panel(`/api/panel/customers?search=${marker}`, shopId);
  assert.equal(shop.customers.length, 1);
  assert.equal(shop.customers[0].last_order, null, 'Other store last order leaked');
  const frequent = await panel(`/api/panel/customers?search=${marker}&segment=frequent`);
  assert.deepEqual(frequent.customers.map(c => c.id), [customerIds[0]]);
  const fresh = await panel(`/api/panel/customers?search=${marker}&segment=new&limit=80`);
  assert.equal(fresh.customers.length, 27);
  await panel('/api/panel/customers', '51000000-0000-4000-8000-000000000099', 403);
  checks.push('Customers: 25+3 pagination, unique rows, search, new/frequent, tenant and identity isolation');
  console.log('PASS customer pagination and last-order isolation');

  for (const range of ['today', 'last_7_days', 'last_30_days', 'this_month', 'previous_month']) {
    const stats = await panel(`/api/panel/stats?range=${range}&storeId=${storeId}`);
    const expected = orders.filter(o => Date.parse(o.created_at) >= Date.parse(stats.range.start) && Date.parse(o.created_at) <= Date.parse(stats.range.end));
    assert.equal(stats.summary.totalOrders, expected.length, `Stats count ${range}`);
    const revenue = expected.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.subtotal_usd), 0);
    assert.ok(Math.abs(stats.summary.totalRevenueUsd - revenue) < 0.001, `Stats revenue ${range}`);
    const summary = await panel(`/api/panel/stats?mode=summary&range=${range}&storeId=${storeId}`);
    assert.equal(summary.summary.totalOrders, stats.summary.totalOrders);
    checks.push({ stats: range, count: expected.length, productValueUsd: revenue });
  }
  console.log('PASS statistics: five periods compared with saved orders, full vs summary');

  for (let i = 0; i < 2; i++) {
    const id = agencies[i];
    const visibility = i === 0 ? 'public' : 'private';
    await db('transport_agencies', { method: 'POST', expected: 201, body: {
      id, name: `${marker} ${visibility}`, slug: `${marker.toLowerCase()}-${visibility}`,
      contact_name: 'Synthetic QA', contact_email: 'qa@example.invalid', contact_phone: '00000000000',
      city: 'Demo', status: 'active', is_active: true, rates_visibility: visibility, pricing_type: 'flat', admin_notes: 'INTERNAL-QA-NOT-PUBLIC',
    } });
    await db('transport_agency_rates', { method: 'POST', expected: 201, body: { agency_id: id, flat_fee_usd: i + 2, max_distance_km: 100 } });
    assert.equal((await anon(`transport_agencies?id=eq.${id}&select=id,name,slug`)).length, 1);
    await anon(`transport_agencies?id=eq.${id}&select=admin_notes`, 401);
    assert.equal((await anon(`transport_agency_rates?agency_id=eq.${id}&select=flat_fee_usd`)).length, i === 0 ? 1 : 0);
    await db('store_transport_agency_connections', { method: 'POST', expected: 201, body: { id: connections[i], store_id: storeId, agency_id: id, status: 'active', is_default: true } });
    const quoted = await request(deployment.url + '/api/delivery/quote', { method: 'POST', body: { storeId, latitude: Number(store.latitude), longitude: Number(store.longitude), subtotalUsd: 10 } });
    assert.equal(quoted.ok, true);
    assert.equal(quoted.quote.available, true);
    assert.equal(quoted.quote.feeUsd, i + 2);
    assert.ok(quoted.quote.quoteToken);
    assert.ok(!JSON.stringify(quoted).includes('INTERNAL-QA-NOT-PUBLIC'));
    await db(`store_transport_agency_connections?id=eq.${connections[i]}`, { method: 'DELETE' });
    checks.push({ agency: visibility, quoteUsd: quoted.quote.feeUsd, privateColumnsBlocked: true });
    console.log(`PASS ${visibility} agency: directory, privacy and server-side quote`);
  }
} finally {
  // Remove only UUIDs created by this run; never touch demo orders or original settings.
  for (const id of connections) await db(`store_transport_agency_connections?id=eq.${id}`, { method: 'DELETE' });
  for (const id of agencies) {
    await db(`transport_agency_rates?agency_id=eq.${id}`, { method: 'DELETE' });
    await db(`transport_agencies?id=eq.${id}`, { method: 'DELETE' });
  }
  await db(`orders?id=eq.${order.id}`, { method: 'DELETE' });
  await db(`customers?id=in.(${customerIds.join(',')})`, { method: 'DELETE' });
  assert.equal((await db(`orders?store_id=eq.${storeId}&select=id`)).length, snapshots.orderCount);
  await writeFile(`${dir}/matrix-progress.json`, JSON.stringify({ checks, fixturesRemoved: true }, null, 2));
}
await writeFile(`${dir}/matrix-result.json`, JSON.stringify({ passed: true, checks, fixturesRemoved: true }, null, 2));
console.log('PASS audit HTTP matrix; all temporary fixtures removed');
