import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.SOMOS_QA_BASE_URL || "https://www.somos-ve.com";
const stores = (process.env.SOMOS_QA_STORES || "realza,queje-olga")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const targetProducts = {
  realza: /sicos cuello redondo, 3x25/i,
  "queje-olga": /Hallacas/i,
};

const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const store of stores) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    page.setDefaultTimeout(30000);
    await page.goto(`${base}/${store}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.evaluate((slug) => localStorage.removeItem(`vendeplus_cart_${slug}`), store);

    const target = targetProducts[store];
    assert.ok(target, `Falta producto de prueba para ${store}`);
    const card = page.locator(".catalog-product").filter({
      has: page.locator("h3").filter({ hasText: target }),
    }).last();
    assert.equal(await card.count(), 1, `No se encontro ${target} en ${store}`);
    const variant = card.locator("select");
    if (await variant.count()) {
      const value = await variant.locator("option:not([disabled])").evaluateAll((options) => (
        options.map((option) => option.value).find(Boolean) || ""
      ));
      if (value) await variant.selectOption(value);
    }
    await card.locator(".catalog-add").evaluate((element) => element.click());
    const dialog = page.locator('[role="dialog"]:visible').last();
    await dialog.waitFor();
    const fields = dialog.locator("fieldset");
    for (let index = 0; index < await fields.count(); index += 1) {
      const field = fields.nth(index);
      const input = field.locator("input:enabled").first();
      if (await input.count()) await input.check().catch(() => {});
      const select = field.locator("select").first();
      if (await select.count()) {
        const value = await select.locator("option").evaluateAll((options) => (
          options.map((option) => option.value).find(Boolean) || ""
        ));
        if (value) await select.selectOption(value);
      }
    }

    await page.evaluate((slug) => localStorage.removeItem(`vendeplus_cart_${slug}`), store);
    const confirm = dialog.locator("button").filter({ hasText: /adir al carrito/i }).last();
    assert.equal(await confirm.isDisabled(), false, `El boton de carrito esta deshabilitado en ${store}`);
    await confirm.evaluate((element) => element.click());
    await dialog.waitFor({ state: "hidden", timeout: 3000 });

    const result = await page.evaluate((slug) => {
      const cart = JSON.parse(localStorage.getItem(`vendeplus_cart_${slug}`) || "[]");
      const bar = document.querySelector(".vp-safe-bottom");
      const rect = bar?.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop || 0;
      const height = viewport?.height || document.documentElement.clientHeight;
      return {
        store: slug,
        items: Array.isArray(cart) ? cart.length : 0,
        barVisible: Boolean(bar && bar.getClientRects().length),
        barTop: rect?.top ?? null,
        barBottom: rect?.bottom ?? null,
        viewportTop: top,
        viewportBottom: top + height,
        bodyOverflow: document.body.style.overflow,
        dialogs: [...document.querySelectorAll('[role="dialog"]')].filter((node) => node.getClientRects().length).length,
        modalPortals: document.querySelectorAll(".product-modal-theme").length,
      };
    }, store);
    result.failed = result.items !== 1
      || !result.barVisible
      || result.barTop < result.viewportTop
      || result.barBottom > result.viewportBottom + 1
      || result.dialogs !== 0
      || result.modalPortals !== 0;
    results.push(result);
    await page.screenshot({ path: `tmp/${store}-cart-bar-mobile.png`, fullPage: false });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ base, results }, null, 2));
assert.equal(results.filter((result) => result.failed).length, 0, "La barra del carrito no queda visible.");
