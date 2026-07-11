import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "https://vendeplus-clean.vercel.app";
const storeSlug = process.env.E2E_STORE_SLUG || "armario";
const orderPayload = process.env.E2E_ORDER_PAYLOAD;

function url(path) {
  return new URL(path, baseUrl).toString();
}

async function expectOk(page, label) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  if (errors.length) {
    throw new Error(`${label}: errores de consola: ${errors.slice(0, 5).join(" | ")}`);
  }
}

async function runBrowserSmoke() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(url("/marketplace"), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expectOk(page, "marketplace");
    await page.goto(url(`/${storeSlug}`), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expectOk(page, "catalogo");
    await page.goto(url(`/${storeSlug}/carrito`), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expectOk(page, "carrito");
    await page.goto(url("/transporte/panel"), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expectOk(page, "panel empresa delivery");
  } finally {
    await browser.close();
  }
}

async function runControlledOrderCreation() {
  if (!orderPayload) {
    console.log("E2E_ORDER_PAYLOAD no definido; se omite creacion controlada de pedido.");
    return;
  }

  const response = await fetch(url("/api/orders"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: orderPayload,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Creacion de pedido fallo (${response.status}): ${data.error || "sin detalle"}`);
  }
  if (!data.orderId || !data.order?.totals) {
    throw new Error("Creacion de pedido sin orderId o totales.");
  }
  console.log(`Pedido controlado creado: ${data.orderId}`);
}

await runBrowserSmoke();
await runControlledOrderCreation();
console.log("E2E checkout smoke OK.");
