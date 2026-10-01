import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

for (const file of [resolve("../.env.local"), resolve(".env.local")]) {
  if (existsSync(file)) Object.assign(process.env, parseEnv(readFileSync(file, "utf8")));
}

const baseUrl = process.env.E2E_BASE_URL || "https://www.somos-ve.com";
const storeSlug = process.env.E2E_STORE_SLUG || "smash";
const targetProductName = process.env.E2E_PRODUCT_NAME || "Perrito Gourmet";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
})) {
  if (!value) throw new Error(`Falta ${name}.`);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const panelClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runId = randomUUID().slice(0, 8);
const email = `qa-customer-order-${runId}@invalid.local`;
const password = `Qa!${randomUUID()}aA1`;
const phone = `0412999${String(Date.now()).slice(-4)}`;
const customerName = `Auditoria Somos ${runId}`;
const auditNote = `PRUEBA AUTORIZADA QA ${runId} - NO PREPARAR`;
const artifactsDir = resolve("tmp/customer-order-production-audit");
const runStartedAt = new Date(Date.now() - 5_000).toISOString();

let browser;
let receiverChannel;
let userId = null;
let accessToken = "";
let storeId = "";
let orderId = "";
let publicCode = "";
let cancelled = false;
let postCount = 0;
const realtimeMessages = [];
const timings = {};

function appUrl(path) {
  return new URL(path, baseUrl).toString();
}

function waitForSubscription(channel, timeoutMs = 15_000) {
  return new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Realtime no completo la suscripcion.")),
      timeoutMs,
    );
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        resolvePromise(status);
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        clearTimeout(timeout);
        reject(error || new Error(`Realtime termino con ${status}.`));
      }
    });
  });
}

async function waitUntil(check, label, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Tiempo agotado esperando ${label}.`);
}

async function subscribeToStoreOrders(storeId) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    receiverChannel = panelClient
      .channel(`store:${storeId}:orders`, { config: { private: true } })
      .on("broadcast", { event: "order_changed" }, (message) => {
        realtimeMessages.push(message);
      });
    try {
      await waitForSubscription(receiverChannel, 20_000);
      return attempt;
    } catch (error) {
      lastError = error;
      await panelClient.removeChannel(receiverChannel);
      receiverChannel = null;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 750));
    }
  }
  throw lastError || new Error("Realtime no completo la suscripcion.");
}

async function panelRequest(path, init = {}) {
  const response = await fetch(appUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Panel ${init.method || "GET"} ${path} fallo (${response.status}): ${data.error || "sin detalle"}`);
  }
  return { data, response };
}

async function recoverCreatedOrder() {
  if (orderId || !storeId) return Boolean(orderId);
  const { data, error } = await admin
    .from("orders")
    .select("id, public_code")
    .eq("store_id", storeId)
    .eq("notes", auditNote)
    .gte("created_at", runStartedAt)
    .order("created_at", { ascending: false })
    .limit(2);
  if (error) throw error;
  assert.ok((data || []).length <= 1, "La marca QA corresponde a mas de un pedido.");
  if (!data?.[0]) return false;
  orderId = data[0].id;
  publicCode = data[0].public_code || "";
  return true;
}

async function cancelCreatedOrder() {
  if (!orderId || cancelled) return;
  const { data } = await panelRequest("/api/panel/orders", {
    method: "PATCH",
    body: JSON.stringify({ id: orderId, status: "cancelled" }),
  });
  assert.equal(data.order?.status, "cancelled", "La ruta normal no devolvio el pedido cancelado.");
  cancelled = true;
}

mkdirSync(artifactsDir, { recursive: true });

