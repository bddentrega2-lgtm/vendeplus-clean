import { chromium } from "playwright";
import assert from "node:assert/strict";

const base = process.argv[2] || "http://127.0.0.1:3107";
const browser = await chromium.launch({ headless: true });
const expires = Math.floor(Date.now() / 1000) + 3600;
const user = { id: "10000000-0000-4000-8000-000000000001", email: "comprador@example.test", app_metadata: { providers: ["google"] }, user_metadata: {}, aud: "authenticated" };
const token = `${Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires })).toString("base64url")}.mock-signature`;
const session = { access_token: token, refresh_token: "test-only-not-real", expires_at: expires, expires_in: 3600, token_type: "bearer", user };
const errors = [];
let deleteRequests = 0;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(value => localStorage.setItem("somos_buyer_auth_v1", JSON.stringify(value)), session);
  await context.route("**/*", route => ["GET", "HEAD"].includes(route.request().method()) ? route.continue() : route.abort());
  await context.route("**/api/buyer/orders?*", route => route.fulfill({ json: { orders: [], hasMore: false } }));
  await context.route("**/api/buyer/account", route => {
    deleteRequests++;
    assert.equal(route.request().method(), "DELETE");
    assert.equal(route.request().headers().authorization, `Bearer ${token}`);
    assert.deepEqual(route.request().postDataJSON(), { confirmation: "ELIMINAR" });
    return route.fulfill({ json: { ok: true } });
  });
  await context.route("**/auth/v1/logout*", route => route.fulfill({ status: 204, body: "" }));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/mi-cuenta`);
  await Promise.all([
    page.waitForURL(url => url.pathname === "/eliminar-cuenta"),
    page.getByRole("link", { name: "Eliminar cuenta", exact: true }).click(),
  ]);
  assert.equal(new URL(page.url()).pathname, "/eliminar-cuenta");
  await page.getByText("Que se elimina", { exact: true }).waitFor();
  const confirmation = page.getByLabel("Escribe ELIMINAR para confirmar");
  const remove = page.getByRole("button", { name: "Eliminar mi cuenta", exact: true });
  assert.equal(await remove.isDisabled(), true);
  await confirmation.fill("eliminar"); assert.equal(await remove.isDisabled(), true);
  await confirmation.fill("ELIMINAR"); assert.equal(await remove.isEnabled(), true);
  for (const width of [320, 390, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const input = await confirmation.boundingBox();
    assert.ok(input.x >= 0 && input.x + input.width <= width);
  }
  await remove.click();
  await page.getByText("Cuenta eliminada", { exact: true }).waitFor();
  assert.equal(deleteRequests, 1);
  assert.deepEqual(errors, []);
  console.log("PASS: discoverable deletion, exact confirmation, bearer identity, local sign-out and responsive layout; API simulated");
} finally { await browser.close(); }
