import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateDeliveryQuoteFromSettings,
  calculateEntrega2FallbackQuote,
  createDefaultDeliverySettings,
} from "../src/lib/delivery.ts";
import {
  canAccessStore,
  getStoreRole,
} from "../src/lib/panel/store-access.ts";
import {
  signDeliveryQuote,
  verifyDeliveryQuote,
} from "../src/lib/server/signed-delivery-quote.ts";

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

test("cotizacion firmada conserva tarifa y bloquea manipulaciones", () => {
  process.env.DELIVERY_QUOTE_SIGNING_SECRET = "contrato-local-cotizacion-delivery";
  const params = {
    storeId: "store-a",
    latitude: 10.1582076,
    longitude: -67.5541275,
    subtotalUsd: 20.5,
    zoneId: null,
    quote: {
      distanceKm: 10.8,
      feeUsd: 5,
      label: "10.80 km",
      source: "route",
      available: true,
      provider: "transport_agency",
      pricingType: "distance_ranges",
    },
  };
  const token = signDeliveryQuote(params);
  const verified = verifyDeliveryQuote({ ...params, token });

  assert.equal(verified?.distanceKm, 10.8);
  assert.equal(verified?.feeUsd, 5);
  assert.equal(verifyDeliveryQuote({ ...params, token, subtotalUsd: 20.51 }), null);
  assert.equal(verifyDeliveryQuote({ ...params, token, latitude: 10.1583 }), null);
  assert.equal(verifyDeliveryQuote({ ...params, token: `${token}x` }), null);
});

test("respaldo Entrega2 usa los rangos cargados de la empresa", () => {
  const settings = deliverySettings({
    deliveryProvider: "transport_agency",
    pricingType: "distance_ranges",
    distanceRates: [
      { id: "e2-1", minKm: 0, maxKm: 1.5, feeUsd: 1, isActive: true, sortOrder: 1 },
      { id: "e2-2", minKm: 1.51, maxKm: 3, feeUsd: 1.5, isActive: true, sortOrder: 2 },
      { id: "e2-3", minKm: 3.01, maxKm: 4, feeUsd: 2.5, isActive: true, sortOrder: 3 },
      { id: "e2-4", minKm: 4.01, maxKm: 6, feeUsd: 3, isActive: true, sortOrder: 4 },
    ],
  });
  const quote = calculateEntrega2FallbackQuote({
    settings,
    subtotalUsd: 10,
    distanceKm: 4.78,
    source: "route",
  });

  assert.equal(quote.available, true);
  assert.equal(quote.feeUsd, 3);
  assert.equal(quote.provider, "entrega2");
  assert.equal(quote.source, "fallback");
  assert.match(quote.label, /respaldo/i);
});

test("cotizacion de delivery limita abuso por IP y comercio", () => {
  const route = readFileSync(
    new URL("../src/app/api/delivery/quote/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /key:\s*`delivery-quote:ip:\$\{clientIp\}`/);
  assert.match(route, /key:\s*`delivery-quote:store:\$\{storeId\}:ip:\$\{clientIp\}`/);
  assert.match(route, /status:\s*429/);
  assert.match(route, /rateLimitHeaders\(globalLimit, DELIVERY_QUOTE_IP_LIMIT\)/);
  assert.match(route, /rateLimitHeaders\(storeLimit, DELIVERY_QUOTE_STORE_IP_LIMIT\)/);
  assert.match(route, /loadTransportAgencyDeliverySettingsBySlug/);
  assert.match(route, /rateSource:\s*entrega2FallbackSettings \? "entrega2_agency" : "store"/);
});

test("cotizacion rechaza coordenadas ausentes o fuera de rango", () => {
  const route = readFileSync(
    new URL("../src/app/api/delivery/quote/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /value === null/);
  assert.match(route, /value === undefined/);
  assert.match(route, /latitude >= -90/);
  assert.match(route, /latitude <= 90/);
  assert.match(route, /longitude >= -180/);
  assert.match(route, /longitude <= 180/);
  assert.match(route, /hasValidCoordinates\(storeLat, storeLng\)/);
});

test("mapa permite mosaicos seguros y seleccion directa sin boton confuso", () => {
  const nextConfig = readFileSync(
    new URL("../next.config.ts", import.meta.url),
    "utf8",
  );
  const locationPicker = readFileSync(
    new URL("../src/components/public/LocationPicker.tsx", import.meta.url),
    "utf8",
  );

  assert.match(nextConfig, /https:\/\/\*\.tile\.openstreetmap\.org/);
  assert.match(locationPicker, /void loadLeaflet\(\)/);
  assert.match(locationPicker, /Toca el mapa para elegir el punto/);
  assert.doesNotMatch(locationPicker, /Marcar centro del mapa/);
  assert.doesNotMatch(locationPicker, /selectMapCenter/);
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
