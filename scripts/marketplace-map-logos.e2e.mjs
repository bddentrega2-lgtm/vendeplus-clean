import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const native = process.argv.includes('--native');
const output = native ? "tmp/map-logos/native" : "tmp/map-logos";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [], errors = [], logos = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route("**/*", route => ["GET", "HEAD"].includes(route.request().method()) ? route.continue() : route.abort());
  await context.addInitScript(isNative => {
    localStorage.setItem("somos-marketplace-preferences-v1", JSON.stringify({ city: "Todas", view: "home", cityConfirmed: true }));
    if (isNative) window.Capacitor = { isNativePlatform: () => true };
  }, native);
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:3107/marketplace");
  for (const query of ["sabore", "china", "strawberry", "kiki"]) {
    await page.locator('input[placeholder]').fill(query);
    await page.getByRole("button", { name: "Mapa", exact: true }).click();
    await page.locator('.market-map-marker').first().waitFor();
    const prefix = query === 'sabore' ? 'sabor' : query;
    const marker = page.locator('.market-map-marker:not(.market-map-cluster)').filter({ has: page.locator(`img[alt^="${prefix}" i]`) }).first();
    for (let zoom = 0; zoom < 8 && !(await marker.count()); zoom++) {
      const cluster = page.locator('.market-map-cluster').first();
      if (!(await cluster.count())) break;
      await cluster.click();
    }
    await marker.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.market-map-logo img')].every(img => img.complete && img.naturalWidth > 0));
    const logo = await marker.locator('img').evaluate(img => ({ name: img.alt, src: img.src, width: img.naturalWidth, height: img.naturalHeight, cssWidth: getComputedStyle(img).width, cssHeight: getComputedStyle(img).height, fit: getComputedStyle(img).objectFit, parent: img.parentElement.getBoundingClientRect().toJSON() }));
    logos.push(logo);
    assert.equal(logo.cssWidth, '40px', `${logo.name}: Leaflet must not override logo width`);
    assert.equal(logo.cssHeight, '40px');
    assert.equal(logo.fit, 'cover');
    await marker.screenshot({ path: `${output}/${query}-pin.png` });
    await page.screenshot({ path: `${output}/${query}-map.png` });
    await marker.click();
    await page.locator('.market-map-popup a').waitFor();
    assert.ok((await page.locator('.market-map-popup a').innerText()).includes(logo.name));
    assert.equal(await page.locator('.market-map-popup img').evaluate(img => getComputedStyle(img).objectFit), 'contain');
    await page.getByRole("button", { name: "Cerrar mapa", exact: true }).click();
    results.push({ query, name: logo.name, pass: true });
  }
  const gallery = await context.newPage();
  await gallery.setViewportSize({ width: 1000, height: 370 });
  await gallery.setContent('<html><body style="margin:0;background:#ddd;display:flex;font:16px Arial"></body></html>');
  await gallery.evaluate(items => {
    for (const item of items) {
      const box = document.createElement('div'); box.style.cssText = 'width:250px;padding:10px;box-sizing:border-box';
      const label = document.createElement('p'); label.textContent = item.name;
      const img = document.createElement('img'); img.src = item.src; img.style.cssText = 'width:230px;height:230px;object-fit:contain;background:white';
      box.append(label, img); document.body.append(box);
    }
  }, logos);
  await gallery.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
  await gallery.screenshot({ path: `${output}/original-logos.png` });
  assert.deepEqual(errors, []);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ results, errors, logos }, null, 2));
  console.log(JSON.stringify({ results, errors, logos }, null, 2));
  await browser.close();
}
