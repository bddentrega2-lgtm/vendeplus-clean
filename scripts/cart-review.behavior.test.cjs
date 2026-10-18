const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
test('cart stays instant; checkout alone performs the preflight review', () => {
  const cartPage = fs.readFileSync(path.join(root, 'src/components/public/CartPageClient.tsx'), 'utf8');
  const checkout = fs.readFileSync(path.join(root, 'src/components/public/CheckoutForm.tsx'), 'utf8');
  assert.doesNotMatch(cartPage, /useCartReview|CartReviewNotice|cart-review/);
  assert.match(checkout, /useCartReview/);
  assert.match(checkout, /CartReviewNotice/);
});
function load(file, deps = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (name in deps) return deps[name];
    throw new Error(`Unexpected dependency ${name}`);
  }, console, URL, Response, Request, setTimeout, clearTimeout });
  return module.exports;
}
const pure = load('src/lib/cart-review.ts');
const server = load('src/lib/server/cart-review.ts', { '@/lib/cart-review': pure });
const pid = '11111111-1111-4111-8111-111111111111';
const vid = '22222222-2222-4222-8222-222222222222';
const item = { productId: pid, productName: 'Promo', productSlug: 'promo', productImageUrl: '', quantity: 2, unitPriceUsd: 5.99, notes: 'Sin salsa' };
const product = { id: pid, name: 'Promo', price_usd: 5.99, discount_percent: 0, is_available: true };
const option = { groupId: 'g', groupName: 'Extras', valueId: 'v', valueName: 'Queso', priceDeltaUsd: 1 };
const assignment = { product_id: pid, product_option_groups: { id: 'g', name: 'Extras', required: false, selection_type: 'multiple', max_select: 5, is_active: true, product_option_values: [{ id: 'v', name: 'Queso', price_delta_usd: 1, is_active: true }] } };
const clone = value => JSON.parse(JSON.stringify(value));
function review(i = item, p = product, variants = [], assignments = []) { return pure.reviewCartRows([i], p ? [p] : [], variants, assignments); }

