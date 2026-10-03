import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { chromium } from "playwright";

const baseUrl = process.env.SOMOS_QA_BASE_URL || "http://127.0.0.1:3107";
const output = new URL("../tmp/printing-center/", import.meta.url);
await mkdir(output, { recursive: true });

const env = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8").catch(
  () => readFile(new URL("../../.env.local", import.meta.url), "utf8"),
));
const secret = env.PANEL_SESSION_COOKIE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_JWT_SECRET;
assert.ok(secret, "Falta el secreto local para firmar la sesion QA.");
const payload = Buffer.from(JSON.stringify({
  sid: "qa-printing-session",
  secret: "qa",
  sub: "qa-printing-user",
  email: "qa-printing@example.invalid",
  exp: Math.floor(Date.now() / 1000) + 3600,
  founder: false,
})).toString("base64url");
const signature = createHmac("sha256", secret).update(payload).digest("base64url");

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    await context.addCookies([{ name: "somos_panel_session", value: `${payload}.${signature}`, url: baseUrl, httpOnly: true }]);
    await context.addInitScript(() => {
      sessionStorage.setItem("vendeplus_panel_token", `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.qa`);
      window.Capacitor = {
        isNativePlatform: () => true,
        Plugins: {
          SomosPrinter: {
            getStatus: async () => ({ supported: true, enabled: true, permission: true, paired: true, printerAddress: "AA:BB", printerName: "TIII" }),
            requestPermissions: async () => ({ granted: true }),
            getPairedPrinters: async () => ({ printers: [{ name: "TIII Bluetooth Printer", address: "AA:BB", type: 1 }] }),
            selectPrinter: async () => ({ saved: true }),
            savePairingToken: async () => ({ saved: true }),
            clearPairing: async () => ({ cleared: true }),
            printTest: async () => ({ sent: true }),
            processQueue: async () => ({ processed: 0 }),
            setAutoPrint: async ({ enabled }) => ({ enabled }),
            registerPush: async () => ({ registered: true }),
          },
        },
      };
    });

    let retries = 0;
    await context.route("**/api/panel/context", (route) => route.fulfill({ json: {
      userId: "qa-printing-user",
      isFounderMode: false,
      stores: [{ id: "store-a", slug: "qa-store", name: "Comercio QA", subscription_status: "active" }],
      selectedStoreId: "store-a",
      achievementFeatures: {},
      achievements: [],
    } }));
    await context.route("**/api/panel/printing/settings", (route) => route.fulfill({ json: {
      settings: { is_enabled: true, trigger_mode: "both", paper_width_mm: 58, copies: 1, include_prices: false },
    } }));
    await context.route("**/api/panel/printing/status", async (route) => {
      if (route.request().method() === "PATCH") {
        assert.equal(route.request().headers()["x-panel-store-id"], "store-a");
        assert.deepEqual(route.request().postDataJSON(), { jobId: "job-failed" });
        retries += 1;
        return route.fulfill({ json: { queued: true } });
      }
      return route.fulfill({ json: {
        devices: [{
          id: "device-a",
          name: "Samsung A34 de caja",
          platform: "android",
          app_version: "1.5.0",
          last_seen_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          push_ready: true,
        }],
        jobs: [
          {
            id: "job-failed",
            order_id: "order-a",
            order_code: "SO-1002-123456",
            event_type: "manual",
            status: "failed",
            attempts: 5,
            can_retry: true,
            error_message: "La impresora no respondio. Revisa que este encendida y cerca del telefono.",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "job-printed",
            order_id: "order-b",
            order_code: "SO-1002-123455",
            event_type: "paid",
            status: "printed",
            attempts: 1,
            printed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        summary: { pending: 0, failed: 1, last_printed_at: new Date().toISOString() },
      } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/panel/impresion`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Estado de impresion" }).waitFor();
    const tutorial = page.getByRole("button", { name: "Cerrar tutorial" });
    if (await tutorial.isVisible()) await tutorial.click();
    assert.equal(await page.getByText("Samsung A34 de caja", { exact: true }).isVisible(), true);
    assert.equal(await page.getByText("Avisos activos", { exact: true }).isVisible(), true);
    assert.equal(await page.getByText("SO-1002-123456", { exact: true }).isVisible(), true);
    assert.equal(await page.getByText("SO-1002-123455", { exact: true }).isVisible(), true);
    const geometry = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      html: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    assert.ok(geometry.body <= geometry.viewport + 1, JSON.stringify(geometry));
    assert.ok(geometry.html <= geometry.viewport + 1, JSON.stringify(geometry));
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await page.getByText("Comanda enviada nuevamente a la impresora.", { exact: true }).waitFor();
    assert.equal(retries, 1);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: fileURLToPath(new URL(`center-${width}.png`, output)), fullPage: true });
    results.push({ width, pass: true, geometry });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(new URL("results.json", output), JSON.stringify(results, null, 2));
}

console.log(`PASS centro de impresion movil (${results.length}/2)`);
