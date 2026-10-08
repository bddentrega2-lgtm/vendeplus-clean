import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import {
  canAdvanceEntrega2OrderStatus,
  normalizeEntrega2OrderStatus,
  parseEntrega2QuoteCost,
  entrega2StatusLabels,
  mapEntrega2StatusToTransportStatus,
  getEntrega2DispatchBlockMessage,
  getEntrega2DisplayStatus,
  getEntrega2TerminalOrderStatus,
  isCurrentEntrega2Delivery,
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
  assert.equal(canAdvanceEntrega2OrderStatus("accepted", "picking_up"), true);
  assert.equal(canAdvanceEntrega2OrderStatus("picking_up", "accepted"), false);
  assert.equal(canAdvanceEntrega2OrderStatus("delivering", "picking_up"), false);
  assert.equal(canAdvanceEntrega2OrderStatus("delivering", "completed"), true);
});

test("webhook Entrega2 distingue todos los estados enviados por App", () => {
  const statuses = {
    pendiente: "sent", aceptado: "accepted", retirando: "picking_up",
    llevando: "delivering", entregado: "completed", cancelado: "cancelled",
    Con_novedad: "issue",
  };
  for (const [external, expected] of Object.entries(statuses)) {
    assert.equal(normalizeEntrega2OrderStatus(external), expected);
  }
  assert.equal(normalizeEntrega2OrderStatus("estado_desconocido"), null);
});

test("Entrega2 asigna al aceptar y distingue llegada al comercio", () => {
  assert.equal(mapEntrega2StatusToTransportStatus(normalizeEntrega2OrderStatus("aceptado")), "driver_assigned");
  assert.equal(mapEntrega2StatusToTransportStatus(normalizeEntrega2OrderStatus("retirando")), "pickup_pending");
  const labels = { pendiente: "Buscando repartidor", aceptado: "Repartidor asignado",
    retirando: "Retirando", llevando: "Llevando", entregado: "Entregado",
    Con_novedad: "Con novedad", cancelado: "Cancelado" };
  for (const [external, label] of Object.entries(labels)) {
    assert.equal(entrega2StatusLabels[normalizeEntrega2OrderStatus(external)], label);
  }
});

test("envios historicos sin seguimiento no simulan una busqueda activa", () => {
  const old = "2026-10-05T23:59:59Z";
  const current = "2026-10-06T00:00:00Z";
  assert.equal(getEntrega2DisplayStatus("sent", old, "received"), "Enviado a Entrega2 (sin seguimiento histórico)");
  assert.equal(getEntrega2DisplayStatus("sent", old, "completed"), "Pedido completado");
  assert.equal(getEntrega2DisplayStatus("sent", old, "cancelled"), "Pedido cancelado");
  assert.equal(getEntrega2DisplayStatus("sent", current, "received"), "Buscando repartidor");
  assert.equal(getEntrega2DisplayStatus("sent", current, "completed"), "Pedido completado");
  assert.equal(getEntrega2DisplayStatus("sent", null, "received"), "Buscando repartidor");
  assert.equal(getEntrega2DisplayStatus("accepted", old, "received"), "Repartidor asignado");
});

test("solo cancelacion y entrega de Entrega2 cierran el estado del pedido", () => {
  assert.equal(getEntrega2TerminalOrderStatus("cancelado"), "cancelled");
  assert.equal(getEntrega2TerminalOrderStatus("cancelled"), "cancelled");
  assert.equal(getEntrega2TerminalOrderStatus("entregado"), "completed");
  assert.equal(getEntrega2TerminalOrderStatus("completed"), "completed");
  for (const active of ["pendiente", "aceptado", "retirando", "llevando", "Con_novedad"]) {
    assert.equal(getEntrega2TerminalOrderStatus(active), null);
  }
});

