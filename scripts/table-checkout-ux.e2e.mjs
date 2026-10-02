import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseUrl = process.env.SOMOS_QA_BASE_URL || "http://127.0.0.1:3107";
const outputDir = new URL("../tmp/table-checkout-ux/", import.meta.url);
await mkdir(outputDir, { recursive: true });

const cart = [{
  productId: "qa-product",
  productName: "Producto de prueba con un nombre deliberadamente largo para validar el resumen final",
  productSlug: "producto-prueba",
  productImageUrl: "",
  quantity: 1,
  unitPriceUsd: 1,
  selectedOptions: [{
    groupId: "qa-group",
    groupName: "Primera seleccion extraordinariamente larga",
    valueId: "qa-value",
    valueName: "Opcion con descripcion extensa y sin recargo",
    priceDeltaUsd: 0,
    quantity: 1,
  }],
}];
const table = {
  storeToken: "qa-table-token",
  tableId: "qa-table-id",
  tableName: "Mesa 1",
  tableZone: "Adentro",
  paymentMethods: ["Efectivo", "Punto de venta"],
  fulfillmentMode: "table_service",
};

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    await page.addInitScript(({ cartValue, tableValue }) => {
      localStorage.setItem("vendeplus_cart_smash", JSON.stringify(cartValue));
      sessionStorage.setItem("somos_table_order_v1_smash", JSON.stringify(tableValue));
    }, { cartValue: cart, tableValue: table });
    await page.goto(`${baseUrl}/smash/checkout`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Finaliza tu pedido" }).waitFor();
    await page.getByText("¿Cómo deseas recibir tu pedido?", { exact: true }).waitFor({ state: "detached" });
    assert.equal(await page.getByText("¿Cómo deseas recibir tu pedido?", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Entrega en mesa", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Recibir en", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("heading", { name: "Datos del cliente", exact: true }).count(), 1);
    assert.equal(await page.getByRole("heading", { name: "¿Cómo vas a pagar?", exact: true }).count(), 1);
    assert.equal(await page.getByRole("heading", { name: "Indicaciones del pedido (opcional)", exact: true }).count(), 1);
    assert.equal(await page.getByLabel("Método de pago").count(), 1);

    const geometry = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      titleTops: Array.from(document.querySelectorAll("h2")).map((node) => node.getBoundingClientRect().top),
    }));
    assert.ok(geometry.bodyWidth <= geometry.viewportWidth + 1, JSON.stringify(geometry));
    assert.ok(geometry.titleTops.every((top) => Number.isFinite(top)));
    await page.screenshot({ path: fileURLToPath(new URL(`table-${width}.png`, outputDir)), fullPage: true });
    await context.close();
  }

  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    await page.addInitScript((cartValue) => {
      localStorage.setItem("vendeplus_cart_smash", JSON.stringify(cartValue));
      sessionStorage.removeItem("somos_table_order_v1_smash");
    }, cart);
    await page.goto(`${baseUrl}/smash/checkout`, { waitUntil: "networkidle" });
    assert.equal(await page.getByText("¿Cómo deseas recibir tu pedido?", { exact: true }).count(), 1);
    assert.equal(await page.getByRole("heading", { name: "Datos del cliente", exact: true }).count(), 1);
    assert.ok(await page.locator("select").count() >= 2);
    await page.getByText("Recordar mis datos para próximos pedidos.", { exact: true }).waitFor();

    const paymentMethod = page.locator("select").last();
    if (await paymentMethod.locator('option[value="Binance"]').count()) {
      await paymentMethod.selectOption("Binance");
      await page.getByRole("heading", { name: "Binance", exact: true }).waitFor();
    }

    const geometry = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      visualWidth: window.visualViewport?.width || window.innerWidth,
    }));
    assert.ok(geometry.bodyWidth <= geometry.viewportWidth + 1, JSON.stringify(geometry));
    assert.ok(geometry.documentWidth <= geometry.viewportWidth + 1, JSON.stringify(geometry));
    assert.equal(geometry.visualWidth, geometry.viewportWidth, JSON.stringify(geometry));
    await page.screenshot({ path: fileURLToPath(new URL(`regular-${width}.png`, outputDir)), fullPage: true });
    await context.close();
  }
  console.log("Table checkout UX: 5/5 PASS");
} finally {
  await browser.close();
}