try {
  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id, name, slug, is_active, is_test, usd_to_bs, monthly_price_usd, service_fee_payer, plan_type")
    .eq("slug", storeSlug)
    .single();
  if (storeError) throw storeError;
  assert.equal(store.is_active, true, "El comercio de prueba no esta activo.");
  assert.equal(store.is_test, true, "El auditor solo puede operar sobre un comercio marcado como prueba.");
  storeId = store.id;

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id, name, price_usd, is_available, product_variants(id), product_option_group_products(id)")
    .eq("store_id", store.id)
    .eq("name", targetProductName)
    .eq("is_available", true)
    .single();
  if (productError) throw productError;
  assert.equal(product.product_variants?.length || 0, 0, "El producto QA no debe exigir variante.");
  assert.equal(product.product_option_group_products?.length || 0, 0, "El producto QA no debe exigir opciones.");

  const { count: ordersBefore, error: countBeforeError } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id);
  if (countBeforeError) throw countBeforeError;

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createUserError) throw createUserError;
  userId = createdUser.user.id;

  const { error: membershipError } = await admin.from("store_users").insert({
    store_id: store.id,
    user_id: userId,
    role: "owner",
  });
  if (membershipError) throw membershipError;

  const { data: signedIn, error: signInError } = await panelClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signedIn.session) {
    throw signInError || new Error("No se creo la sesion temporal del panel.");
  }
  accessToken = signedIn.session.access_token;

  await panelClient.realtime.setAuth(accessToken);
  const realtimeStarted = performance.now();
  timings.realtimeSubscriptionAttempts = await subscribeToStoreOrders(store.id);
  timings.realtimeSubscriptionMs = Math.round(performance.now() - realtimeStarted);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "es-VE",
  });
  await context.route("https://wa.me/**", (route) => route.abort("blockedbyclient"));
  const page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("ERR_BLOCKED_BY_CLIENT")) {
      browserErrors.push(message.text());
    }
  });
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/orders") postCount += 1;
  });

  let started = performance.now();
  const catalogResponse = await page.goto(appUrl(`/${storeSlug}`), {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  timings.catalogDomMs = Math.round(performance.now() - started);
  assert.equal(catalogResponse?.status(), 200, "El catalogo no respondio 200.");
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  // The public catalog streams before React has attached every card handler.
  await page.waitForTimeout(2_500);
  const targetCard = page
    .locator("article.catalog-product")
    .filter({ has: page.getByRole("heading", { name: targetProductName, exact: true }) })
    .last();
  await targetCard.waitFor({ state: "visible" });
  const addButton = targetCard.locator('button[title="Anadir"]');
  await addButton.waitFor({ state: "visible" });

  await addButton.click();
  await page.getByText("Ver carrito", { exact: true }).waitFor({ state: "visible" });
  await page.screenshot({ path: resolve(artifactsDir, "01-catalog-cart-bar.png"), fullPage: false });

  started = performance.now();
  await page.getByText("Ver carrito", { exact: true }).click();
  await page.waitForURL(`**/${storeSlug}/carrito`, { timeout: 20_000 });
  timings.cartNavigationMs = Math.round(performance.now() - started);
  await page.getByRole("heading", { name: targetProductName }).waitFor({ state: "visible" });
  await page.screenshot({ path: resolve(artifactsDir, "02-cart.png"), fullPage: false });

  started = performance.now();
  await page.getByRole("link", { name: "Finalizar pedido" }).click();
  await page.waitForURL(`**/${storeSlug}/checkout`, { timeout: 20_000 });
  timings.checkoutNavigationMs = Math.round(performance.now() - started);

  await page.getByPlaceholder("Ej: Ana Rodríguez").fill(customerName);
  await page.getByPlaceholder("Ej: 0412-0000000").fill(phone);
  await page.locator("select").nth(0).selectOption("pickup");
  await page.locator("select").nth(1).selectOption({ label: "Efectivo" });
  await page.getByPlaceholder(/pago en dólares/i).fill("Pago de prueba, no procesar.");
  await page.getByLabel("Indicaciones del pedido").fill(auditNote);
  await page.screenshot({ path: resolve(artifactsDir, "03-checkout.png"), fullPage: false });

  const orderResponsePromise = page.waitForResponse(
    (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/orders",
    { timeout: 120_000 },
  ).catch(async () => {
    await page.screenshot({ path: resolve(artifactsDir, "04-submit-failure.png"), fullPage: true });
    const visibleAlerts = await page
      .locator("p.bg-red-50")
      .allTextContents()
      .catch(() => []);
    const selectState = await page.locator("select").evaluateAll((selects) =>
      selects.map((select) => ({ value: select.value, disabled: select.disabled })),
    );
    throw new Error(`No respondio /api/orders. Solicitudes observadas: ${postCount}. Alertas: ${visibleAlerts.join(" | ") || "ninguna"}. Errores: ${browserErrors.join(" | ") || "ninguno"}. Selectores: ${JSON.stringify(selectState)}.`);
  });
  started = performance.now();
  assert.equal(await page.evaluate(() => navigator.onLine), true, "El navegador QA aparece sin conexion.");
  const confirmButton = page.getByRole("button", { name: "Confirmar pedido por WhatsApp" });
  assert.equal(await confirmButton.isEnabled(), true, "El boton de confirmar esta deshabilitado.");
  await confirmButton.scrollIntoViewIfNeeded();
  await confirmButton.dispatchEvent("click");
  const orderResponse = await orderResponsePromise;
  timings.orderCreateMs = Math.round(performance.now() - started);
  const orderResult = await orderResponse.json().catch(() => ({}));
  assert.equal(orderResponse.status(), 200, `La creacion devolvio ${orderResponse.status()}: ${orderResult.error || "sin detalle"}`);
  orderId = orderResult.orderId || "";
  publicCode = orderResult.order?.id || "";
  if (!orderId) {
    await waitUntil(recoverCreatedOrder, "la persistencia del pedido por su marca QA", 10_000);
  }
  assert.equal(postCount, 1, "El navegador envio mas de una solicitud de pedido.");
  if (Object.hasOwn(orderResult, "idempotentReplay")) {
    assert.equal(orderResult.idempotentReplay, false, "La creacion fue tratada como repeticion.");
  }

  await waitUntil(
    () => realtimeMessages.some((message) => JSON.stringify(message).includes(orderId)),
    "el aviso Realtime del pedido",
  );
  timings.realtimeOrderMs = Math.round(performance.now() - started);

  const panelStarted = performance.now();
  const { data: panelResult, response: panelResponse } = await panelRequest(
    `/api/panel/orders?storeId=${store.id}&orderId=${orderId}`,
  );
  timings.panelReadMs = Math.round(performance.now() - panelStarted);
  assert.equal(panelResult.order?.id, orderId, "El pedido no aparecio en la API operativa del comercio.");

  const { data: persisted, error: persistedError } = await admin
    .from("orders")
    .select(`
      id, public_code, store_id, customer_id, customer_name, customer_phone_normalized,
      delivery_type, payment_method, payment_status, subtotal_usd, delivery_usd,
      total_usd, total_bs, platform_service_fee_usd, platform_service_fee_payer,
      platform_service_fee_customer_usd, status, notes, whatsapp_message,
      order_items(id, product_id, product_name, quantity, unit_price_usd, total_usd,
        order_item_options(id, option_group_name, option_name, price_delta_usd, quantity))
    `)
    .eq("id", orderId)
    .single();
  if (persistedError) throw persistedError;
  assert.equal(persisted.store_id, store.id);
  assert.equal(persisted.status, "received");
  assert.equal(persisted.delivery_type, "pickup");
  assert.equal(persisted.payment_method, "Efectivo");
  assert.equal(persisted.customer_name, customerName);
  assert.equal(persisted.notes, auditNote);
  assert.equal(Number(persisted.subtotal_usd), Number(product.price_usd));
  assert.equal(Number(persisted.delivery_usd), 0);
  assert.equal(Number(persisted.platform_service_fee_usd), Number(store.monthly_price_usd));
  assert.equal(persisted.platform_service_fee_payer, "customer");
  assert.equal(Number(persisted.platform_service_fee_customer_usd), Number(store.monthly_price_usd));
  assert.equal(Number(persisted.total_usd), Number(product.price_usd) + Number(store.monthly_price_usd));
  assert.equal(persisted.order_items?.length, 1);
  assert.equal(persisted.order_items[0].product_id, product.id);
  assert.equal(persisted.order_items[0].product_name, product.name);
  assert.equal(Number(persisted.order_items[0].quantity), 1);
  assert.equal(persisted.order_items[0].order_item_options?.length || 0, 0);
  assert.ok(persisted.whatsapp_message?.includes(publicCode), "WhatsApp no incluye el codigo del pedido.");
  assert.ok(persisted.whatsapp_message?.includes(product.name), "WhatsApp no incluye el producto.");
  assert.ok(!/\bnull\b/i.test(persisted.whatsapp_message || ""), "WhatsApp contiene el texto null.");

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("id, orders_count, total_spent_usd, last_order_id")
    .eq("id", persisted.customer_id)
    .single();
  if (customerError) throw customerError;
  assert.ok(Number(customer.orders_count) >= 1, "El cliente no contabilizo el pedido activo.");
  assert.equal(Number(customer.total_spent_usd), Number(product.price_usd));
  assert.equal(customer.last_order_id, orderId);

  await cancelCreatedOrder();
  await waitUntil(
    () => realtimeMessages.filter((message) => JSON.stringify(message).includes(orderId)).length >= 2,
    "el aviso Realtime de cancelacion",
  );

  const { data: cancelledOrder, error: cancelledError } = await admin
    .from("orders")
    .select("id, status, platform_service_fee_usd, platform_service_fee_payer, platform_service_fee_customer_usd")
    .eq("id", orderId)
    .single();
  if (cancelledError) throw cancelledError;
  assert.equal(cancelledOrder.status, "cancelled");
  assert.equal(Number(cancelledOrder.platform_service_fee_usd), Number(store.monthly_price_usd));
  assert.equal(cancelledOrder.platform_service_fee_payer, "customer");
  assert.equal(Number(cancelledOrder.platform_service_fee_customer_usd), Number(store.monthly_price_usd));

  const { data: customerAfterCancel, error: customerAfterCancelError } = await admin
    .from("customers")
    .select("orders_count, total_spent_usd, last_order_id")
    .eq("id", persisted.customer_id)
    .single();
  if (customerAfterCancelError) throw customerAfterCancelError;
  assert.equal(Number(customerAfterCancel.orders_count), 0, "Clientes sigue contando el pedido cancelado.");
  assert.equal(Number(customerAfterCancel.total_spent_usd), 0, "Clientes conserva valor del pedido cancelado.");
  assert.equal(customerAfterCancel.last_order_id, null, "Clientes conserva el ultimo pedido cancelado.");

  const { count: ordersAfter, error: countAfterError } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id);
  if (countAfterError) throw countAfterError;
  assert.equal(ordersAfter, Number(ordersBefore) + 1, "La auditoria no creo exactamente un pedido.");
  assert.equal(browserErrors.length, 0, `Errores de navegador: ${browserErrors.join(" | ")}`);

  console.log(JSON.stringify({
    ok: true,
    store: store.name,
    order: { id: orderId, publicCode, finalStatus: "cancelled" },
    customerFlow: {
      product: product.name,
      subtotalUsd: Number(persisted.subtotal_usd),
      feeUsd: Number(persisted.platform_service_fee_usd),
      totalUsd: Number(persisted.total_usd),
      paymentMethod: persisted.payment_method,
      fulfillment: persisted.delivery_type,
      postCount,
    },
    merchantFlow: {
      realtimeInsertAndUpdate: true,
      protectedPanelApi: true,
      panelServerTiming: panelResponse.headers.get("server-timing"),
    },
    afterCancellation: {
      feeSnapshotPreserved: true,
      customerOrders: Number(customerAfterCancel.orders_count),
      customerProductValueUsd: Number(customerAfterCancel.total_spent_usd),
    },
    timings,
    screenshots: artifactsDir,
  }, null, 2));
} finally {
  try {
    await recoverCreatedOrder();
    await cancelCreatedOrder();
  } catch (error) {
    console.error(`ALERTA: no se pudo cancelar el pedido ${orderId || "sin crear"}: ${error.message}`);
  }
  if (browser) await browser.close();
  if (receiverChannel) await panelClient.removeChannel(receiverChannel);
  panelClient.realtime.disconnect();
  await panelClient.auth.signOut();
  if (userId) {
    await admin.from("store_users").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
}