test('unchanged product retains quantity and notes without mutating source', () => {
  const result = review(); assert.equal(result.issues.length, 0); assert.equal(result.items[0].quantity, 2); assert.equal(result.items[0].notes, 'Sin salsa'); assert.equal(item.unitPriceUsd, 5.99);
});
test('deleted or other-store product is unavailable without substitution', () => {
  const result = review(item, null); assert.equal(result.issues[0].kind, 'unavailable'); assert.equal(result.items[0].productId, pid);
});
test('hidden product cannot be purchased', () => assert.equal(review(item, { ...product, is_available: false }).issues[0].kind, 'unavailable'));
test('price increase and decrease require acceptance, original remains unchanged', () => {
  for (const price of [6.99, 4.99]) { const result = review(item, { ...product, price_usd: price }); assert.equal(result.issues[0].kind, 'price'); assert.equal(result.items[0].unitPriceUsd, price); }
  assert.equal(item.unitPriceUsd, 5.99);
});
test('discount change requires acceptance and rounds cents', () => { const result = review(item, { ...product, discount_percent: 10 }); assert.equal(result.issues[0].kind, 'price'); assert.equal(result.items[0].unitPriceUsd, 5.39); });
test('removed, hidden or foreign variant requires reselection', () => {
  for (const variants of [[], [{ id: vid, product_id: pid, is_available: false }], [{ id: vid, product_id: 'foreign', is_available: true }]]) {
    assert.equal(review({ ...item, variantId: vid }, product, variants).issues[0].kind, 'options');
  }
});
test('new variant requirement cannot fall back to base price', () => assert.equal(review(item, product, [{ id: vid, product_id: pid }]).issues[0].kind, 'options'));
test('variant-specific extra price and repeated quantities are preserved', () => {
  const a = clone(assignment); a.product_option_groups.product_option_values[0].product_option_value_variant_prices = [{ variant_id: vid, price_delta_usd: 2 }];
  const result = review({ ...item, variantId: vid, variantName: 'Grande', unitPriceUsd: 14, selectedOptions: [{ ...option, quantity: 2, priceDeltaUsd: 2 }] }, product, [{ id: vid, product_id: pid, price_usd: 10, name: 'Grande' }], [a]);
  assert.equal(result.issues.length, 0); assert.equal(result.items[0].unitPriceUsd, 14); assert.equal(result.items[0].selectedOptions[0].quantity, 2);
});
test('removed option group is not silently discarded', () => assert.equal(review({ ...item, selectedOptions: [option] }).issues[0].kind, 'options'));
test('inactive or removed option requires reselection', () => {
  for (const values of [[], [{ id: 'v', is_active: false }]]) { const a = clone(assignment); a.product_option_groups.product_option_values = values; assert.equal(review({ ...item, selectedOptions: [option] }, product, [], [a]).issues[0].kind, 'options'); }
});
test('new required group blocks incomplete old cart', () => {
  const a = clone(assignment); a.product_option_groups.required = true;
  assert.equal(review(item, product, [], [a]).issues[0].kind, 'options');
});
test('single-choice and min/max limits include repeated units', () => {
  const a = clone(assignment); a.product_option_groups.selection_type = 'single';
  assert.equal(review({ ...item, selectedOptions: [{ ...option, quantity: 2 }] }, product, [], [a]).issues[0].kind, 'options');
});
test('accepting updated price passes subsequent review with repeated extras', () => {
  const original = { ...item, selectedOptions: [option, option], unitPriceUsd: 7.99 };
  const a = clone(assignment); a.product_option_groups.product_option_values[0].price_delta_usd = 2;
  const changed = review(original, product, [], [a]); assert.equal(changed.issues[0].kind, 'price');
  const accepted = review(server.normalizeItems(changed.items)[0], product, [], [a]);
  assert.equal(accepted.issues.length, 0); assert.equal(accepted.items[0].unitPriceUsd, 9.99); assert.equal(accepted.items[0].selectedOptions[0].quantity, 2);
});
test('partial cart preserves unaffected rows and identifies exact index', () => {
  const result = pure.reviewCartRows([item, { ...item, productId: 'deleted' }], [product], [], []);
  assert.equal(result.issues.length, 1); assert.equal(result.issues[0].index, 1); assert.equal(result.items[0].unitPriceUsd, 5.99);
});
test('inventory selections remain intact for atomic stock validation', () => {
  const result = review({ ...item, inventorySelections: [{ skuId: vid, quantity: 2 }] }); assert.equal(result.items[0].inventorySelections[0].quantity, 2);
});
function db(rows, trace = []) {
  return { from(table) {
    const filters = []; const q = { select() { return q; }, eq(k,v) { filters.push([k,v]); return q; }, in(k,v) { filters.push([k,v]); return q; }, single() { return q; }, maybeSingle() { return q; },
      then(resolve, reject) { trace.push({ table, filters }); return Promise.resolve(rows[table] || { data: [], error: null }).then(resolve, reject); } };
    return q;
  } };
}
test('loader scopes products and groups to store; variants only to owned products', async () => {
  const trace = []; await server.reviewStoredCart(db({ products: { data: [product] } }, trace), 'store-A', [item]);
  assert.ok(trace.find(q => q.table === 'products').filters.some(([k,v]) => k === 'store_id' && v === 'store-A'));
  assert.ok(trace.find(q => q.table === 'product_option_group_products').filters.some(([k,v]) => k === 'store_id' && v === 'store-A'));
  assert.equal(trace.find(q => q.table === 'product_variants').filters[0][1][0], pid);
});
test('loader fails closed when options cannot be read', async () => {
  await assert.rejects(server.reviewStoredCart(db({ products: { data: [product] }, product_option_group_products: { error: new Error('offline') } }), 'store-A', [item]));
});
for (const mode of ['pickup', 'delivery', 'table', 'bar']) test(`final order check rejects stale product before persistence (${mode})`, async () => {
  let persisted = false;
  const database = db({ stores: { data: { id: pid, is_active: true, table_orders_access_enabled: true, table_orders_enabled: true, table_order_fulfillment_mode: mode === 'bar' ? 'counter_pickup' : 'table_service', table_payment_methods: ['efectivo'] } }, store_tables: { data: { id: vid, name: 'Mesa 1' } }, products: { data: [] } });
  const route = load('src/app/api/orders/route.ts', {
    crypto: require('node:crypto'), 'next/server': { NextResponse: { json: (data, opts) => Response.json(data, opts) } },
    '@/lib/server/cart-review': server, '@/lib/plans': {}, '@/lib/payment-availability': { methodsForChannel: () => ['efectivo'] },
    '@/lib/payments': { isCashPaymentMethod: () => true }, '@/lib/whatsapp': {}, '@/lib/supabase/admin': { createSupabaseAdminClient: () => database },
    '@/lib/supabase/catalog': { isStoreSubscriptionPastDue: () => false }, '@/lib/supabase/schema-compat': {}, '@/lib/customers/normalize-phone': {},
    '@/lib/table-orders': { isPrepaidTablePaymentMethod: () => true, isInPersonTablePaymentMethod: () => true }, '@/lib/customers/upsert-customer-from-order': {},
    '@/lib/delivery': {}, '@/lib/transport': {}, '@/lib/server/signed-delivery-quote': {}, '@/lib/business-hours': { getStoreOpenState: () => ({ isOpen: true }) },
    '@/lib/server/rate-limit': { checkDistributedRateLimit: async () => ({ allowed: true }), getClientIp: () => 'test' },
    '@/lib/server/observability': { createApiRequestContext: () => ({}), attachApiResponseHeaders: response => response, logApiError: () => {} },
    '@/lib/server/table-order-tokens': { isValidTableOrderTokenForStore: async () => true }, '@/lib/server/create-order-atomic': { createOrderAtomic: async () => { persisted = true; } },
    '@/lib/buyer/auth-server': {}, '@/lib/printing/firebase-push': {},
  });
  const response = await route.POST(new Request('https://example.test/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storeId: pid, idempotencyKey: vid, order: { items: [item], form: { customerName: 'Demo', customerPhone: '04120000000', paymentMethod: 'efectivo', deliveryType: ['table','bar'].includes(mode) ? 'table' : mode }, tableOrder: { storeToken: 'demo', tableId: vid } } }) }));
  assert.equal(response.status, 409); const data = await response.json(); assert.equal(data.code, 'CART_CHANGED'); assert.equal(data.cartReview.issues[0].kind, 'unavailable'); assert.equal(persisted, false);
});
