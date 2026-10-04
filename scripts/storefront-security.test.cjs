const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}, suffix = '') {
  const source = fs.readFileSync(file, 'utf8') + suffix;
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiled = { exports: {} };
  vm.runInNewContext('(function(require,module,exports){' + js + '\n})', { console, process })((id) => {
    if (id in mocks) return mocks[id];
    throw new Error('Unexpected dependency ' + id);
  }, compiled, compiled.exports);
  return compiled.exports;
}
const colors = load('src/lib/brand-colors.ts');
test('brand colors allow only six-digit hex and trim surrounding whitespace', () => {
  for (const v of ['#000000', '#FFFFFF', '#1f464C', ' #123456 ']) assert.equal(colors.isBrandColor(v), true);
  for (const v of ['red', '#fff', '#12345678', 'url(https://example.invalid)', '<svg/>', '#123456; color:red', {}, null, 123]) {
    assert.equal(colors.isBrandColor(v), false);
    assert.equal(colors.safeBrandColor(v, '#1F464C'), '#1F464C');
  }
  assert.equal(colors.safeBrandColor(' #123456 ', '#000000'), '#123456');
});
const catalog = load('src/lib/supabase/catalog.ts', {
  'server-only': {},
  '@/data/stores': { stores: [], getStoreBySlug: () => null },
  '@/lib/supabase/server': { hasSupabaseEnv: () => false },
  '@/lib/supabase/admin': {}, '@/lib/supabase/schema-compat': {}, '@/lib/delivery': { mapStoreDeliverySettings: () => undefined },
  '@/lib/business-hours': { getStoreOpenState: () => ({ isOpen: true }) }, '@/lib/transport': {},
  '@/lib/brand-copy': { normalizePublicBrandText: value => value || '', DEFAULT_STORE_COVER_IMAGE: '' },
  '@/lib/subscription-status': load('src/lib/subscription-status.ts'), '@/lib/brand-colors': colors,
}, '\nexport { mapStore as mapStoreForTest };');
const row = { id: 'store-a', slug: 'security-fixture', name: 'Fixture', plan_type: 'monthly', monthly_price_usd: 987.65,
  billing_notes: 'PRIVATE_SENTINEL', subscription_status: 'active', next_payment_due_at: '2099-01-01',
  primary_color: 'url(https://example.invalid)', accent_color: '#F27533' };
test('public serialization excludes billing notes, dates and monthly subscription price', () => {
  const store = catalog.mapStoreForTest(row);
  const json = JSON.stringify(store);
  for (const secret of ['PRIVATE_SENTINEL', '2099-01-01', '987.65', 'billing_notes', 'subscription_status']) assert.equal(json.includes(secret), false);
  assert.equal(store.serviceFeeUsd, 0);
  assert.equal(store.primaryColor, '#1F464C');
});
test('checkout still receives per-order fee needed to calculate customer totals', () => {
  const store = catalog.mapStoreForTest({ ...row, plan_type: 'per_service', monthly_price_usd: 0.2, service_fee_payer: 'customer' });
  assert.equal(store.serviceFeeUsd, 0.2);
  assert.equal(store.serviceFeePayer, 'customer');
});
test('server-side catalog projection excludes inactive categories, products, variants and options', () => {
  const store = catalog.mapStoreForTest({ ...row,
    categories: [{ id: 'c1', name: 'Visible', is_active: true }, { id: 'c2', name: 'Hidden', is_active: false }],
    products: [{ id: 'hidden', is_available: false }, { id: 'visible', name: 'Visible', price_usd: 5, is_available: true,
      product_variants: [{ id: 'v1', name: 'Visible', is_available: true }, { id: 'v2', name: 'Hidden', is_available: false }],
      product_option_group_products: [
        { product_option_groups: { id: 'g1', is_active: false, product_option_values: [{ id: 'o1', is_active: true }] } },
        { product_option_groups: { id: 'g2', is_active: true, product_option_values: [{ id: 'o2', is_active: false }, { id: 'o3', is_active: true }] } },
      ],
    }],
  });
  assert.equal(store.categories.map(c => c.id).join(','), 'c1');
  assert.equal(store.products.map(p => p.id).join(','), 'visible');
  assert.equal(store.products[0].variants.map(v => v.id).join(','), 'v1');
  assert.equal(store.products[0].optionGroups.map(g => g.id).join(','), 'g2');
  assert.equal(store.products[0].optionGroups[0].values.map(v => v.id).join(','), 'o3');
});
test('subscription eligibility still rejects expired and paused stores', () => {
  assert.equal(catalog.isStoreSubscriptionPastDue({ subscription_status: 'paused' }), true);
  assert.equal(catalog.isStoreSubscriptionPastDue({ subscription_status: 'active', next_payment_due_at: '2000-01-01' }), true);
  assert.equal(catalog.isStoreSubscriptionPastDue({ subscription_status: 'active', next_payment_due_at: '2099-01-01' }), false);
});
