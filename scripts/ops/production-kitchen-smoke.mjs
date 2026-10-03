import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const base = process.env.QA_BASE_URL || "https://www.somos-ve.com";
assert.match(base, /^https:\/\/(?:www\.somos-ve\.com|vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app)$/);
const productionRef = "rvmtjtuztewcrmodrodb";
const env = parseEnv(readFileSync("../.env.local", "utf8"));
assert.match(env.NEXT_PUBLIC_SUPABASE_URL || "", new RegExp(productionRef));

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const createdUsers = [];
let browser;

function expectData(result) {
  if (result.error) throw result.error;
  return result.data;
}

async function createOperator(storeId) {
  const email = `production-kitchen-smoke-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString("base64url");
  const user = expectData(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  createdUsers.push({ userId: user.id, storeId });
  expectData(await admin.from("store_users").insert({ store_id: storeId, user_id: user.id, role: "owner" }));
  const auth = expectData(await publicClient().auth.signInWithPassword({ email, password }));
  return auth.session.access_token;
}

async function requestKitchen(token, storeId) {
  const response = await fetch(`${base}/api/panel/kitchen?view=board`, {
    headers: { Authorization: `Bearer ${token}`, "X-Panel-Store-Id": storeId },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json();
  assert.equal(response.status, 200, body.error || "Kitchen API failed");
  return body;
}

async function browserContext(token) {
  const session = await fetch(`${base}/api/auth/panel-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: token }),
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(session.status, 200);
  const cookies = session.headers.getSetCookie().map(value => {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    return { name: pair.slice(0, separator), value: pair.slice(separator + 1), url: base, httpOnly: true, secure: true, sameSite: "Lax" };
  });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.addCookies(cookies);
  await context.addInitScript(value => sessionStorage.setItem("vendeplus_panel_token", value), token);
  return context;
}

try {
  const stores = expectData(await admin.from("stores").select("id,slug,is_active,subscription_status,table_orders_access_enabled,table_orders_enabled"));
  const eligible = stores.filter(store => store.table_orders_access_enabled && store.table_orders_enabled);
  const ineligible = stores.find(store => store.is_active && store.subscription_status === "active" && (!store.table_orders_access_enabled || !store.table_orders_enabled));
  assert.deepEqual(eligible.map(store => store.slug).sort(), ["belli-burger", "pasteleria-tdk", "pollos-gran-combo-andres-bello", "smash"]);
  assert.ok(ineligible, "Expected an active store without Mesa/Barra.");

  const ineligibleToken = await createOperator(ineligible.id);
  const ineligibleApi = await requestKitchen(ineligibleToken, ineligible.id);
  assert.equal(ineligibleApi.eligible, false);
  assert.deepEqual(ineligibleApi.tickets, []);

  browser = await chromium.launch({ headless: true });
  const browserErrors = [];
  const visible = [];
  for (const store of eligible) {
    const token = await createOperator(store.id);
    const kitchenApi = await requestKitchen(token, store.id);
    assert.equal(kitchenApi.eligible, true);
    const context = await browserContext(token);
    const page = await context.newPage();
    page.on("pageerror", error => browserErrors.push(`${store.slug}: ${error.message}`));
    await page.goto(`${base}/panel/cocina`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Comandas", exact: true }).waitFor({ timeout: 30_000 });
    await page.getByRole("status").filter({ hasText: "En vivo" }).waitFor({ timeout: 15_000 });
    assert.equal(await page.getByRole("link", { name: "Cocina", exact: true }).count(), 1);
    visible.push(store.slug);
    await context.close();
  }

  const ineligibleContext = await browserContext(ineligibleToken);
  const ineligiblePage = await ineligibleContext.newPage();
  ineligiblePage.on("pageerror", error => browserErrors.push(error.message));
  await ineligiblePage.goto(`${base}/panel/cocina`, { waitUntil: "domcontentloaded" });
  await ineligiblePage.getByRole("heading", { name: "Cocina no disponible", exact: true }).waitFor({ timeout: 30_000 });
  assert.equal(await ineligiblePage.getByRole("link", { name: "Cocina", exact: true }).count(), 0);
  await ineligibleContext.close();
  assert.deepEqual(browserErrors, []);

  console.log(JSON.stringify({ pass: true, eligibleStores: visible.sort(), ineligibleStore: ineligible.slug, eligibleNavVisible: true, ineligibleNavVisible: false, realtime: "En vivo", browserErrors: 0 }));
} finally {
  if (browser) await browser.close().catch(() => {});
  const cleanupErrors = [];
  for (const entry of createdUsers.reverse()) {
    const membership = await admin.from("store_users").delete().eq("store_id", entry.storeId).eq("user_id", entry.userId);
    if (membership.error) cleanupErrors.push(membership.error.message);
    const user = await admin.auth.admin.deleteUser(entry.userId);
    if (user.error) cleanupErrors.push(user.error.message);
  }
  assert.deepEqual(cleanupErrors, [], "Temporary production access must be removed.");
}
