import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260910220000_opt_in_basic_inventory.sql",
  import.meta.url
);
const importMigrationUrl = new URL(
  "../supabase/migrations/20260910221000_inventory_stock_import_rpc.sql",
  import.meta.url
);
const importerUrl = new URL("./import-shibui-catalog.mjs", import.meta.url);

test("el inventario queda apagado por defecto y habilitado solo para SHIBUI", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /enabled boolean not null default false/);
  assert.match(sql, /where id = '126f8168-f1ca-4a08-8eaf-c3816b9d9195'::uuid\s+and slug = 'shibui'/);
  assert.doesNotMatch(sql, /update public\.stores\s+set/i);
});

test("el descuento valida comercio, producto, SKU y stock en una transaccion", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create or replace function public\.create_order_atomic/);
  assert.match(sql, /sku\.store_id = v_store_id/);
  assert.match(sql, /sku\.product_id = v_product_id/);
  assert.match(sql, /sku\.stock_on_hand >= v_inventory_quantity/);
  assert.match(sql, /stock_on_hand = sku\.stock_on_hand - v_inventory_quantity/);
  assert.match(sql, /'sale', -v_inventory_quantity/);
});

test("un reintento idempotente no descuenta inventario dos veces", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const replayPosition = sql.indexOf("'idempotent_replay', true");
  const decrementPosition = sql.indexOf("stock_on_hand = sku.stock_on_hand - v_inventory_quantity");
  assert.ok(replayPosition > 0);
  assert.ok(decrementPosition > replayPosition);
});

test("cancelar devuelve stock una sola vez y un pedido inventariado no se reabre", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /status = 'allocated'[\s\S]*for update/);
  assert.match(sql, /stock_on_hand = sku\.stock_on_hand \+ v_allocation\.quantity/);
  assert.match(sql, /set status = 'released', released_at = now\(\)/);
  assert.match(sql, /create trigger orders_inventory_reopen_guard/);
});

test("las tablas y funciones de inventario no son accesibles desde el navegador", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const table of [
    "store_inventory_settings",
    "product_inventory_skus",
    "order_item_inventory_allocations",
    "inventory_movements",
  ]) {
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
  }
  assert.match(sql, /grant execute on function public\.create_order_atomic\(jsonb, jsonb\) to service_role/);
  assert.match(sql, /grant execute on function public\.cancel_order_with_inventory\(uuid, uuid\) to service_role/);
});

test("las APIs solo pasan identificadores saneados al procedimiento atomico", async () => {
  const [publicRoute, panelRoute, atomicHelper, cancelHelper, catalog, productCard] = await Promise.all([
    readFile(new URL("../src/app/api/orders/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/panel/orders/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/server/create-order-atomic.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/server/cancel-order-with-inventory.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/supabase/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/ProductCard.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(publicRoute, /inventorySelections:[\s\S]*isUuid\(selection\.skuId\)/);
  assert.match(panelRoute, /inventorySelections:[\s\S]*isUuid\(selection\.skuId\)/);
  assert.match(atomicHelper, /inventory: Array/);
  assert.match(cancelHelper, /rpc\("cancel_order_with_inventory"/);
  assert.match(catalog, /settingsResult\.data\?\.enabled !== true/);
  assert.match(productCard, /requiredInventoryUnits/);
  assert.match(productCard, /Elige cada una/);
  assert.match(productCard, /1\. Elige el color/);
  assert.match(productCard, /2\. Elige la talla/);
  assert.match(productCard, /Primero selecciona un color/);
  assert.match(productCard, /Hasta \{maximumInventoryQuantity\} disponibles/);
  assert.match(productCard, /quantity: selectedQuantity \* purchaseQuantity/);
});

test("la importacion de stock exige SHIBUI habilitado, valida tenant y registra solo diferencias", async () => {
  const sql = await readFile(importMigrationUrl, "utf8");
  assert.match(sql, /select settings\.enabled[\s\S]*store_inventory_settings/);
  assert.match(sql, /product\.id = p_product_id[\s\S]*product\.store_id = p_store_id/);
  assert.match(sql, /for update/);
  assert.match(sql, /if v_delta <> 0 then/);
  assert.match(sql, /revoke all on function public\.import_inventory_stock[\s\S]*public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.import_inventory_stock[\s\S]*to service_role/);
});

test("el importador SHIBUI es dry-run por defecto y requiere confirmacion doble para escribir", async () => {
  const source = await readFile(importerUrl, "utf8");
  assert.match(source, /const apply = args\.has\(APPLY_FLAG\)/);
  assert.match(source, /apply && \(confirmedStore !== STORE_SLUG \|\| confirmedProject !== projectRef\)/);
  assert.match(source, /product\.precio_usd !== null[\s\S]*String\(product\.precio_usd\)\.trim\(\) !== ""/);
  assert.match(source, /La identidad del comercio no coincide con SHIBUI/);
  assert.match(source, /El stock por combinaciones no coincide/);
});
