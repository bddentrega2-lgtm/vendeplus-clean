// ADB forwards only the Somos WebView debug socket. No account or order is created.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const port = Number(process.env.SOMOS_QA_CDP_PORT);
const origin = process.env.SOMOS_QA_BASE_URL;
if (!Number.isInteger(port) || port < 1024 || port > 65535 || !/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/.test(origin || "")) throw new Error("Provide the exact preview and a local ADB forward port");
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 15000 });
try {
  const page = browser.contexts().flatMap(context => context.pages()).find(page => page.url().startsWith(`${origin}/`));
  assert.ok(page, "Expected Somos Preview WebView");
  await page.waitForFunction(() => Boolean(window.Capacitor?.Plugins?.SomosOrderAlerts), null, { timeout: 15000 });
  const status = await page.evaluate(() => window.Capacitor.Plugins.SomosOrderAlerts.status());
  assert.equal(status.granted, true, "Notification permission must already be granted; this test never changes permissions");
  await page.evaluate(() => window.Capacitor.Plugins.SomosOrderAlerts.show({ id: `qa-device:${Date.now()}`, test: true }));
  console.log("PASS native bridge and real Android test notification accepted; audible playback needs human confirmation");
} finally { await browser.close(); }
