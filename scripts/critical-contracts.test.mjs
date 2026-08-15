import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateDeliveryQuoteFromSettings,
  createDefaultDeliverySettings,
} from "../src/lib/delivery.ts";
import {
  canAccessStore,
  getStoreRole,
} from "../src/lib/panel/store-access.ts";

function deliverySettings(overrides = {}) {
  return {
    ...createDefaultDeliverySettings(),
    deliveryEnabled: true,
    deliveryProvider: "own_delivery",
    ...overrides,
  };
}

test("delivery por zona exige una zona activa y usa su tarifa", () => {
  const settings = deliverySettings({
    pricingType: "zones",
    zones: [{ id: "norte", name: "Norte", feeUsd: 2.5, isActive: true, sortOrder: 0 }],
  });
  const pending = calculateDeliveryQuoteFromSettings({ settings, deliveryType: "delivery", subtotalUsd: 10 });
  const selected = calculateDeliveryQuoteFromSettings({ settings, deliveryType: "delivery", subtotalUsd: 10, zoneId: "norte" });

  assert.equal(pending.source, "pending");
  assert.equal(selected.available, true);
  assert.equal(selected.feeUsd, 2.5);
  assert.equal(selected.zoneId, "norte");
});

test("delivery fijo respeta el radio maximo", () => {
  const settings = deliverySettings({ pricingType: "fixed_distance", fixedFeeUsd: 3, maxDistanceKm: 5 });
  const inside = calculateDeliveryQuoteFromSettings({ settings, deliveryType: "delivery", subtotalUsd: 10, distanceKm: 4.9 });
  const outside = calculateDeliveryQuoteFromSettings({ settings, deliveryType: "delivery", subtotalUsd: 10, distanceKm: 5.1 });

  assert.equal(inside.feeUsd, 3);
  assert.equal(inside.available, true);
  assert.equal(outside.available, false);
  assert.equal(outside.feeUsd, 0);
});

test("retiro nunca cobra delivery", () => {
  const quote = calculateDeliveryQuoteFromSettings({
    settings: deliverySettings({ pickupEnabled: true, pricingType: "fixed_distance", fixedFeeUsd: 8 }),
    deliveryType: "pickup",
    subtotalUsd: 20,
  });
  assert.equal(quote.available, true);
  assert.equal(quote.feeUsd, 0);
});

test("cotizacion manual no inventa tarifa", () => {
  const quote = calculateDeliveryQuoteFromSettings({
    settings: deliverySettings({ deliveryProvider: "manual_quote", pricingType: "manual" }),
    deliveryType: "delivery",
    subtotalUsd: 20,
  });
  assert.equal(quote.available, true);
  assert.equal(quote.feeUsd, 0);
  assert.equal(quote.source, "manual");
});

test("delivery desactivado falla cerrado", () => {
  const quote = calculateDeliveryQuoteFromSettings({
    settings: deliverySettings({ deliveryEnabled: false, deliveryProvider: "disabled" }),
    deliveryType: "delivery",
    subtotalUsd: 20,
  });
  assert.equal(quote.available, false);
  assert.equal(quote.feeUsd, 0);
});

test("fundador solo accede al comercio seleccionado", () => {
  const founder = { isAuthorized: true, mode: "user", method: "auth", isFounderMode: true, storeIds: ["store-a"], role: "owner" };
  assert.equal(canAccessStore(founder, "store-a"), true);
  assert.equal(canAccessStore(founder, "store-b"), false);
  assert.equal(getStoreRole(founder, "store-a"), "owner");
  assert.equal(getStoreRole(founder, "store-b"), null);
});

test("fundador sin seleccion y comercio normal fallan fuera de su tenant", () => {
  const founderWithoutSelection = { isAuthorized: true, mode: "user", method: "auth", isFounderMode: true, storeIds: [], role: "owner" };
  const merchant = { isAuthorized: true, mode: "user", method: "auth", isFounderMode: false, storeIds: ["store-a"], storeRoles: { "store-a": "admin" }, role: "admin" };

  assert.equal(canAccessStore(founderWithoutSelection, "store-a"), false);
  assert.equal(canAccessStore(merchant, "store-a"), true);
  assert.equal(canAccessStore(merchant, "store-b"), false);
});

test("Entrega2 recibe cliente en contacto y comercio en telefono_comercio", () => {
  const route = readFileSync(
    new URL("../src/app/api/panel/orders/[orderId]/send-delivery/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /telefono_contacto:\s*normalizeInternationalPhone\(order\.customer_phone\)/);
  assert.match(route, /telefono_comercio:\s*normalizeInternationalPhone\(order\.stores\?\.whatsapp\)/);
});
