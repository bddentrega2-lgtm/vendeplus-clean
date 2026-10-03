import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const STORE_ID = '51000000-0000-4000-8000-000000000001';
const STORE_SLUG = 'cocina-demo';
const PREFIX = 'PICO-';
const CONCURRENCY = 10;

const percentile = (values, ratio) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
};

async function mapLimit(values, limit, task) {
  const results = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await task(values[index], index);
    }
  }));
  return results;
}

export async function simulateKitchenPeak(keys, base) {
  assert.equal(keys.ref, 'xpqmmdmixpyqruykkbkf');
  assert.match(base, /^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/);
  const db = createClient(`https://${keys.ref}.supabase.co`, keys.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ok = result => {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  };
  const stores = ok(await db.from('stores').select('id,slug').order('slug'));
  assert.deepEqual(stores.map(store => store.slug), ['cocina-demo', 'tienda-demo']);
  assert.equal(stores.find(store => store.slug === STORE_SLUG)?.id, STORE_ID);

  const metrics = [];
  const visual = [];
  let userId = '';
  let browser;
  let successful = false;
  const email = `peak-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const timed = async (label, operation) => {
    const started = performance.now();
    try {
      return await operation();
    } finally {
      metrics.push({ label, ms: Math.round(performance.now() - started) });
    }
  };

  try {
    // This script only replaces data that belongs to this synthetic scenario.
    ok(await db.from('orders').delete().eq('store_id', STORE_ID).like('public_code', `${PREFIX}%`));
    ok(await db.from('store_tables').update({ is_enabled: false }).eq('store_id', STORE_ID));
    const tableRows = Array.from({ length: 10 }, (_, index) => ({
      store_id: STORE_ID,
      name: `Mesa ${index + 1}`,
      zone: index < 6 ? 'Salon' : index < 9 ? 'Terraza' : 'VIP',
      is_enabled: true,
    }));
    ok(await db.from('store_tables').upsert(tableRows, { onConflict: 'store_id,name' }));
    const tables = ok(await db.from('store_tables').select('id,name,zone,is_enabled')
      .eq('store_id', STORE_ID).eq('is_enabled', true).order('name'));
    assert.equal(tables.length, 10);
    const tableByName = new Map(tables.map(table => [table.name, table]));

    ok(await db.from('stores').update({
      table_orders_access_enabled: true,
      table_orders_enabled: true,
    }).eq('id', STORE_ID));
    ok(await db.from('store_kitchen_settings').upsert({
      store_id: STORE_ID,
      enabled: true,
      dispatch_mode: 'manual',
    }));
    const products = ok(await db.from('products').select('id,name,price_usd')
      .eq('store_id', STORE_ID).order('id').limit(4));
    assert.ok(products.length, 'Cocina Demo needs at least one product');

    const plans = [
      ...Array.from({ length: 10 }, (_, index) => ({
        code: `${PREFIX}M${String(index + 1).padStart(2, '0')}`,
        mode: 'Mesa',
        table: `Mesa ${index + 1}`,
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        code: `${PREFIX}B${String(index + 1).padStart(2, '0')}`,
        mode: 'Barra',
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        code: `${PREFIX}D${String(index + 1).padStart(2, '0')}`,
        mode: 'Delivery',
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        code: `${PREFIX}R${String(index + 1).padStart(2, '0')}`,
        mode: 'Retiro',
      })),
    ].map((plan, index) => ({ ...plan, index, id: randomUUID() }));
    assert.equal(plans.length, 22);

    const menuNames = ['Hamburguesa Clasica', 'Pollo Crispy', 'Papas especiales', 'Tequenos'];
    await mapLimit(plans, CONCURRENCY, plan => timed('create_order_atomic', async () => {
      const baseProduct = products[plan.index % products.length] || products[0];
      const secondProduct = products[(plan.index + 1) % products.length] || products[0];
      const quantity = 1 + (plan.index % 3);
      const unit = Number(baseProduct.price_usd || 5) || 5;
      const secondUnit = Number(secondProduct.price_usd || 3) || 3;
      const items = [{
        id: randomUUID(),
        product_id: baseProduct.id,
        product_name: menuNames[plan.index % menuNames.length],
        variant_name: plan.index % 3 === 0 ? 'Doble' : null,
        quantity,
        unit_price_usd: unit,
        total_usd: unit * quantity,
        notes: plan.index % 4 === 0 ? 'Sin cebolla. Salsa aparte.' : null,
        options: plan.index % 3 === 0 ? [
          { option_group_name: 'Extras', option_name: 'Queso adicional', price_delta_usd: 1, quantity: 1 },
          { option_group_name: 'Termino', option_name: 'Bien cocida', price_delta_usd: 0, quantity: 1 },
        ] : [],
      }];
      if (plan.index % 2 === 0) {
        items.push({
          id: randomUUID(),
          product_id: secondProduct.id,
          product_name: 'Papas fritas',
          variant_name: 'Medianas',
          quantity: 1,
          unit_price_usd: secondUnit,
          total_usd: secondUnit,
          notes: plan.index % 4 === 2 ? 'Poco sal.' : null,
          options: [],
        });
      }
      const subtotal = items.reduce((sum, item) => sum + item.total_usd, 0);
      const table = plan.table ? tableByName.get(plan.table) : null;
      const electronic = plan.index % 3 !== 0;
      const result = await db.rpc('create_order_atomic', {
        p_order: {
          id: plan.id,
          store_id: STORE_ID,
          public_code: plan.code,
          idempotency_key: randomUUID(),
          customer_name: `Cliente Pico ${String(plan.index + 1).padStart(2, '0')}`,
          customer_phone: `0412000${String(1000 + plan.index)}`,
          delivery_type: ['Mesa', 'Barra'].includes(plan.mode)
            ? 'table'
            : plan.mode === 'Delivery' ? 'delivery' : 'pickup',
          delivery_pricing_type: plan.mode === 'Barra' ? 'bar' : null,
          store_table_id: table?.id || null,
          table_name_snapshot: table?.name || null,
          table_zone_snapshot: table?.zone || null,
          table_fulfillment_snapshot: plan.mode === 'Mesa'
            ? 'table_service'
            : plan.mode === 'Barra' ? 'counter_pickup' : null,
          delivery_reference: plan.mode === 'Mesa'
            ? table.name
            : plan.mode === 'Delivery' ? `Sector Centro, referencia ${plan.index + 1}` : plan.mode,
          delivery_address: plan.mode === 'Delivery'
            ? `Av. Principal, edificio ${plan.index + 1}`
            : null,
          delivery_notes: plan.mode === 'Delivery'
            ? `Tarifa simulada $${2 + (plan.index % 3)}`
            : null,
          order_details: plan.index % 5 === 0
            ? 'Pedido con indicaciones especiales. Revisar antes de entregar.'
            : null,
          notes: plan.index % 4 === 1
            ? 'Pedido manual. Hora pico simulada.'
            : 'Hora pico simulada.',
          payment_method: electronic ? 'Pago movil' : 'Efectivo',
          payment_status: electronic ? 'review' : 'cash_on_delivery',
          subtotal_usd: subtotal,
          delivery_usd: plan.mode === 'Delivery' ? 2 + (plan.index % 3) : 0,
          total_usd: subtotal + (plan.mode === 'Delivery' ? 2 + (plan.index % 3) : 0),
          platform_service_fee_usd: 0,
          status: 'received',
        },
        p_items: items,
      });
      ok(result);
      const minutesAgo = 4 + ((plan.index * 3) % 38);
      ok(await db.from('orders').update({
        created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
      }).eq('id', plan.id).eq('store_id', STORE_ID));
    }));

    const user = ok(await db.auth.admin.createUser({ email, password, email_confirm: true }));
    userId = user.user.id;
    ok(await db.from('store_users').insert({ store_id: STORE_ID, user_id: userId, role: 'owner' }));
    const auth = createClient(`https://${keys.ref}.supabase.co`, keys.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const session = ok(await auth.auth.signInWithPassword({ email, password })).session;
    assert.ok(session?.access_token);

    const api = async (label, path, method = 'GET', body) => timed(label, async () => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'X-Panel-Store-Id': STORE_ID,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
      const data = await response.json();
      assert.equal(response.status, 200, `${label}: ${response.status} ${data.error || ''}`);
      return data;
    });

    const delayThresholds = { received: 10, accepted: 10, preparing: 20, ready: 10, delivering: 30 };
    const savedKitchenSettings = await api('delay_settings_save', '/api/panel/kitchen', 'PATCH', {
      enabled: true,
      dispatchMode: 'manual',
      delayAlertsEnabled: true,
      delayThresholds,
    });
    assert.deepEqual(savedKitchenSettings.settings.delay_thresholds, delayThresholds);
    const invalidDelayResponse = await fetch(`${base}/api/panel/kitchen`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'X-Panel-Store-Id': STORE_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled: true, dispatchMode: 'manual', delayAlertsEnabled: true, delayThresholds: { ...delayThresholds, received: 0 } }),
      signal: AbortSignal.timeout(30_000),
    });
    assert.equal(invalidDelayResponse.status, 400);

    const electronicPlans = plans.filter(plan => plan.index % 3 !== 0);
    await mapLimit(electronicPlans, CONCURRENCY, plan => api(
      'verify_payment',
      `/api/panel/orders/${plan.id}/payment`,
      'PATCH',
      {
        paymentStatus: 'verified',
        paymentReference: `88${String(1000 + plan.index)}`,
        paymentCurrency: 'VES',
        paymentNotes: 'Pago verificado durante simulacion de hora pico.',
      },
    ));

    const byCode = code => plans.find(plan => plan.code === code);
    const received = byCode('PICO-M08');
    const queued = [byCode('PICO-M09'), byCode('PICO-R04')];
    const preparing = [byCode('PICO-M10'), byCode('PICO-D05')];
    const ready = [byCode('PICO-B02'), byCode('PICO-R05')];
    const activeIds = new Set([received, ...queued, ...preparing, ...ready].map(plan => plan.id));
    const completed = plans.filter(plan => !activeIds.has(plan.id));
    assert.equal(completed.length, 15);

    const dispatched = plans.filter(plan => plan.id !== received.id);
    await mapLimit(dispatched, CONCURRENCY, plan => api(
      'kitchen_send',
      '/api/panel/kitchen',
      'POST',
      { orderId: plan.id, action: 'send' },
    ));
    await mapLimit(queued, CONCURRENCY, plan => api(
      'order_accept',
      '/api/panel/orders',
      'PATCH',
      { id: plan.id, status: 'accepted', expectedStatus: 'received' },
    ));
    await mapLimit([...completed, ...preparing, ...ready], CONCURRENCY, plan => api(
      'kitchen_prepare',
      '/api/panel/kitchen',
      'POST',
      { orderId: plan.id, action: 'prepare', expectedState: 'queued' },
    ));
    await mapLimit([...completed, ...ready], CONCURRENCY, plan => api(
      'kitchen_ready',
      '/api/panel/kitchen',
      'POST',
      { orderId: plan.id, action: 'ready', expectedState: 'preparing' },
    ));
    await mapLimit(completed, CONCURRENCY, plan => api(
      'order_complete',
      '/api/panel/orders',
      'PATCH',
      { id: plan.id, status: 'completed', expectedStatus: 'ready' },
    ));

    // Retire the previous four-card demo only after this scenario succeeds.
    ok(await db.from('orders').delete().eq('store_id', STORE_ID).like('public_code', 'COCINA-DEMO-%'));
    const [orderSnapshot, kitchenSnapshot, tableSnapshot] = await Promise.all([
      api('orders_snapshot', `/api/panel/orders?compact=true&limit=40&date=today&storeId=${STORE_ID}`),
      api('kitchen_snapshot', '/api/panel/kitchen?view=board'),
      api('tables_snapshot', `/api/panel/tables?storeId=${STORE_ID}&view=live`),
    ]);
    const scenarioOrders = orderSnapshot.orders.filter(order => order.public_code.startsWith(PREFIX));
    assert.equal(scenarioOrders.length, 22);
    const orderCounts = Object.fromEntries(
      ['received', 'accepted', 'preparing', 'ready', 'completed'].map(status => [
        status,
        scenarioOrders.filter(order => order.status === status).length,
      ]),
    );
    assert.deepEqual(orderCounts, {
      received: 1,
      accepted: 2,
      preparing: 2,
      ready: 2,
      completed: 15,
    });
    const ticketCounts = Object.fromEntries(
      ['queued', 'preparing', 'ready'].map(state => [
        state,
        kitchenSnapshot.tickets.filter(ticket => ticket.state === state).length,
      ]),
    );
    assert.deepEqual(ticketCounts, { queued: 2, preparing: 2, ready: 2 });
    assert.equal(tableSnapshot.tables.length, 10);
    assert.equal(
      tableSnapshot.tableOrders.filter(order => order.public_code.startsWith(PREFIX)).length,
      3,
    );
    assert.equal(tableSnapshot.counterOrders.filter(order => order.public_code.startsWith(PREFIX)).length, 1);

    await mkdir('tmp/kitchen-peak', { recursive: true });
    browser = await chromium.launch({ headless: true });
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 1000 },
      { name: 'tablet', width: 800, height: 1000 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.name === 'mobile',
        hasTouch: viewport.name !== 'desktop',
      });
      await context.addInitScript(accessToken => {
        sessionStorage.setItem('vendeplus_panel_token', accessToken);
      }, session.access_token);
      const panelSession = await context.request.post(`${base}/api/auth/panel-session`, {
        data: { accessToken: session.access_token },
      });
      assert.equal(panelSession.status(), 200);
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.goto(`${base}/panel/cocina`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Comandas', exact: true }).waitFor({ timeout: 30_000 });
      const tutorial = page.getByRole('button', { name: 'Cerrar tutorial' });
      if (await tutorial.isVisible()) await tutorial.click();

      const kitchenCards = page.locator('[aria-label="Comandas activas"] article');
      await page.waitForFunction(() =>
        document.querySelectorAll('[aria-label="Comandas activas"] article').length === 6,
      undefined, { timeout: 30_000 });
      assert.equal(await kitchenCards.count(), 6);
      const kitchenOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(kitchenOverflow <= 1);
      const cardHeights = await kitchenCards.evaluateAll(cards =>
        cards.map(card => Math.round(card.getBoundingClientRect().height)));
      const maxCardHeight = Math.max(...cardHeights);
      await page.screenshot({
        path: `tmp/kitchen-peak/cocina-${viewport.name}.png`,
        fullPage: true,
      });

      await page.goto(`${base}/panel/pedidos`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Pedidos operativos', exact: true }).waitFor();
      await page.getByPlaceholder('Buscar por codigo, cliente, telefono o comercio...').fill(PREFIX)
        .catch(async () => page.getByPlaceholder(/Buscar por/).fill(PREFIX));
      await page.waitForFunction(prefix => {
        const codes = [...document.querySelectorAll('.native-order-card h3')]
          .map(element => element.textContent || '');
        return codes.length === 7 && codes.every(code => code.startsWith(prefix));
      }, PREFIX, { timeout: 30_000 });
      const activeSwitch = page.getByRole('switch', { name: 'Mostrar solo pedidos activos' });
      assert.equal(await activeSwitch.getAttribute('aria-checked'), 'true');
      await activeSwitch.click();
      await page.waitForFunction(prefix => {
        const codes = [...document.querySelectorAll('.native-order-card h3')]
          .map(element => element.textContent || '');
        return codes.length === 22 && codes.every(code => code.startsWith(prefix));
      }, PREFIX, { timeout: 30_000 });
      const orderCards = page.locator('.native-order-card');
      await orderCards.first().waitFor();
      assert.equal(await orderCards.count(), 22);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const clipped = await orderCards.locator('h3,p').evaluateAll(elements => elements.filter(element => {
        const style = getComputedStyle(element);
        return style.textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth + 1;
      }).length);
      assert.equal(clipped, 0);
      await page.screenshot({
        path: `tmp/kitchen-peak/pedidos-${viewport.name}.png`,
        fullPage: true,
      });

      await page.goto(`${base}/panel/mesas`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Pantalla completa', exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelectorAll('article').length === 10,
        undefined, { timeout: 30_000 });
      const tableArticles = page.locator('article');
      assert.equal(await tableArticles.count(), 10);
      const tableNames = await tableArticles.locator('h3').allTextContents();
      assert.deepEqual(tableNames.slice(0, 3), ['Mesa 10', 'Mesa 9', 'Mesa 8']);
      const compactTableHeights = await tableArticles.evaluateAll(cards => cards.slice(3)
        .map(card => Math.round(card.getBoundingClientRect().height)));
      const maxCompactTableHeight = Math.max(...compactTableHeights);
      assert.ok(maxCompactTableHeight < 180, `Compact table card is ${maxCompactTableHeight}px in ${viewport.name}`);
      const activeLabels = await page.getByText('1 pedido activo', { exact: true }).count();
      const availableLabels = await page.getByText('Sin pedidos activos', { exact: true }).count();
      assert.equal(activeLabels, 3);
      assert.equal(availableLabels, 7);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({
        path: `tmp/kitchen-peak/mesas-${viewport.name}.png`,
        fullPage: true,
      });
      assert.deepEqual(pageErrors, []);
      visual.push({
        viewport: viewport.name,
        kitchenCards: 6,
        maxCardHeight,
        orderCards: 22,
        tables: 10,
        activeTables: activeLabels,
        firstTables: tableNames.slice(0, 3),
        maxCompactTableHeight,
        overflow: kitchenOverflow,
      });
      await context.close();
    }
    successful = true;

    const groupedMetrics = Object.fromEntries(
      [...new Set(metrics.map(metric => metric.label))].map(label => {
        const values = metrics.filter(metric => metric.label === label).map(metric => metric.ms);
        return [label, {
          count: values.length,
          p50: percentile(values, 0.5),
          p95: percentile(values, 0.95),
          max: Math.max(...values),
        }];
      }),
    );
    console.log(JSON.stringify({
      pass: true,
      scenario: {
        total: 22,
        completed: 15,
        active: 7,
        completionPercent: 68.2,
        orderCounts,
        ticketCounts,
        configuredTables: 10,
        activeTables: 3,
        modes: { Mesa: 10, Barra: 2, Delivery: 5, Retiro: 5 },
      },
      concurrency: CONCURRENCY,
      metrics: groupedMetrics,
      visual,
      persistentCodes: `${PREFIX}*`,
      temporaryOperatorRemoved: true,
      productionTouched: false,
    }));
  } finally {
    if (browser) await browser.close();
    const cleanupErrors = [];
    const cleanup = async (label, promise) => {
      const result = await promise;
      if (result.error) cleanupErrors.push(`${label}: ${result.error.message}`);
    };
    if (userId) {
      await cleanup(
        'membership',
        db.from('store_users').delete().eq('store_id', STORE_ID).eq('user_id', userId),
      );
      const removal = await db.auth.admin.deleteUser(userId);
      if (removal.error) cleanupErrors.push(`auth: ${removal.error.message}`);
    }
    if (!successful) {
      await cleanup(
        'partial scenario',
        db.from('orders').delete().eq('store_id', STORE_ID).like('public_code', `${PREFIX}%`),
      );
    }
    assert.deepEqual(cleanupErrors, [], 'Temporary operator cleanup failed');
  }
}
