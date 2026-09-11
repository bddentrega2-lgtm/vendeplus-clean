import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = JSON.parse(
  await readFile(new URL("../src/data/shibui-catalog.preview.json", import.meta.url), "utf8"),
);
const component = await readFile(
  new URL("../src/components/prototypes/ShibuiInventoryPrototype.tsx", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../src/app/prototipos/shibui-inventario/page.tsx", import.meta.url),
  "utf8",
);
const premiumPanel = await readFile(
  new URL("../src/components/panel/PremiumInventoryPreview.tsx", import.meta.url),
  "utf8",
);
const productManager = await readFile(
  new URL("../src/components/panel/ProductManager.tsx", import.meta.url),
  "utf8",
);
const inventoryApi = await readFile(
  new URL("../src/app/api/panel/inventory/route.ts", import.meta.url),
  "utf8",
);
const catalogClient = await readFile(
  new URL("../src/components/public/CatalogClient.tsx", import.meta.url),
  "utf8",
);
const inventoryRelease = await readFile(
  new URL("../supabase/migrations/20260910232000_premium_inventory_and_catalog_layout.sql", import.meta.url),
  "utf8",
);

test("el catalogo fuente conserva productos, combinaciones y stock", () => {
  assert.equal(catalog.products.length, 27);
  assert.equal(catalog.variants.length, 333);
  assert.equal(catalog.variants.reduce((sum, variant) => sum + variant.cantidad, 0), 459);
  assert.equal(new Set(catalog.variants.map((variant) => [variant.product_id, variant.color, variant.talla, variant.detalle].join("::"))).size, 333);
});

test("el prototipo es local y no escribe en servicios reales", () => {
  assert.doesNotMatch(component, /fetch\s*\(/);
  assert.doesNotMatch(component, /supabase/i);
  assert.doesNotMatch(component, /\/api\//);
  assert.match(component, /no guarda pedidos ni modifica inventario real/);
  assert.match(component, /setStock\(\(current\)/);
});

test("el cliente elige color antes de talla y puede simular agotados", () => {
  assert.match(component, />Color /);
  assert.match(component, />Talla /);
  assert.match(component, /Primero selecciona un color/);
  assert.match(component, /Combinación agotada/);
  assert.match(component, /Reiniciar/);
});

test("el comercio gestiona stock desde cada producto sin tocar datos reales", () => {
  assert.match(component, /Vista del cliente/);
  assert.match(component, /Gestionar stock/);
  assert.match(component, /Stock total:/);
  assert.match(component, /adjustCombination/);
  assert.match(component, /Agregar combinación/);
  assert.match(component, /Los cambios son solo para probar la experiencia; no se guardan/);
});

test("la demostracion reutiliza la estructura visual del catalogo Somos", () => {
  assert.match(component, /vp-public-store vp-container/);
  assert.match(component, /somos-logo-preview\.png/);
  assert.match(component, /bg-\[#FFF8F0\]/);
  assert.match(component, /Añadir al carrito \(simulado\)/);
});

test("los casos dudosos quedan visibles sin inventar datos", () => {
  assert.match(component, /Somos está a \$16 y el archivo indica \$18/);
  assert.match(component, /Precio pendiente/);
  assert.match(component, /Imagen pendiente/);
  assert.match(component, /se fusionaría sin duplicarlo/);
});

test("la ruta desaparece en produccion y no puede indexarse", () => {
  assert.match(page, /process\.env\.VERCEL_ENV === "production"/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /index: false, follow: false/);
});

test("el inventario Premium aparece exclusivamente en el panel habilitado", () => {
  assert.match(productManager, /126f8168-f1ca-4a08-8eaf-c3816b9d9195/);
  assert.match(productManager, /store\.slug === "shibui"/);
  assert.doesNotMatch(productManager, /Piloto exclusivo SHIBUI/);
  assert.match(productManager, /Controla las existencias por color, talla u otras combinaciones/);
});

test("el administrador Premium guarda mediante una API autenticada y aislada", () => {
  assert.match(premiumPanel, /fetchPanelJson\("\/api\/panel\/catalogo"/);
  assert.match(premiumPanel, /fetchPanelJson\("\/api\/panel\/inventory"/);
  assert.match(premiumPanel, /method:\s*"PATCH"/);
  assert.match(inventoryApi, /assertStoreManager/);
  assert.match(inventoryApi, /SHIBUI_STORE_ID/);
  assert.match(inventoryApi, /manage_inventory_product/);
  assert.match(premiumPanel, /setStock\(\(current\)/);
});

test("el administrador separa stock, combinaciones y presentaciones", () => {
  assert.match(premiumPanel, /Control por combinaciones/);
  assert.match(premiumPanel, /Configurar combinaciones/);
  assert.match(premiumPanel, /Stock total: \{combinationStockTotal\}/);
  assert.doesNotMatch(premiumPanel, /cambio\(s\) pendiente/);
  assert.doesNotMatch(premiumPanel, /simulación hasta completar/);
  assert.doesNotMatch(premiumPanel, /Piloto SHIBUI|Preview · piloto|Inventario Premium · prueba/);
  assert.match(premiumPanel, /Otra característica \(opcional\)/);
  assert.match(premiumPanel, /Presentaciones de venta/);
  assert.match(premiumPanel, /Descuenta/);
});

test("los ajustes de inventario son atomicos y dejan historial", () => {
  assert.match(inventoryRelease, /create or replace function public\.manage_inventory_product/);
  assert.match(inventoryRelease, /create or replace function public\.manage_inventory_sku/);
  assert.match(inventoryRelease, /for update/);
  assert.match(inventoryRelease, /inventory_movements/);
  assert.match(inventoryRelease, /created_by/);
  assert.match(inventoryRelease, /to service_role/);
});

test("el catalogo permite vista clasica o visual sin cambiar sus funciones", () => {
  assert.match(catalogClient, /store\.catalogLayout/);
  assert.match(catalogClient, /vista/);
  assert.match(catalogClient, /grid-cols-2/);
  assert.match(inventoryRelease, /default 'classic'/);
  assert.match(inventoryRelease, /catalog_layout in \('classic', 'visual'\)/);
});