test("Entrega2 solo gobierna el proveedor actualmente asignado", () => {
  const delivery = { delivery_type: "delivery" };
  assert.equal(isCurrentEntrega2Delivery({ ...delivery, delivery_provider: "entrega2" }), true);
  assert.equal(isCurrentEntrega2Delivery({ ...delivery, delivery_provider: "transport_agency", selected_transport_agency: { slug: "ENTREGA2" } }), true);
  assert.equal(isCurrentEntrega2Delivery({ ...delivery, delivery_provider: "transport_agency", selected_transport_agency: [{ slug: "entrega2" }] }), true);
  assert.equal(isCurrentEntrega2Delivery({ ...delivery, delivery_provider: "transport_agency", selected_transport_agency: { slug: "otra-empresa" } }), false);
  assert.equal(isCurrentEntrega2Delivery({ ...delivery, delivery_provider: "own_delivery" }), false);
  assert.equal(isCurrentEntrega2Delivery({ delivery_type: "pickup", delivery_provider: "entrega2" }), false);
});

test("delivery Entrega2 cancelado no reaparece como disponible para enviar", async () => {
  const source = await read("src/components/panel/orders/orders-manager-helpers.ts");
  const functions = source.slice(source.indexOf("export function getEntrega2Integration"), source.indexOf("export function isDeliveryAlreadyDelivered"));
  const compiled = ts.transpileModule(functions, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function("exports", "getEntrega2DispatchBlockMessage", "isCurrentEntrega2Delivery", compiled)(exports, getEntrega2DispatchBlockMessage, isCurrentEntrega2Delivery);
  const order = { status: "received", delivery_type: "delivery", delivery_provider: "transport_agency",
    selected_transport_agency: { slug: "entrega2" },
    transport_agency_id: "agency", transport_orders: [{ agency_id: "agency", status: "cancelled" }],
    order_integrations: [{ provider: "entrega2", status: "cancelled" }] };
  assert.equal(exports.canSendToTransportAgency(order), false);
  assert.equal(exports.hasActiveTransportAgencyHandoff(order), false);
  assert.match(getEntrega2DispatchBlockMessage("cancelled"), /cancelado/);
  assert.equal(getEntrega2DispatchBlockMessage("failed"), null);
  assert.equal(exports.canSendToTransportAgency({ ...order, order_integrations: [] }), true);
  assert.equal(exports.canSendToTransportAgency({ ...order, selected_transport_agency: { slug: "otra-empresa" } }), true);
  const route = await read("src/app/api/panel/orders/[orderId]/send-delivery/route.ts");
  const guard = route.indexOf("const blockMessage = getEntrega2DispatchBlockMessage(sentIntegration?.status)");
  const mutation = route.indexOf("const transportOrder = await upsertTransportOrderFromOrder");
  assert.ok(guard > 0 && mutation > guard, "Block repeated Entrega2 sends before transport mutation");
});

test("Pedidos muestra el avance de Entrega2 en el unico espacio de estado", async () => {
  const source = await read("src/components/panel/orders/orders-manager-helpers.ts");
  const functions = source.slice(source.indexOf("export function getEntrega2Integration"), source.indexOf("export function isDeliveryAlreadyDelivered"));
  const compiled = ts.transpileModule(functions, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const labels = { accepted: "Repartidor asignado", picking_up: "Retirando", delivering: "Llevando" };
  new Function("exports", "getEntrega2DispatchBlockMessage", "getEntrega2TerminalOrderStatus", "isCurrentEntrega2Delivery", "getEntrega2DisplayStatus", "transportStatusLabels", compiled)(
    exports, getEntrega2DispatchBlockMessage, getEntrega2TerminalOrderStatus,
    isCurrentEntrega2Delivery,
    getEntrega2DisplayStatus, { on_the_way: "En camino" }
  );
  for (const [status, expected] of Object.entries(labels)) {
    const order = { status: "received", delivery_type: "delivery", delivery_provider: "transport_agency",
      selected_transport_agency: { slug: "entrega2" },
      transport_orders: [{ status: status === "delivering" ? "on_the_way" : "driver_assigned" }],
      order_integrations: [{ provider: "entrega2", status }] };
    assert.equal(exports.getActiveDeliveryStatusLabel(order), expected);
    assert.equal(exports.getActiveDeliveryStatusLabel({ ...order, delivery_provider: "entrega2", transport_orders: [] }), expected);
  }
  assert.equal(exports.getActiveDeliveryStatusLabel({ status: "received", delivery_type: "delivery", delivery_provider: "transport_agency",
    selected_transport_agency: { slug: "entrega2" },
    transport_orders: [{ status: "cancelled" }], order_integrations: [{ provider: "entrega2", status: "cancelled" }] }), "Cancelado");
  assert.equal(exports.getActiveDeliveryStatusLabel({ status: "received", delivery_type: "delivery", delivery_provider: "transport_agency",
    selected_transport_agency: { slug: "entrega2" },
    transport_orders: [{ status: "delivered" }], order_integrations: [{ provider: "entrega2", status: "completed" }] }), "Entregado");
  const oldSent = { status: "received", delivery_type: "delivery", delivery_provider: "transport_agency",
    selected_transport_agency: { slug: "entrega2" },
    order_integrations: [{ provider: "entrega2", status: "sent", created_at: "2026-10-05T12:00:00Z" }] };
  assert.equal(exports.getActiveDeliveryStatusLabel(oldSent), "Enviado a Entrega2 (sin seguimiento histórico)");
  assert.equal(exports.getActiveDeliveryStatusLabel({ ...oldSent, status: "completed" }), "Pedido completado");
  assert.equal(exports.getActiveDeliveryStatusLabel({ ...oldSent, status: "cancelled" }), "Pedido cancelado");
  assert.equal(exports.getActiveDeliveryStatusLabel({ ...oldSent, order_integrations: [{ provider: "entrega2", status: "sent", created_at: "2026-10-08T12:00:00Z" }] }), "Buscando repartidor");
  const switched = { status: "received", delivery_type: "delivery", delivery_provider: "transport_agency",
    selected_transport_agency: { slug: "otra-empresa" }, transport_agency_id: "other-agency",
    transport_orders: [{ agency_id: "old-entrega2", status: "cancelled" }, { agency_id: "other-agency", status: "on_the_way" }],
    order_integrations: [{ provider: "entrega2", status: "cancelled" }] };
  assert.equal(exports.getActiveDeliveryStatusLabel(switched), "En camino");
  assert.equal(exports.getEntrega2Integration(switched), undefined);
  assert.equal(exports.getCurrentTransportOrder(switched).agency_id, "other-agency");
  const panel = await read("src/components/panel/OrdersManager.tsx");
  assert.match(panel, /const activeDeliveryStatusLabel = getActiveDeliveryStatusLabel\(order\)/);
  assert.match(panel, /\{activeDeliveryStatusLabel \? \(/);
  assert.match(panel, /terminalEntrega2Status \? \(/);
  assert.doesNotMatch(panel, /showDeliverySent/);
  const route = await read("src/app/api/panel/orders/route.ts");
  assert.match(route, /terminalEntrega2Status && status !== terminalEntrega2Status/);
  assert.match(route, /order_id, provider, external_id, status, last_error, created_at, updated_at/);
});

test("seguimiento y panel de transporte reciben la fecha original del envio", async () => {
  const tracking = await read("src/app/api/orders/delivery-status/route.ts");
  const customer = await read("src/components/public/ConfirmationClient.tsx");
  const transport = await read("src/components/transport/TransportOrdersTab.tsx");
  const summary = await read("src/app/api/transport/panel/orders/route.ts");
  assert.match(tracking, /entrega2CreatedAt: integration\?\.created_at/);
  assert.match(customer, /sentDeliveryLabel && sentDeliveryLabel !== entrega2StatusLabels\.sent/);
  assert.match(transport, /getEntrega2DisplayStatus\(String\(status \|\| ""\), createdAt, orderStatus\)/);
  assert.match(summary, /order_integrations \([\s\S]*?created_at/);
});

test("id_externo permanece estable y el webhook exige autenticacion", async () => {
  const commerceSend = await read("src/app/api/panel/orders/[orderId]/send-delivery/route.ts");
  const agencySend = await read("src/app/api/transport/panel/orders/[transportOrderId]/send-entrega2/route.ts");
  const webhook = await read("src/app/api/integrations/entrega2/order-status/route.ts");
  const integration = await read("src/lib/integrations/entrega2.ts");
  const dispatch = await read("src/lib/server/entrega2-dispatch.ts");
  assert.match(commerceSend, /external_id: externalOrderId/);
  assert.match(agencySend, /external_id: externalOrderId/);
  assert.match(webhook, /isValidEntrega2Webhook\(request\.headers\)/);
  assert.match(webhook, /cleanText\(payload\.estado\)/);
  assert.match(webhook, /vendeplus_particular_/);
  assert.match(webhook, /advanceEntrega2OrderDeliveryStatus/);
  assert.match(webhook, /isCurrentEntrega2Delivery\(assignedOrder\)/);
  assert.match(integration, /x-vendeplus-webhook-secret/);
  assert.match(integration, /authorization/);
  assert.match(dispatch, /normalizeEntrega2OrderStatus\(current\.status\)/);
});

test("webhook terminal solo cierra el pedido si Entrega2 sigue asignado", async () => {
  const source = await read("src/app/api/integrations/entrega2/order-status/route.ts");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [deliveryProvider, agencySlug, shouldClose] of [
    ["entrega2", null, true],
    ["transport_agency", "entrega2", true],
    ["transport_agency", "otra-empresa", false],
    ["own_delivery", null, false],
  ]) {
    let advanced = 0;
    let cancelled = 0;
    let integrationUpdated = false;
    const db = { from(table) {
      const query = {
        select() { return query; }, eq() { return query; }, update() { integrationUpdated = true; return query; },
        maybeSingle: async () => {
          if (table === "order_integrations") return { data: integrationUpdated
            ? { id: "integration" }
            : { id: "integration", order_id: "order", transport_order_id: null, status: "accepted" }, error: null };
          if (table === "orders") return { data: integrationUpdated && !query.readForSync
            ? { delivery_type: "delivery", delivery_provider: deliveryProvider,
                selected_transport_agency: agencySlug ? { slug: agencySlug } : null }
            : { id: "order", store_id: "store", status: "received", customer_id: null }, error: null };
          throw Error(`Unexpected table: ${table}`);
        },
        readForSync: false,
      };
      if (table === "orders") {
        query.select = columns => { query.readForSync = columns.includes("customer_id"); return query; };
      }
      return query;
    } };
    const mocks = {
      "next/server": { NextResponse: { json: Response.json } },
      "@/lib/entrega2-contract": { isCurrentEntrega2Delivery, mapEntrega2StatusToTransportStatus },
      "@/lib/integrations/entrega2": {
        canAdvanceEntrega2OrderStatus, getEntrega2Provider: () => "entrega2",
        isValidEntrega2Webhook: () => true, normalizeEntrega2OrderStatus,
      },
      "@/lib/server/entrega2-dispatch": { advanceEntrega2OrderDeliveryStatus: async () => { advanced++; } },
      "@/lib/supabase/admin": { createSupabaseAdminClient: () => db },
      "@/lib/transport/orders": { getTransportOrderTimestampField: () => null },
      "@/lib/server/cancel-order-with-inventory": { cancelOrderWithInventory: async () => { cancelled++; return { id: "order" }; } },
      "@/lib/customers/upsert-customer-from-order": { recalculateCustomerFromOrder: async () => {} },
    };
    const loaded = { exports: {} };
    new Function("require", "module", "exports", "Buffer", compiled)(
      name => { if (!(name in mocks)) throw Error(`Unexpected dependency: ${name}`); return mocks[name]; },
      loaded, loaded.exports, Buffer
    );
    const response = await loaded.exports.POST(new Request("http://localhost/api/integrations/entrega2/order-status", {
      method: "POST", body: JSON.stringify({ status: "cancelado", orderId: "vendeplus_00000000-0000-4000-8000-000000000001" }),
    }));
    assert.equal(response.status, 200, `${deliveryProvider}/${agencySlug}`);
    assert.equal((await response.json()).orderStatusIgnored, !shouldClose);
    assert.equal(advanced, Number(shouldClose));
    assert.equal(cancelled, Number(shouldClose));
  }
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
