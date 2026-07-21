import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.QA_BASE_URL || "https://somos-ve.com";
const runId = process.env.QA_RUN_ID || `QA-ARM-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
const storeSlug = "armario-qa-load";
const agencySlug = "mandamelo-qa-load";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

function assertEnv() {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`Falta ${key}`);
  }
}

function countBy(rows, key) {
  return Object.fromEntries([...rows.reduce((map, row) => map.set(String(row[key] || "null"), (map.get(String(row[key] || "null")) || 0) + 1), new Map()).entries()].sort());
}

async function one(table, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function setup() {
  const sourceStore = await one("stores", admin.from("stores").select("*").eq("slug", "armario").single());
  const sourceAgency = await one("transport_agencies", admin.from("transport_agencies").select("*").eq("slug", "mandamelo").single());
  const store = await one("stores", admin.from("stores").upsert({
    slug: storeSlug, name: "Armario QA Load", description: `[${runId}] Entorno automatizado; no operar.`,
    address: sourceStore.address, latitude: sourceStore.latitude, longitude: sourceStore.longitude,
    whatsapp: "", is_active: true, accepts_delivery: true, accepts_pickup: true,
    business_type: sourceStore.business_type, payment_methods: ["Pago movil", "Transferencia", "Efectivo", "Zelle"],
    usd_to_bs: sourceStore.usd_to_bs, base_currency: sourceStore.base_currency || "USD",
    manual_open_status: "open", manual_open_note: "QA automatizado", plan_type: "monthly",
    service_fee_payer: "merchant", service_fee_billing_cycle: "monthly",
  }, { onConflict: "slug" }).select("*").single());
  const agency = await one("transport_agencies", admin.from("transport_agencies").upsert({
    slug: agencySlug, name: "Mandamelo QA Load", legal_name: "Mandamelo QA Load", contact_name: "QA Automatizado",
    contact_email: "qa-mandamelo@invalid.local", contact_phone: "+580000000000", whatsapp_phone: "+580000000000", city: sourceAgency.city,
    state: sourceAgency.state, coverage_notes: `[${runId}] No operar`, modality: "mixed", pricing_type: "flat",
    status: "active", is_active: true, billing_currency: "USD", rates_visibility: sourceAgency.rates_visibility,
  }, { onConflict: "slug" }).select("*").single());

  let products = await one("products", admin.from("products").select("*").eq("store_id", store.id));
  if (!products.length) {
    const sourceProducts = await one("products", admin.from("products").select("*").eq("store_id", sourceStore.id).eq("is_available", true).limit(8));
    products = await one("products", admin.from("products").insert(sourceProducts.map((p, index) => ({
      store_id: store.id, category_id: null, name: `${p.name} QA`, description: p.description,
      price_usd: p.price_usd, image_url: p.image_url, is_available: true, is_featured: index < 2, sort_order: index,
    }))).select("*"));
  }
  const connection = await one("connection", admin.from("store_transport_agency_connections").upsert({
    store_id: store.id, agency_id: agency.id, status: "active", is_default: true, is_exclusive: true,
    disengagement_requested_at: null, disengagement_confirmed_at: null, disengagement_effective_at: null,
  }, { onConflict: "store_id,agency_id" }).select("*").single());
  await one("rate", admin.from("transport_agency_rates").upsert({ agency_id: agency.id, flat_fee_usd: 3, max_distance_km: 30, is_active: true }, { onConflict: "agency_id" }));
  await one("settings", admin.from("store_delivery_settings").upsert({
    store_id: store.id, delivery_enabled: true, pickup_enabled: true, delivery_provider: "transport_agency",
    pricing_type: "fixed", fixed_fee_usd: 3, max_distance_km: 30,
    transport_agency_connection_id: connection.id, transport_agency_id: agency.id,
  }, { onConflict: "store_id" }));
  return { store, agency, products };
}

async function createPanelSession(storeId) {
  const email = `qa-panel-${randomUUID()}@invalid.local`;
  const password = `Qa!${randomUUID()}aA1`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await one("store_users", admin.from("store_users").insert({ store_id: storeId, user_id: data.user.id, role: "owner" }));
  const session = await anon.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw session.error || new Error("No se creó sesión QA");
  return { token: session.data.session.access_token, userId: data.user.id };
}

async function createAgencySession(agencyId) {
  const email = `qa-agency-${randomUUID()}@invalid.local`;
  const password = `Qa!${randomUUID()}aA1`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await one("transport_agency_users", admin.from("transport_agency_users").insert({ agency_id: agencyId, user_id: data.user.id, email, role: "owner" }));
  const session = await anon.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw session.error || new Error("No se creó sesión de agencia QA");
  return { token: session.data.session.access_token, userId: data.user.id };
}

function payload({ store, products, index }) {
  const delivery = index % 5 !== 4;
  const method = ["Pago movil", "Transferencia", "Efectivo", "Zelle"][index % 4];
  const selected = products.slice(0, 1 + (index % Math.min(3, products.length))).map((p, itemIndex) => ({
    productId: p.id, productName: p.name, productSlug: `qa-${p.id}`, productImageUrl: p.image_url || "",
    quantity: 1 + ((index + itemIndex) % 2), unitPriceUsd: 0.01, notes: `[${runId}] precio cliente manipulado`, selectedOptions: [],
  }));
  return { storeId: store.id, order: {
    id: `${runId}-${String(index + 1).padStart(3, "0")}`, storeSlug, storeName: store.name, createdAt: new Date().toISOString(), items: selected,
    form: { customerName: `Cliente QA ${index % 3}`, customerPhone: `+5800000${String(index % 3).padStart(4, "0")}`,
      deliveryType: delivery ? "delivery" : "pickup", paymentMethod: method,
      paymentReference: method !== "Efectivo" && index % 2 === 0 ? `REF-QA-${index}` : "",
      deliveryReference: delivery ? `Dirección QA controlada ${index}` : "", deliveryZoneId: "",
      orderDetails: `[${runId}] NO OPERAR`, notes: `[${runId}] prueba automatizada` },
    location: delivery ? { latitude: Number(store.latitude) + 0.003 + index * 0.0001, longitude: Number(store.longitude) + 0.003, label: `Ubicación QA ${index}`, source: "gps", accuracyMeters: 10 } : null,
    quote: { distanceKm: null, feeUsd: delivery ? 3 : 0, label: delivery ? "QA" : "Retiro", source: delivery ? "manual" : "pickup", available: true, provider: delivery ? "transport_agency" : undefined, pricingType: delivery ? "fixed_distance" : undefined },
    totals: { subtotalUsd: 0.01, deliveryUsd: 0, totalUsd: 0.01, totalBs: 1 }, mapsUrl: null, routeUrl: null, whatsappMessage: "", whatsappUrl: "",
  }};
}

async function runCanary(count = 5) {
  const context = await setup();
  const session = await createPanelSession(context.store.id);
  const results = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const started = performance.now();
      const publicCode = `${runId}-${String(index + 1).padStart(3, "0")}`;
      let orderRow = await one("existing order", admin.from("orders").select("id, public_code, delivery_type, delivery_provider, subtotal_usd, delivery_usd, total_usd, payment_method, payment_status").eq("store_id", context.store.id).eq("public_code", publicCode).maybeSingle());
      if (!orderRow) {
        const response = await fetch(`${baseUrl}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json", "x-qa-run-id": runId }, body: JSON.stringify(payload({ ...context, index })) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`Pedido ${index + 1}: HTTP ${response.status} ${data.error || ""}`);
        orderRow = await one("order", admin.from("orders").select("id, public_code, delivery_type, delivery_provider, subtotal_usd, delivery_usd, total_usd, payment_method, payment_status").eq("id", data.orderId).single());
      }
      let handoff = null;
      if (orderRow.delivery_type === "delivery") {
        const existingHandoff = await one("existing handoff", admin.from("transport_orders").select("id").eq("order_id", orderRow.id).maybeSingle());
        if (existingHandoff) handoff = existingHandoff;
        else {
          const handoffResponse = await fetch(`${baseUrl}/api/panel/orders/${orderRow.id}/send-delivery`, { method: "POST", headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" }, body: "{}" });
          handoff = await handoffResponse.json().catch(() => ({}));
          if (!handoffResponse.ok) throw new Error(`Envío ${index + 1}: HTTP ${handoffResponse.status} ${handoff.error || ""}`);
        }
      }
      results.push({ ...orderRow, latencyMs: Math.round(performance.now() - started), handoff: Boolean(handoff) });
    }
  } finally {
    await admin.auth.admin.deleteUser(session.userId);
  }
  console.log(JSON.stringify({ runId, baseUrl, created: results.length, results }, null, 2));
}

