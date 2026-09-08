import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canAdvanceEntrega2OrderStatus,
  parseEntrega2QuoteCost,
} from "../src/lib/entrega2-contract.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Entrega2 solo acepta costos numericos explicitos", () => {
  for (const invalid of [null, undefined, "", "  ", false, true, [], {}, "abc", -1]) {
    assert.equal(parseEntrega2QuoteCost(invalid), null);
  }
  assert.equal(parseEntrega2QuoteCost(0), 0);
  assert.equal(parseEntrega2QuoteCost("0"), 0);
  assert.equal(parseEntrega2QuoteCost("4.75"), 4.75);
});

test("un webhook atrasado no revierte estados avanzados o terminales", () => {
  assert.equal(canAdvanceEntrega2OrderStatus("completed", "accepted"), false);
  assert.equal(canAdvanceEntrega2OrderStatus("delivering", "sent"), false);
  assert.equal(canAdvanceEntrega2OrderStatus("cancelled", "delivering"), false);
  assert.equal(canAdvanceEntrega2OrderStatus("accepted", "delivering"), true);
  assert.equal(canAdvanceEntrega2OrderStatus("delivering", "completed"), true);
});

test("cotizacion Entrega2 inicia la ruta antes de esperar App y no suma timeouts", async () => {
  const bridge = await read("src/lib/server/entrega2-bridge.ts");
  const routeStart = bridge.indexOf("const routeDistancePromise = calculateRouteDistanceKm");
  const appWait = bridge.indexOf("const response = await quoteEntrega2Delivery");
  const routeWait = bridge.indexOf("const routeDistance = await routeDistancePromise");
  assert.ok(routeStart >= 0 && appWait > routeStart && routeWait > appWait);

  const commerce = await read("src/app/api/delivery/quote/route.ts");
  const localOnlyBranch = commerce.indexOf(
    "if (!isLegacyEntrega2 && !isEntrega2SomosConnection)"
  );
  const bridgeCall = commerce.indexOf("const bridgeResult = await quoteEntrega2ThroughSomos");
  const localDistance = commerce.indexOf("const routeDistance = await calculateRouteDistanceKm");
  assert.ok(
    localOnlyBranch >= 0 &&
      localDistance > localOnlyBranch &&
      localDistance < bridgeCall
  );
});

test("los envios finalizan por id reservado y nunca dependen de upsert parcial", async () => {
  const agencySend = await read("src/app/api/transport/panel/orders/[transportOrderId]/send-entrega2/route.ts");
  const commerceSend = await read("src/app/api/panel/orders/[orderId]/send-delivery/route.ts");
  const dispatch = await read("src/lib/server/entrega2-dispatch.ts");
  const commerceDirectSend = commerceSend.slice(
    commerceSend.indexOf("async function sendCommerceOrderToEntrega2App"),
    commerceSend.indexOf("function buildTransportAgencyMessage")
  );

  assert.doesNotMatch(agencySend, /onConflict: "transport_order_id,provider"/);
  assert.doesNotMatch(commerceDirectSend, /onConflict: "order_id,provider"/);
  assert.match(dispatch, /\.eq\("id", integrationId\)/);
  assert.match(dispatch, /status: "reconcile_required"/);
});

test("la arquitectura conserva credito directo, contado manual, particulares y otras agencias", async () => {
  const commerceSend = await read("src/app/api/panel/orders/[orderId]/send-delivery/route.ts");
  const agencySend = await read("src/app/api/transport/panel/orders/[transportOrderId]/send-entrega2/route.ts");
  const particular = await read("src/app/api/transport/particulares/[agencySlug]/route.ts");

  assert.match(commerceSend, /delivery_billing_mode === "credit"/);
  assert.match(commerceSend, /cash_validation_required/);
  assert.match(agencySend, /entrega2_app_released/);
  assert.match(agencySend, /buildEntrega2ParticularPayload/);
  assert.match(particular, /isEntrega2AgencySlug/);
  assert.match(particular, /calculateDeliveryQuoteFromSettings/);
});
