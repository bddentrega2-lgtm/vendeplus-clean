import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

const base = "https://www.somos-ve.com";
const productionRef = "rvmtjtuztewcrmodrodb";
const runId = `QA-SMASH-${Date.now()}`;
const env = parseEnv(readFileSync("../.env.local", "utf8"));
assert.match(env.NEXT_PUBLIC_SUPABASE_URL || "", new RegExp(productionRef));
assert.ok(env.SUPABASE_SERVICE_ROLE_KEY && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const createdOrderIds = [];
const createdPhones = [];
let temporaryUserId = "";
let store;
let originalKitchenSettings = null;
let hadKitchenSettings = false;

function data(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function api(path, { token, storeId, method = "GET", body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(storeId ? { "X-Panel-Store-Id": storeId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25_000),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, payload };
}

async function createOperator(storeId) {
  const email = `production-smash-audit-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString("base64url");
  const user = data(await admin.auth.admin.createUser({ email, password, email_confirm: true }), "create user").user;
  temporaryUserId = user.id;
  data(await admin.from("store_users").insert({ store_id: storeId, user_id: user.id, role: "owner" }), "create membership");
  const session = data(await anon.auth.signInWithPassword({ email, password }), "sign in").session;
  return session.access_token;
}

async function createOrder({ index, product, table, tableToken, paymentMethod }) {
  const phone = `041290${String(Date.now()).slice(-4)}${index}`;
  createdPhones.push(phone);
  const marker = `${runId}-${index}`;
  const response = await api("/api/orders", {
    method: "POST",
    body: {
      storeId: store.id,
      idempotencyKey: randomUUID(),
      order: {
        id: marker,
        storeSlug: store.slug,
        storeName: store.name,
        createdAt: new Date().toISOString(),
        items: [{
          productId: product.id,
          productName: product.name,
          productSlug: "",
          productImageUrl: product.image_url || "",
          quantity: 1,
          unitPriceUsd: Number(product.price_usd),
          notes: marker,
          selectedOptions: [],
        }],
        form: {
          customerName: `Cliente ${marker}`,
          customerPhone: phone,
          deliveryType: "table",
          deliveryReference: table.name,
          deliveryZoneId: "",
          paymentMethod,
          paymentReference: "",
          paymentReceiptToken: "",
          orderDetails: marker,
          notes: marker,
          cashPaymentNote: "",
        },
        location: null,
        quote: { distanceKm: 0, feeUsd: 0, label: table.name, source: "table", available: true },
        totals: { subtotalUsd: Number(product.price_usd), deliveryUsd: 0, serviceFeeUsd: 0, totalUsd: Number(product.price_usd), totalBs: 0 },
        mapsUrl: null,
        routeUrl: null,
        whatsappMessage: marker,
        whatsappUrl: "",
        tableOrder: {
          storeToken: tableToken,
          tableId: table.id,
          tableName: table.name,
          tableZone: table.zone,
          paymentMethods: [paymentMethod],
          fulfillmentMode: "table_service",
        },
      },
    },
  });
  assert.equal(response.status, 200, `create ${index}: ${response.payload.error || response.status}`);
  createdOrderIds.push(response.payload.orderId);
  return response.payload.order;
}

async function kitchenAction(token, orderId, action, expectedState = null) {
  const started = performance.now();
  const response = await api("/api/panel/kitchen", {
    token,
    storeId: store.id,
    method: "POST",
    body: { orderId, action, expectedState },
  });
  assert.equal(response.status, 200, `${action}: ${response.payload.error || response.status}`);
  return Math.round(performance.now() - started);
}

try {
  const stores = data(await admin.from("stores").select("id,name,slug,table_orders_access_enabled,table_orders_enabled,table_order_fulfillment_mode,table_payment_methods,payment_methods").eq("table_orders_access_enabled", true).order("name"), "stores");
  const accessMatrix = stores.map(({ name, slug, table_orders_access_enabled, table_orders_enabled }) => ({ name, slug, access: table_orders_access_enabled, active: table_orders_enabled, kitchenVisible: table_orders_access_enabled && table_orders_enabled }));
  store = stores.find((entry) => entry.slug === "smash");
  assert.ok(store && store.table_orders_access_enabled && store.table_orders_enabled, "Smash must be the active production table pilot.");
  assert.equal(store.table_order_fulfillment_mode, "table_service", "Smash must remain in table service during this audit.");

  const tables = data(await admin.from("store_tables").select("id,name,zone").eq("store_id", store.id).eq("is_enabled", true).order("name"), "tables");
  assert.ok(tables.length, "Smash has no enabled table.");
  const products = data(await admin.from("products").select("id,name,price_usd,image_url,is_available").eq("store_id", store.id).eq("is_available", true).order("sort_order").limit(40), "products");
  const linked = data(await admin.from("product_option_group_products").select("product_id").in("product_id", products.map((product) => product.id)), "product links");
  const linkedIds = new Set(linked.map((entry) => entry.product_id));
  const inventory = data(await admin.from("product_inventory_skus").select("product_id").eq("store_id", store.id), "inventory");
  const inventoryIds = new Set(inventory.map((entry) => entry.product_id));
  const product = products.find((entry) => !linkedIds.has(entry.id) && !inventoryIds.has(entry.id));
  assert.ok(product, "Smash needs one available product without options or inventory for a clean audit.");
  const tableToken = String(data(await admin.rpc("table_order_token_for_store", { p_store_id: store.id }), "table token"));
  const paymentMethod = (store.table_payment_methods || []).find((method) => /efectivo|punto/i.test(method)) || (store.table_payment_methods || [])[0];
  assert.ok(paymentMethod, "Smash has no table payment method.");

  const currentSettings = await admin.from("store_kitchen_settings").select("*").eq("store_id", store.id).maybeSingle();
  if (currentSettings.error) throw currentSettings.error;
  hadKitchenSettings = Boolean(currentSettings.data);
  originalKitchenSettings = currentSettings.data;
  if (!currentSettings.data?.enabled) {
    data(await admin.from("store_kitchen_settings").upsert({ store_id: store.id, enabled: true, dispatch_mode: "manual", delay_alerts_enabled: false }).select().single(), "enable kitchen temporarily");
  }

  const token = await createOperator(store.id);
  const orders = [];
  for (let index = 1; index <= 5; index += 1) orders.push(await createOrder({ index, product, table: tables[0], tableToken, paymentMethod }));
  const ids = orders.map((order) => order.databaseId);
  assert.deepEqual(ids, createdOrderIds);

  const latency = [];
  for (const id of ids) latency.push({ id, sendMs: await kitchenAction(token, id, "send") });
  for (const id of [ids[0], ids[1], ids[4]]) {
    const row = latency.find((entry) => entry.id === id);
    row.prepareMs = await kitchenAction(token, id, "prepare", "queued");
    row.readyMs = await kitchenAction(token, id, "ready", "preparing");
  }

  const noReason = await api("/api/panel/orders", { token, storeId: store.id, method: "PATCH", body: { id: ids[2], status: "cancelled", expectedStatus: "accepted" } });
  assert.equal(noReason.status, 400, "A table cancellation without reason must be rejected.");
  const cancelled = await api("/api/panel/orders", { token, storeId: store.id, method: "PATCH", body: { id: ids[2], status: "cancelled", expectedStatus: "accepted", cancellationReason: "Pedido duplicado", cancellationDetail: "" } });
  assert.equal(cancelled.status, 200, cancelled.payload.error || "cancel failed");

  const statusChecks = [];
  for (const order of [orders[0], orders[1], orders[4]]) {
    const check = await api(`/api/table-orders/status?orderId=${encodeURIComponent(order.databaseId)}&token=${encodeURIComponent(tableToken)}`);
    assert.equal(check.status, 200, check.payload.error || "public status failed");
    assert.equal(check.payload.order.status, "ready");
    statusChecks.push({ id: order.databaseId, status: check.payload.order.status });
  }
  const board = await api("/api/panel/kitchen?view=board", { token, storeId: store.id });
  const tableSnapshot = await api(`/api/panel/tables?view=live&storeId=${encodeURIComponent(store.id)}`, { token });
  assert.equal(board.status, 200, board.payload.error || "board failed");
  assert.equal(tableSnapshot.status, 200, tableSnapshot.payload.error || "tables failed");
  const snapshotOrders = [...(tableSnapshot.payload.tableOrders || []), ...(tableSnapshot.payload.counterOrders || [])];
  for (const id of [ids[0], ids[1], ids[4]]) assert.equal(snapshotOrders.find((entry) => entry.id === id)?.status, "ready", `Mesa did not expose ready for ${id}`);

  const rows = data(await admin.from("orders").select("id,status,table_cancellation_reason,delivery_type").in("id", ids).order("created_at"), "final orders");
  console.log(JSON.stringify({
    pass: true,
    runId,
    accessMatrix,
    test: { store: store.slug, table: tables[0].name, product: product.name, orders: rows, statusChecks, latency, kitchenTickets: board.payload.tickets?.filter((ticket) => ids.includes(ticket.order_id)).length, tableSnapshotMatches: snapshotOrders.filter((entry) => ids.includes(entry.id)).length },
  }, null, 2));
} finally {
  const cleanupErrors = [];
  if (createdOrderIds.length) {
    const allocations = await admin.from("order_item_inventory_allocations").select("id").in("order_id", createdOrderIds);
    if (allocations.error) cleanupErrors.push(allocations.error.message);
    else if (allocations.data.length) cleanupErrors.push("Unexpected inventory allocations; orders retained for manual review.");
    else {
      const deleted = await admin.from("orders").delete().in("id", createdOrderIds).select("id");
      if (deleted.error) cleanupErrors.push(deleted.error.message);
      else if (deleted.data.length !== createdOrderIds.length) cleanupErrors.push(`Deleted ${deleted.data.length}/${createdOrderIds.length} test orders.`);
      if (store && createdPhones.length) {
        const customers = await admin.from("customers").delete().eq("store_id", store.id).in("phone_normalized", createdPhones.map((phone) => phone.replace(/\D/g, "")));
        if (customers.error) cleanupErrors.push(customers.error.message);
      }
    }
  }
  if (temporaryUserId) {
    const membership = await admin.from("store_users").delete().eq("user_id", temporaryUserId);
    if (membership.error) cleanupErrors.push(membership.error.message);
    const auth = await admin.auth.admin.deleteUser(temporaryUserId);
    if (auth.error) cleanupErrors.push(auth.error.message);
  }
  if (store) {
    if (hadKitchenSettings && originalKitchenSettings) {
      const restored = await admin.from("store_kitchen_settings").upsert(originalKitchenSettings);
      if (restored.error) cleanupErrors.push(restored.error.message);
    } else if (!hadKitchenSettings) {
      const restored = await admin.from("store_kitchen_settings").delete().eq("store_id", store.id);
      if (restored.error) cleanupErrors.push(restored.error.message);
    }
  }
  assert.deepEqual(cleanupErrors, [], `Cleanup failed: ${cleanupErrors.join(" | ")}`);
}