async function verify() {
  const store = await one("stores", admin.from("stores").select("id").eq("slug", storeSlug).single());
  const orders = await one("orders", admin.from("orders").select("id,public_code,delivery_type,payment_method,payment_status,subtotal_usd,delivery_usd,total_usd").eq("store_id", store.id).like("public_code", `${runId}-%`).order("created_at"));
  const ids = orders.map((o) => o.id);
  const transports = ids.length ? await one("transport_orders", admin.from("transport_orders").select("id,order_id,status,connection_id").in("order_id", ids)) : [];
  const transportIds = transports.map((row) => row.id);
  const [items, integrations, events, customers] = await Promise.all([
    ids.length ? one("order_items", admin.from("order_items").select("id,order_id").in("order_id", ids)) : [],
    ids.length ? one("order_integrations", admin.from("order_integrations").select("id,order_id,provider,status").in("order_id", ids)) : [],
    transportIds.length ? one("transport_order_events", admin.from("transport_order_events").select("id,transport_order_id,event_type,status_to").in("transport_order_id", transportIds)) : [],
    one("customers", admin.from("customers").select("id").eq("store_id", store.id)),
  ]);
  console.log(JSON.stringify({ runId, orders: orders.length, delivery: orders.filter((o) => o.delivery_type === "delivery").length, pickup: orders.filter((o) => o.delivery_type === "pickup").length, orderItems: items.length, customers: customers.length, transportOrders: transports.length, transportEvents: events.length, integrations: integrations.length, missingConnections: transports.filter((o) => !o.connection_id).length, paymentMethods: countBy(orders, "payment_method"), paymentStatuses: countBy(orders, "payment_status"), transportStatuses: countBy(transports, "status"), ...(process.env.QA_VERBOSE === "true" ? { orders } : {}) }, null, 2));
}

