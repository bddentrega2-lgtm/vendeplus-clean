import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.SOMOS_QA_BASE_URL || "https://www.somos-ve.com";
const stores = (process.env.SOMOS_QA_STORES || "realza,queje-olga,shibui,joshi-sushi")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const widths = (process.env.SOMOS_QA_WIDTHS || "320,360,390")
  .split(",")
  .map(Number)
  .filter((value) => Number.isFinite(value) && value >= 280);
const modes = (process.env.SOMOS_QA_MODES || "web,native")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value === "web" || value === "native");
const maxDialogs = Math.max(1, Number(process.env.SOMOS_QA_MAX_DIALOGS || 4));
const output = "tmp/product-options-mobile-audit";

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

async function geometry(page) {
  return page.evaluate(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')]
      .find((node) => node.getClientRects().length);
    const viewport = {
      left: window.visualViewport?.offsetLeft || 0,
      top: window.visualViewport?.offsetTop || 0,
      width: window.visualViewport?.width || document.documentElement.clientWidth,
      height: window.visualViewport?.height || document.documentElement.clientHeight,
    };
    const viewportRight = viewport.left + viewport.width;
    const viewportBottom = viewport.top + viewport.height;
    const overflow = dialog ? [...dialog.querySelectorAll("*")]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return node.getClientRects().length && (rect.left < viewport.left - 0.5 || rect.right > viewportRight + 0.5);
      })
      .slice(0, 8)
      .map((node) => ({
        tag: node.tagName,
        text: (node.textContent || "").trim().slice(0, 100),
        left: Math.round(node.getBoundingClientRect().left),
        right: Math.round(node.getBoundingClientRect().right),
        width: Math.round(node.getBoundingClientRect().width),
        className: typeof node.className === "string" ? node.className.slice(0, 180) : "",
      })) : [];
    const dialogRect = dialog?.getBoundingClientRect();
    const overlay = dialog?.parentElement;
    const overlayRect = overlay?.getBoundingClientRect();
    return {
      viewport,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      dialog: dialogRect ? {
        label: dialog.getAttribute("aria-label"),
        left: Math.round(dialogRect.left),
        right: Math.round(dialogRect.right),
        width: Math.round(dialogRect.width),
        scrollWidth: dialog.scrollWidth,
        clientWidth: dialog.clientWidth,
      } : null,
      overlay: overlayRect ? {
        top: Math.round(overlayRect.top),
        bottom: Math.round(overlayRect.bottom),
        left: Math.round(overlayRect.left),
        right: Math.round(overlayRect.right),
        width: Math.round(overlayRect.width),
        height: Math.round(overlayRect.height),
      } : null,
      portal: Boolean(dialog?.closest(".product-modal-theme")),
      bodyOverflow: document.body.style.overflow,
      verticalOverflow: Boolean(dialogRect && (dialogRect.top < viewport.top - 1 || dialogRect.bottom > viewportBottom + 1)),
      overflow,
    };
  });
}

async function recordDialog(page, store, width, mode, product, stage) {
  const measured = await geometry(page);
  const failed = measured.documentWidth > measured.viewport.width + 1
    || measured.bodyWidth > measured.viewport.width + 1
    || !measured.portal
    || measured.bodyOverflow !== "hidden"
    || measured.verticalOverflow
    || Boolean(measured.overlay && (
      measured.overlay.left < measured.viewport.left - 1
      || measured.overlay.right > measured.viewport.left + measured.viewport.width + 1
      || measured.overlay.top < measured.viewport.top - 1
      || measured.overlay.bottom > measured.viewport.top + measured.viewport.height + 1
    ))
    || Boolean(measured.dialog && measured.dialog.scrollWidth > measured.dialog.clientWidth + 1)
    || measured.overflow.length > 0;
  const result = { store, width, mode, product, stage, failed, ...measured };
  results.push(result);
  if (failed) {
    const safe = `${store}-${width}-${mode}-${product}-${stage}`.replace(/[^a-z0-9-]+/gi, "-").slice(0, 140);
    await page.screenshot({ path: `${output}/${safe}.png`, fullPage: false });
  }
}

try {
  for (const width of widths) {
    for (const mode of modes) {
      for (const store of stores) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
      if (mode === "native") {
        await context.addInitScript(() => {
          window.Capacitor = { isNativePlatform: () => true };
        });
      }
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      await page.goto(`${base}/${store}`, { waitUntil: "domcontentloaded" });
      await page.locator(".catalog-product").first().waitFor();
      if (mode === "native") await page.locator("html.somos-native-app").waitFor();
      await page.evaluate(() => {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("vendeplus_cart_")) localStorage.removeItem(key);
        }
      });

      const products = page.locator(".catalog-product");
      const count = await products.count();
      let opened = 0;
      for (let index = 0; index < count; index += 1) {
        if (opened >= maxDialogs) break;
        const card = products.nth(index);
        if (!await card.count()) continue;
        const button = card.locator(".catalog-add");
        const heading = card.locator("h3").first();
        const product = await heading.count()
          ? (await heading.textContent({ timeout: 1000 }).catch(() => null))?.trim() || `producto-${index + 1}`
          : `producto-${index + 1}`;
        const variant = card.locator("select");
        if (await variant.count()) {
          const value = await variant.locator("option:not([disabled])").evaluateAll((options) => options.map((option) => option.value).find(Boolean) || "").catch(() => "");
          if (value) await variant.selectOption(value).catch(() => {});
        }
        if (!await button.count() || await button.isDisabled({ timeout: 1000 }).catch(() => true)) continue;
        if (!await button.click({ force: true, timeout: 2000 }).then(() => true).catch(() => false)) continue;
        await page.waitForTimeout(180);
        const dialog = page.locator('[role="dialog"]:visible').last();
        if (!await dialog.count()) continue;
        opened += 1;

        const label = await dialog.getAttribute("aria-label") || "dialog";
        await recordDialog(page, store, width, mode, product, label.startsWith("Presentaciones") ? "variants" : "options");

        if (label.startsWith("Presentaciones")) {
          const choice = dialog.locator("button").filter({ hasNot: page.locator('[aria-label="Cerrar"]') }).first();
          const choices = dialog.locator("button").filter({ hasNot: page.locator('[aria-label="Cerrar"]') });
          if (await choices.count()) {
            await choice.click();
            await page.waitForTimeout(220);
            const options = page.locator('[role="dialog"]:visible').last();
            if (await options.count()) await recordDialog(page, store, width, mode, product, "options-after-variant");
          }
        }

        const close = page.locator('[role="dialog"]:visible button[aria-label^="Cerrar"]').last();
        if (await close.count()) await close.click({ force: true, timeout: 2000 }).catch(() => {});
      }
      await context.close();
    }
    }
  }
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
}

const failures = results.filter((result) => result.failed);
console.log(JSON.stringify({ base, modes, dialogs: results.length, failures: failures.length, byStore: Object.fromEntries(stores.map((store) => [store, { dialogs: results.filter((result) => result.store === store).length, failures: failures.filter((result) => result.store === store).length }])) }, null, 2));
if (!results.length) throw new Error("No customization dialogs were found.");
assert.equal(failures.length, 0, `${failures.length} dialogs overflow; inspect ${output}/results.json`);
