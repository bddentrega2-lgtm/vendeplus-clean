import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] || "http://127.0.0.1:3107";
const output = "tmp/buyer-staging/review-observation";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const user = { id: "10000000-0000-4000-8000-000000000001", email: "comprador@example.test", app_metadata: { providers: ["google"] }, user_metadata: {}, aud: "authenticated" };
const expires = Math.floor(Date.now() / 1000) + 3600;
const token = `${Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires })).toString("base64url")}.mock-signature`;
const session = { access_token: token, refresh_token: "test-only-not-real", expires_at: expires, expires_in: 3600, token_type: "bearer", user };
const order = { id: "30000000-0000-4000-8000-000000000001", public_code: "SO-TEST-001", status: "completed", created_at: "2026-09-29T12:00:00Z", total_usd: 2, rating: 5, observation: null, stores: { name: "Cocina Demo", slug: "cocina-demo" }, order_items: [{ product_name: "Bebida Demo", quantity: 1, total_usd: 2 }] };
const errors = [];
let fail = false, writes = 0;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // All authentication and review writes below are simulated, never sent remotely.
  await context.route("**/*", route => ["GET", "HEAD"].includes(route.request().method()) ? route.continue() : route.abort());
  await context.addInitScript(value => localStorage.setItem("somos_buyer_auth_v1", JSON.stringify(value)), session);
  await context.route("**/api/buyer/orders?*", route => route.fulfill({ json: { orders: [order], hasMore: false } }));
  await context.route("**/api/buyer/reviews", route => {
    writes++;
    const body = route.request().postDataJSON();
    assert.equal(body.orderId, order.id);
    if (fail) return route.fulfill({ status: 503, json: { error: "No pudimos guardar la calificacion." } });
    order.rating = body.rating; order.observation = body.observation || null;
    return route.fulfill({ json: { ok: true } });
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/mi-cuenta`);
  const note = page.getByLabel("Observacion (opcional)");
  const save = page.getByRole("button", { name: "Guardar calificacion", exact: true });
  await note.waitFor();
  assert.equal(await save.isDisabled(), true);
  await note.fill("Excelente atencion y entrega puntual.");
  assert.equal(await save.isEnabled(), true);
  for (const width of [320, 390, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const bounds = await note.boundingBox(), button = await save.boundingBox();
    assert.ok(bounds.width > 200 && bounds.x >= 0 && bounds.x + bounds.width <= width);
    assert.ok(button.y >= bounds.y + bounds.height);
    await page.screenshot({ path: `${output}/form-${width}.png`, fullPage: true });
  }
  await save.click();
  await page.getByText("Calificacion guardada.", { exact: true }).waitFor();
  await page.reload();
  await note.waitFor();
  assert.equal(await note.inputValue(), "Excelente atencion y entrega puntual.");
  assert.equal(await page.getByRole("radio", { name: "5 estrellas", exact: true }).isChecked(), true);
  await note.fill("<script>window.__unsafe = true</script>");
  await save.click();
  await page.getByText("Calificacion guardada.", { exact: true }).waitFor();
  await page.reload(); await note.waitFor();
  assert.equal(await note.inputValue(), "<script>window.__unsafe = true</script>");
  assert.equal(await page.evaluate(() => window.__unsafe), undefined);
  await note.fill("x".repeat(500));
  await note.press("End"); await note.press("y");
  assert.equal((await note.inputValue()).length, 500);
  fail = true;
  await save.click();
  await page.getByText("No pudimos guardar la calificacion.", { exact: true }).waitFor();
  assert.equal((await note.inputValue()).length, 500);
  assert.equal(await save.isEnabled(), true);
  fail = false;
  await note.fill(""); await save.click();
  await page.getByText("Calificacion guardada.", { exact: true }).waitFor();
  await page.reload(); await note.waitFor();
  assert.equal(await note.inputValue(), "");
  assert.equal(await page.getByRole("radio", { name: "5 estrellas", exact: true }).isChecked(), true);
  assert.equal(writes, 4); assert.deepEqual(errors, []);
  console.log("PASS: 320/390/1366 layout, observation-only edit, reload, plain text, limit, failure retry, clear; simulated session/API, no remote writes");
} finally { await browser.close(); }