async function cleanup() {
  if (process.env.QA_CONFIRM_CLEANUP !== runId) throw new Error(`Para limpiar define QA_CONFIRM_CLEANUP=${runId}`);
  const store = await one("stores", admin.from("stores").select("id,slug,name").eq("slug", storeSlug).single());
  const agency = await one("transport_agencies", admin.from("transport_agencies").select("id,slug,name").eq("slug", agencySlug).single());
  if (store.slug !== storeSlug || agency.slug !== agencySlug) throw new Error("Los recursos no coinciden con los slugs QA");
  const { count: realOrderCount, error: countError } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("store_id", store.id).not("public_code", "like", `${runId}-%`);
  if (countError) throw countError;
  if (Number(realOrderCount || 0) > 0) throw new Error("La tienda QA contiene pedidos fuera del run autorizado");
  await one("delete store", admin.from("stores").delete().eq("id", store.id).eq("slug", storeSlug));
  await one("delete agency", admin.from("transport_agencies").delete().eq("id", agency.id).eq("slug", agencySlug));
  console.log(JSON.stringify({ cleaned: true, runId, storeSlug, agencySlug }, null, 2));
}

async function exerciseStates() {
  const store = await one("stores", admin.from("stores").select("id").eq("slug", storeSlug).single());
  const agency = await one("transport_agencies", admin.from("transport_agencies").select("id").eq("slug", agencySlug).single());
  const orders = await one("orders", admin.from("orders").select("id,public_code,total_usd,delivery_type").eq("store_id", store.id).like("public_code", `${runId}-%`).order("public_code"));
  const transports = await one("transport_orders", admin.from("transport_orders").select("id,order_id,status").eq("agency_id", agency.id).order("created_at"));
  const panel = await createPanelSession(store.id);
  const transport = await createAgencySession(agency.id);
  const summary = { payments: 0, pickupStatuses: 0, transportTransitions: 0, invalidTransitionsRejected: 0 };
  try {
    for (let index = 0; index < Math.min(40, orders.length); index += 1) {
      const order = orders[index];
      const paymentStatus = ["verified", "review", "pending", "incomplete", "cancelled"][index % 5];
      const response = await fetch(`${baseUrl}/api/panel/orders/${order.id}/payment`, { method: "PATCH", headers: { Authorization: `Bearer ${panel.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ paymentStatus, paymentReference: `QA-${index}`, paymentCurrency: "USD", amountPaid: paymentStatus === "verified" ? order.total_usd : null, paymentNotes: `[${runId}]` }) });
      if (!response.ok) throw new Error(`Pago ${order.public_code}: ${response.status} ${await response.text()}`);
      summary.payments += 1;
    }
    for (const order of orders.filter((row) => row.delivery_type === "pickup").slice(0, 10)) {
      const status = ["accepted", "preparing", "ready", "completed", "cancelled"][summary.pickupStatuses % 5];
      const response = await fetch(`${baseUrl}/api/panel/orders`, { method: "PATCH", headers: { Authorization: `Bearer ${panel.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id, status }) });
      if (!response.ok) throw new Error(`Estado comercio ${order.public_code}: ${response.status} ${await response.text()}`);
      summary.pickupStatuses += 1;
    }
    const paths = [
      ["agency_received", "agency_accepted", "picked_up", "on_the_way", "delivered"],
      ["agency_received", "agency_rejected"],
      ["agency_accepted", "on_the_way", "delivery_failed"],
      ["agency_received", "issue_reported"],
      ["agency_accepted"],
      ["agency_received", "agency_accepted", "picked_up"],
      ["agency_received", "agency_accepted", "on_the_way"],
      ["cancelled"],
    ];
    for (let index = 0; index < Math.min(40, transports.length); index += 1) {
      const entry = transports[index];
      for (const status of paths[index % paths.length]) {
        const response = await fetch(`${baseUrl}/api/transport/panel/orders/${entry.id}/status`, { method: "PATCH", headers: { Authorization: `Bearer ${transport.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status, note: `[${runId}] escenario ${index}` }) });
        if (!response.ok) throw new Error(`Transición ${entry.id} -> ${status}: ${response.status} ${await response.text()}`);
        summary.transportTransitions += 1;
      }
    }
    const delivered = await one("delivered", admin.from("transport_orders").select("id").eq("agency_id", agency.id).eq("status", "delivered").limit(1).maybeSingle());
    if (delivered) {
      const invalid = await fetch(`${baseUrl}/api/transport/panel/orders/${delivered.id}/status`, { method: "PATCH", headers: { Authorization: `Bearer ${transport.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "agency_received" }) });
      if (invalid.status !== 400) throw new Error(`Transición inválida no fue rechazada: ${invalid.status}`);
      summary.invalidTransitionsRejected += 1;
    }
  } finally {
    await admin.auth.admin.deleteUser(panel.userId);
    await admin.auth.admin.deleteUser(transport.userId);
  }
  console.log(JSON.stringify({ runId, summary }, null, 2));
}

assertEnv();
const command = process.argv[2] || "verify";
if (command === "setup") console.log(JSON.stringify(await setup(), null, 2));
else if (command === "canary") await runCanary(Number(process.argv[3] || 5));
else if (command === "verify") await verify();
else if (command === "cleanup") await cleanup();
else if (command === "exercise") await exerciseStates();
else throw new Error(`Comando no soportado: ${command}`);
