import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeFrequentLocation } from "../src/lib/mobile/frequent-location.ts";
import { loadOrderNoticeReadIds, newOrdersSince, orderNoticeReadKey, readOrderNoticeIds, rememberReadOrderNotices } from "../src/lib/mobile/order-alerts.ts";
import { getCustomerBrowserProfile, getCustomerIdParts, saveCustomerBrowserProfile, clearCustomerBrowserProfile } from "../src/lib/customer-browser-profile.ts";

test("campana consulta el estado real de pedidos nuevos, no el estado de pago", () => {
  const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
  const notifications = read("../src/components/panel/PanelNotifications.tsx");
  const creation = read("../src/app/api/orders/route.ts");
  const listing = read("../src/app/api/panel/orders/route.ts");
  assert.match(creation, /\bstatus: "received"/);
  assert.match(listing, /query\.eq\("status", status\)/);
  assert.match(notifications, /new URLSearchParams\(\{ storeId: selectedStoreId, status: "received", compact: "true", limit: "10" \}\)/);
});

test("ubicacion frecuente guarda solo direccion y coordenadas validas", () => {
  const value = normalizeFrequentLocation({ name: " Casa ", reference: " Porton blanco ", location: { latitude: 10.5, longitude: -66.9 }, quoteToken: "private", feeUsd: 2 });
  assert.deepEqual(value, { name: "Casa", reference: "Porton blanco", location: { latitude: 10.5, longitude: -66.9, label: "Porton blanco", source: "map" } });
});

test("ubicacion frecuente permite una referencia vacia", () => {
  assert.deepEqual(normalizeFrequentLocation({ name: "Casa", reference: "", location: { latitude: 10.5, longitude: -66.9 } }), {
    name: "Casa", reference: "", location: { latitude: 10.5, longitude: -66.9, label: "Casa", source: "map" },
  });
});

test("ubicacion frecuente rechaza datos incompletos o manipulados", () => {
  for (const point of [null, { latitude: 0, longitude: 0 }, { latitude: 91, longitude: 2 }, { latitude: NaN, longitude: 2 }, { latitude: "10", longitude: -66 }]) {
    assert.equal(normalizeFrequentLocation({ name: "Casa", reference: "Referencia", location: point }), null);
  }
  assert.equal(normalizeFrequentLocation({ name: "", reference: "Referencia", location: { latitude: 10, longitude: -66 } }), null);
});

test("avisos: no repetir conocidos, historicos, fechas invalidas u otra sede", () => {
  const now = Date.now();
  const fresh = { id: "new", store_id: "A", created_at: new Date(now + 10).toISOString() };
  const orders = [fresh, { ...fresh, id: "known" }, { ...fresh, id: "other", store_id: "B" }, { ...fresh, id: "old", created_at: new Date(now - 60000).toISOString() }, { ...fresh, id: "invalid", created_at: "invalid" }];
  assert.deepEqual(newOrdersSince(orders, new Set(["known"]), "A", now), [fresh]);
});

test("perfil conserva cedula en comercios que no la piden y permite borrarla explicitamente", t => {
  const values = new Map();
  const oldWindow = globalThis.window;
  globalThis.window = { localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }, dispatchEvent: () => {} };
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; });
  assert.equal(saveCustomerBrowserProfile("QA", "04120000000", "E-12345678"), true);
  assert.equal(saveCustomerBrowserProfile("QA editado", "04120000001"), true);
  assert.equal(getCustomerBrowserProfile().idNumber, "E-12345678");
  assert.deepEqual(getCustomerIdParts("e 12345678"), { type: "E", number: "12345678" });
  saveCustomerBrowserProfile("QA", "04120000000", "");
  assert.equal(getCustomerBrowserProfile().idNumber, "");
  clearCustomerBrowserProfile();
  assert.equal(getCustomerBrowserProfile(), null);
});

test("campana recuerda solo IDs leidos por cuenta/sede incluso despues de cerrar sesion", t => {
  const values = new Map();
  const oldStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  t.after(() => { if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; });
  const key = orderNoticeReadKey("A", "store1");
  assert.equal(key.startsWith("somos_mobile_v1_private_"), false, "logout must not erase the read marker");
  rememberReadOrderNotices(key, ["one"], new Set());
  assert.deepEqual([...readOrderNoticeIds(key)], ["one"]);
  for (const storedKey of [...values.keys()]) if (storedKey.startsWith("somos_mobile_v1_private_")) values.delete(storedKey);
  assert.deepEqual([...readOrderNoticeIds(key)], ["one"]);
  assert.equal(readOrderNoticeIds(orderNoticeReadKey("A", "store2")).size, 0);
  assert.equal(readOrderNoticeIds(orderNoticeReadKey("B", "store1")).size, 0);
  const bounded = rememberReadOrderNotices(key, Array.from({ length: 600 }, (_, n) => String(n)), new Set());
  assert.equal(bounded.size, 500);
  values.set(key, '{bad');
  assert.equal(readOrderNoticeIds(key).size, 0);
  globalThis.localStorage.setItem = () => { throw new Error("blocked"); };
  assert.deepEqual([...rememberReadOrderNotices(key, ["two"], new Set(["one"]))], ["one", "two"]);
});

test("campana migra una sola vez los pedidos leidos del almacenamiento anterior", t => {
  const values = new Map([["somos_mobile_v1_private_order_read_A:store1", JSON.stringify(["old-order"])]]);
  const oldStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  t.after(() => { if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; });
  const result = loadOrderNoticeReadIds("A", "store1");
  assert.deepEqual([...result.ids], ["old-order"]);
  assert.deepEqual([...readOrderNoticeIds(orderNoticeReadKey("A", "store1"))], ["old-order"]);
  assert.equal(values.has("somos_mobile_v1_private_order_read_A:store1"), false);
});
