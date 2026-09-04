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

test("home presenta mesa y barra en un banner despues de delivery sin alterar el contenido base", () => {
  const home = readFileSync(
    new URL("../src/components/public/HomeClient.tsx", import.meta.url),
    "utf8",
  );

  assert.match(home, /Nueva modalidad/);
  assert.match(home, /Pedidos en mesa o barra/);
  assert.match(home, /Pedido con QR/);
  assert.match(home, /Menos filas/);
  assert.match(home, /Estado visible/);
  assert.doesNotMatch(home, /seguimiento (?:del pedido )?en tiempo real/i);
  assert.ok(home.indexOf("Para empresas delivery") < home.indexOf("Nueva modalidad"));
  assert.match(home, /Vende mejor desde tu catálogo digital/);
  assert.match(home, /Creado para operaciones locales reales/);
  assert.match(home, /Otras apps/);
  assert.match(home, /Pagos directos a tu cuenta/);
});

test("panel de comercios usa logo Somos y la paleta nueva queda como default", () => {
  const panelShell = readFileSync(
    new URL("../src/components/panel/PanelShell.tsx", import.meta.url),
    "utf8",
  );
  const signupRoute = readFileSync(
    new URL("../src/app/api/signup/route.ts", import.meta.url),
    "utf8",
  );
  const settingsRoute = readFileSync(
    new URL("../src/app/api/panel/settings/route.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL("../supabase/migrations/20260816063446_update_legacy_default_store_palette.sql", import.meta.url),
    "utf8",
  );
  const panelFrame = readFileSync(
    new URL("../src/components/panel/PanelFrame.tsx", import.meta.url),
    "utf8",
  );
  const tablesManager = readFileSync(
    new URL("../src/components/panel/TablesManager.tsx", import.meta.url),
    "utf8",
  );

  assert.match(panelShell, /<BrandLogo size="sm" priority \/>/);
  assert.match(panelShell, /label: "Mesa \/ Barra"/);
  assert.match(panelFrame, /title: "Mesa \/ Barra"/);
  assert.match(tablesManager, /Pedidos en Mesa \/ Barra/);
  assert.doesNotMatch(signupRoute, /primary_color:\s*"#2E3A79"/);
  assert.match(signupRoute, /primary_color:\s*"#1F464C"/);
  assert.match(settingsRoute, /accent_color:.*"#F27533"/);
  assert.match(migration, /lower\(primary_color\) = '#2e3a79'/);
  assert.match(migration, /lower\(accent_color\) = '#ffb547'/);
  assert.match(migration, /alter column primary_color set default '#1F464C'/);
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

test("tokens de Mesa se resuelven desde almacenamiento privado", () => {
  const tokenStore = readFileSync(
    new URL("../src/lib/server/table-order-tokens.ts", import.meta.url),
    "utf8",
  );
  const tablePage = readFileSync(
    new URL("../src/app/[storeSlug]/mesa/[storeToken]/page.tsx", import.meta.url),
    "utf8",
  );
  const tableApi = readFileSync(
    new URL("../src/app/api/panel/tables/route.ts", import.meta.url),
    "utf8",
  );
  const statusApi = readFileSync(
    new URL("../src/app/api/table-orders/status/route.ts", import.meta.url),
    "utf8",
  );
  const orderApi = readFileSync(
    new URL("../src/app/api/orders/route.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL("../supabase/migrations/20260818054500_move_table_order_tokens_to_private.sql", import.meta.url),
    "utf8",
  );
  const cleanupMigration = readFileSync(
    new URL("../supabase/migrations/20260819223000_drop_legacy_table_order_token.sql", import.meta.url),
    "utf8",
  );

  assert.match(tokenStore, /rpc\("table_order_token_for_store"/);
  assert.match(tokenStore, /rpc\("table_order_store_id_for_token"/);
  assert.doesNotMatch(tokenStore, /\.from\("stores"\)/);
  assert.doesNotMatch(tokenStore, /select\("table_order_token"\)/);
  assert.doesNotMatch(tokenStore, /eq\("table_order_token"/);
  assert.match(tablePage, /getStoreIdByTableOrderToken/);
  assert.match(tableApi, /getTableOrderTokenForStore/);
  assert.match(statusApi, /getStoreIdByTableOrderToken/);
  assert.match(orderApi, /isValidTableOrderTokenForStore/);
  assert.doesNotMatch(tablePage, /eq\("table_order_token"/);
  assert.doesNotMatch(statusApi, /eq\("table_order_token"/);
  assert.match(migration, /private\.store_table_order_tokens/);
  assert.match(migration, /revoke all on function public\.table_order_token_for_store\(uuid\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.table_order_token_for_store\(uuid\) to service_role/);
  assert.match(cleanupMigration, /drop index if exists public\.stores_table_order_token_uidx/);
  assert.match(cleanupMigration, /drop column if exists table_order_token/);
});

test("pedidos publicos y manuales se crean en una transaccion idempotente", () => {
  const publicRoute = readFileSync(
    new URL("../src/app/api/orders/route.ts", import.meta.url),
    "utf8",
  );
  const manualRoute = readFileSync(
    new URL("../src/app/api/panel/orders/route.ts", import.meta.url),
    "utf8",
  );
  const manualManager = readFileSync(
    new URL("../src/components/panel/ManualOrderManager.tsx", import.meta.url),
    "utf8",
  );
  const atomicHelper = readFileSync(
    new URL("../src/lib/server/create-order-atomic.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL("../supabase/migrations/20260820013000_create_order_atomic_rpc.sql", import.meta.url),
    "utf8",
  );

  assert.match(publicRoute, /createOrderAtomic/);
  assert.match(manualRoute, /createOrderAtomic/);
  assert.match(manualManager, /idempotencyKey/);
  assert.match(atomicHelper, /rpc\("create_order_atomic"/);
  assert.doesNotMatch(publicRoute, /from\("order_items"\)\.insert/);
  assert.doesNotMatch(manualRoute, /from\("order_items"\)\.insert/);
  assert.doesNotMatch(publicRoute, /from\("orders"\)\.delete/);
  assert.doesNotMatch(manualRoute, /from\("orders"\)\.delete/);
  assert.match(migration, /create or replace function public\.create_order_atomic/);
  assert.match(migration, /on conflict \(store_id, idempotency_key\)/);
  assert.match(migration, /insert into public\.order_items/);
  assert.match(migration, /insert into public\.order_item_options/);
  assert.match(migration, /revoke all on function public\.create_order_atomic\(jsonb, jsonb\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.create_order_atomic\(jsonb, jsonb\) to service_role/);
});

test("pedidos por zona de empresa delivery no usan la FK de zonas propias", () => {
  const publicRoute = readFileSync(
    new URL("../src/app/api/orders/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    publicRoute,
    /delivery_zone_id:\s*serverQuote\.provider === "transport_agency" \? null : serverQuote\.zoneId \|\| null/,
  );
  assert.match(
    publicRoute,
    /transport_agency_zone_name:[\s\S]{0,180}serverQuote\.zoneName \|\| null/,
  );
  assert.match(
    publicRoute,
    /transport_agency_id:[\s\S]{0,180}serverQuote\.transportAgencyId \|\| null/,
  );
});

test("Mesa y Barra actualiza pedidos sin reiniciar la vista y oculta su configuracion", () => {
  const manager = readFileSync(
    new URL("../src/components/panel/TablesManager.tsx", import.meta.url),
    "utf8",
  );

  assert.match(manager, /setIsSetupOpen\(!data\.enabled\)/);
  assert.match(manager, /Editar configuración/);
  assert.match(manager, /setActiveOrders\(\(current\) =>/);
  assert.match(manager, /await load\(true\)/);
  assert.doesNotMatch(manager, /if \(!response\.ok\)[\s\S]{0,160}await load\(\);/);
});

test("Mesa se elimina de forma protegida y pedido manual personaliza fuera del resumen", () => {
  const tablesApi = readFileSync(
    new URL("../src/app/api/panel/tables/route.ts", import.meta.url),
    "utf8",
  );
  const tablesManager = readFileSync(
    new URL("../src/components/panel/TablesManager.tsx", import.meta.url),
    "utf8",
  );
  const manualManager = readFileSync(
    new URL("../src/components/panel/ManualOrderManager.tsx", import.meta.url),
    "utf8",
  );
  const manualOrdersApi = readFileSync(
    new URL("../src/app/api/panel/orders/route.ts", import.meta.url),
    "utf8",
  );
  const catalogApi = readFileSync(
    new URL("../src/app/api/panel/catalogo/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(tablesApi, /export async function DELETE/);
  assert.match(tablesApi, /assertStoreManager\(auth, storeId\)/);
  assert.match(tablesApi, /Esta mesa tiene pedidos activos/);
  assert.match(tablesApi, /\.eq\("store_id", storeId\)/);
  assert.match(tablesManager, /¿Eliminar \$\{table\.name\}\?/);
  assert.match(manualManager, /role="dialog"/);
  assert.match(manualManager, /Cargando tamaños y extras/);
  assert.match(manualManager, /Personalizar/);
  assert.match(manualManager, /Tamaño o presentación/);
  assert.match(manualManager, /selectVariant/);
  assert.match(catalogApi, /product_variants\(id, name, price_usd, is_available, sort_order\)/);
  assert.match(manualOrdersApi, /Selecciona un tamaño o presentación/);
  assert.match(manualOrdersApi, /product_option_value_variant_prices/);
});

test("Entrega2 recibe cliente en contacto y comercio en telefono_comercio", () => {
  const route = readFileSync(
    new URL("../src/app/api/panel/orders/[orderId]/send-delivery/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /telefono_contacto:\s*normalizeInternationalPhone\(order\.customer_phone\)/);
  assert.match(route, /telefono_comercio:\s*normalizeInternationalPhone\(order\.stores\?\.whatsapp\)/);
});

test("cada comercio decide si solicita y recuerda la cedula del cliente", () => {
  const checkout = readFileSync(
    new URL("../src/components/public/CheckoutForm.tsx", import.meta.url),
    "utf8",
  );
  const settings = readFileSync(
    new URL("../src/app/api/panel/settings/route.ts", import.meta.url),
    "utf8",
  );
  const orders = readFileSync(
    new URL("../src/app/api/orders/route.ts", import.meta.url),
    "utf8",
  );
  const profile = readFileSync(
    new URL("../src/lib/customer-browser-profile.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL("../supabase/migrations/20260820023000_add_customer_id_request_setting.sql", import.meta.url),
    "utf8",
  );

  assert.match(settings, /request_customer_id_number:\s*Boolean/);
  assert.match(checkout, /store\.requestCustomerIdNumber/);
  assert.match(checkout, /profile\.idNumber/);
  assert.match(checkout, /<option value="V">V<\/option>/);
  assert.match(checkout, /<option value="E">E<\/option>/);
  assert.match(checkout, /<option value="J">J<\/option>/);
  assert.match(checkout, /inputMode="numeric"/);
  assert.match(profile, /idNumber:\s*cleanText/);
  assert.match(orders, /request_customer_id_number === true/);
  assert.match(orders, /Escribe la cédula del cliente/);
  assert.match(orders, /normalizeCustomerId/);
  assert.match(migration, /request_customer_id_number boolean not null default false/);
});

test("panel delivery evita recargas duplicadas en operaciones frecuentes", () => {
  const panel = readFileSync(
    new URL("../src/components/transport/TransportAgencyPanel.tsx", import.meta.url),
    "utf8",
  );
  const ordersRoute = readFileSync(
    new URL("../src/app/api/transport/panel/orders/route.ts", import.meta.url),
    "utf8",
  );
  const access = readFileSync(
    new URL("../src/lib/transport/access.ts", import.meta.url),
    "utf8",
  );

  assert.match(panel, /localTransportMutationsRef/);
  assert.match(panel, /recentLocalTransportMutationsRef/);
  assert.match(panel, /180_000/);
  assert.doesNotMatch(panel, /await loadTransportOrders\(\);\s*await load\(\);/);
  assert.doesNotMatch(panel, /hasLoadedBilling[\s\S]{0,100}includeBilling: true/);
  assert.doesNotMatch(ordersRoute, /count:\s*"exact"/);
  assert.match(ordersRoute, /range\(from, to \+ 1\)/);
  assert.match(access, /Promise\.all/);
});

test("panel delivery carga solo los datos necesarios por seccion", () => {
  const panel = readFileSync(
    new URL("../src/components/transport/TransportAgencyPanel.tsx", import.meta.url),
    "utf8",
  );
  const route = readFileSync(
    new URL("../src/app/api/transport/me/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(panel, /includeConfiguration:\s*initialTab !== "pedidos"/);
  assert.match(panel, /includeBillingDetail:\s*initialTab === "facturacion"/);
  assert.match(panel, /const needsBilling = tab === "facturacion" && !hasLoadedBillingDetail/);
  assert.match(panel, /const needsConfiguration = tab !== "pedidos" && !hasLoadedConfiguration/);
  assert.match(panel, /hasLoadedConfiguration && configIssues\.length/);
  assert.match(route, /const compactAgencySelect =/);
  assert.match(route, /const billingSummarySelect =/);
  assert.match(route, /includeBillingDetail \? billingOrdersSelect : billingSummarySelect/);
  assert.match(route, /configurationLoaded:\s*includeConfiguration/);
  assert.match(route, /billingDetailLoaded:\s*includeBilling && includeBillingDetail/);
});

test("pedidos usa Realtime con sondeo espaciado solo como respaldo", () => {
  const orders = readFileSync(
    new URL("../src/components/panel/OrdersManager.tsx", import.meta.url),
    "utf8",
  );
  const tableNotifier = readFileSync(
    new URL("../src/components/panel/TableOrderNotifier.tsx", import.meta.url),
    "utf8",
  );

  assert.match(orders, /ORDERS_FALLBACK_POLL_MS = 180_000/);
  assert.match(orders, /ORDERS_DISCONNECTED_POLL_MS = 15_000/);
  assert.match(orders, /status === "SUBSCRIBED"/);
  assert.match(orders, /isRealtimeReady \? ORDERS_FALLBACK_POLL_MS : ORDERS_DISCONNECTED_POLL_MS/);
  assert.match(orders, /visibilityState !== "visible"/);
  assert.match(orders, /broadcast", \{ event: "order_changed" \}/);
  assert.doesNotMatch(orders, /}, 30_000\)/);
  assert.match(tableNotifier, /TABLE_ORDERS_FALLBACK_POLL_MS = 120_000/);
  assert.match(tableNotifier, /TABLE_ORDERS_DISCONNECTED_POLL_MS = 15_000/);
  assert.match(tableNotifier, /channel\(`store:\$\{selectedStoreId\}:orders`/);
  assert.match(tableNotifier, /setIsRealtimeReady\(status === "SUBSCRIBED"\)/);
  assert.match(tableNotifier, /visibilityState === "visible"/);
  assert.match(tableNotifier, /broadcast", \{ event: "order_changed" \}/);
  assert.doesNotMatch(tableNotifier, /setInterval\([^\n]+, 20_000\)/);
});

test("panel delivery navega sin pantalla blanca y muta servicios atomicamente", () => {
  const panel = readFileSync(
    new URL("../src/components/transport/TransportAgencyPanel.tsx", import.meta.url),
    "utf8",
  );
  const ordersTab = readFileSync(
    new URL("../src/components/transport/TransportOrdersTab.tsx", import.meta.url),
    "utf8",
  );
  const transitions = readFileSync(
    new URL("../src/lib/transport/orders.ts", import.meta.url),
    "utf8",
  );
  const statusRoute = readFileSync(
    new URL("../src/app/api/transport/panel/orders/[transportOrderId]/status/route.ts", import.meta.url),
    "utf8",
  );
  const driverRoute = readFileSync(
    new URL("../src/app/api/transport/panel/orders/[transportOrderId]/driver/route.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL("../supabase/migrations/20260820033000_mutate_transport_order_atomic_rpc.sql", import.meta.url),
    "utf8",
  );

  assert.match(panel, /window\.history\.pushState/);
  assert.match(panel, /popstate/);
  assert.match(ordersTab, /statusActionsByCurrent/);
  assert.match(transitions, /driver_assigned:[^\n]*"on_the_way"/);
  assert.match(statusRoute, /mutateTransportOrderAtomic/);
  assert.match(driverRoute, /mutateTransportOrderAtomic/);
  assert.doesNotMatch(statusRoute, /insertTransportOrderEvent/);
  assert.doesNotMatch(driverRoute, /insertTransportOrderEvent/);
  assert.match(migration, /create or replace function public\.mutate_transport_order_atomic/);
  assert.match(migration, /for update/);
  assert.match(migration, /revoke all on function public\.mutate_transport_order_atomic/);
});

test("facturacion delivery permite filtrar servicios y pagos por repartidor", () => {
  const billingTab = readFileSync(
    new URL("../src/components/transport/TransportBillingTab.tsx", import.meta.url),
    "utf8",
  );

  assert.match(billingTab, /const \[driverFilter, setDriverFilter\]/);
  assert.match(billingTab, /getDriverFilterValue\(order\) === driverFilter/);
  assert.match(billingTab, /Todos los repartidores/);
  assert.match(billingTab, /Sin asignar/);
  assert.match(billingTab, /entryFilter === driverFilter/);
});

test("super admin activa el pack premium de empresas delivery", () => {
  const manager = readFileSync(
    new URL("../src/components/admin/AdminTransportManager.tsx", import.meta.url),
    "utf8",
  );
  const route = readFileSync(
    new URL("../src/app/api/admin/transport/agencies/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(manager, /updatePremiumDispatch/);
  assert.match(manager, /Activar premium/);
  assert.match(manager, /aria-pressed/);
  assert.match(route, /body\.action === "update_premium_dispatch"/);
  assert.match(route, /typeof body\.enabled !== "boolean"/);
  assert.match(route, /premium_dispatch_enabled: body\.enabled/);
  assert.match(route, /await requireAdminAuth\(request\)/);
});

test("Entrega2 corta esperas largas y activa contingencia temporal", () => {
  const integration = readFileSync(
    new URL("../src/lib/integrations/entrega2.ts", import.meta.url),
    "utf8",
  );
  const quoteRoute = readFileSync(
    new URL("../src/app/api/delivery/quote/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(integration, /ENTREGA2_QUOTE_TIMEOUT_MS = 4_500/);
  assert.match(integration, /ENTREGA2_ORDER_TIMEOUT_MS = 8_000/);
  assert.match(integration, /signal: controller\.signal/);
  assert.match(integration, /globalThis\.clearTimeout\(timeout\)/);
  assert.match(integration, /ENTREGA2_CIRCUIT_FAILURE_LIMIT = 3/);
  assert.match(integration, /assertEntrega2QuoteCircuitAvailable/);
  assert.match(quoteRoute, /entrega2_quote_fallback_used/);
  assert.match(quoteRoute, /calculateEntrega2FallbackQuote/);
});

test("Home y Marketplace hidratan delivery en tres consultas por lote", () => {
  const catalog = readFileSync(
    new URL("../src/lib/supabase/catalog.ts", import.meta.url),
    "utf8",
  );
  const batchHydrator = catalog.slice(
    catalog.indexOf("async function hydrateStoresDeliveryRelations"),
    catalog.indexOf("async function getMarketplaceEligibleStoreIds"),
  );

  assert.match(batchHydrator, /Promise\.all/);
  assert.match(batchHydrator, /\.in\("store_id", storeIds\)/);
  assert.match(batchHydrator, /settingsByStore/);
  assert.match(batchHydrator, /zonesByStore/);
  assert.match(batchHydrator, /ratesByStore/);
  assert.doesNotMatch(batchHydrator, /rows\.map\(async/);
});

test("pedidos permite vista consolidada y filtro seguro por sede", () => {
  const manager = readFileSync(
    new URL("../src/components/panel/OrdersManager.tsx", import.meta.url),
    "utf8",
  );
  const filters = readFileSync(
    new URL("../src/components/panel/orders/use-order-filters.ts", import.meta.url),
    "utf8",
  );
  const route = readFileSync(
    new URL("../src/app/api/panel/orders/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(manager, /Todas las sedes/);
  assert.match(manager, /order\.stores\?\.name/);
  assert.match(filters, /params\.set\("storeId", filters\.storeId\)/);
  assert.match(route, /requestedStoreId/);
  assert.match(route, /assertStoreAccess\([\s\S]*requestedStoreId/);
  assert.match(route, /query = query\.eq\("store_id", requestedStoreId\)/);
});

test("clonacion TDK crea sedes inactivas sin GPS ni pagos", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260820050000_clone_tdk_branches.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /pasteleria-tdk-delicias/);
  assert.match(migration, /pasteleria-tdk-los-cedros/);
  assert.match(migration, /false,\s*true,\s*source\.accepts_pickup/);
  assert.match(migration, /'\[\]'::jsonb/);
  assert.match(migration, /insert into public\.store_users/);
  assert.match(migration, /insert into public\.categories/);
  assert.match(migration, /insert into public\.products/);
  assert.match(migration, /insert into public\.product_images/);
  assert.match(migration, /'entrega2',\s*'manual'/);
});

test("TDK ofrece enlace unico con seleccion privada por cercania", () => {
  const page = readFileSync(
    new URL("../src/app/tdk/page.tsx", import.meta.url),
    "utf8",
  );
  const selector = readFileSync(
    new URL("../src/components/public/TdkBranchSelector.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /process\.env\.VERCEL_ENV === "preview"/);
  assert.match(page, /if \(!isPreview\) query = query\.eq\("is_active", true\)/);
  assert.match(page, /pasteleria-tdk-delicias/);
  assert.match(page, /pasteleria-tdk-los-cedros/);
  assert.match(selector, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(selector, /maximumAge: 300000/);
  assert.match(selector, /localStorage\.setItem\(storageKey/);
  assert.match(selector, /storageKey = "somos:tdk:last-branch"/);
  assert.match(selector, /Somos no la almacena/);
  assert.match(selector, /En configuración/);
  assert.match(selector, /Vista de prueba/);
  assert.match(selector, /href={`\/\${store\.slug}`}/);
});

test("catalogo y productos respetan la sede activa del panel", () => {
  const catalogRoute = readFileSync(
    new URL("../src/app/api/panel/catalogo/route.ts", import.meta.url),
    "utf8",
  );
  const productsRoute = readFileSync(
    new URL("../src/app/api/panel/products/route.ts", import.meta.url),
    "utf8",
  );

  for (const route of [catalogRoute, productsRoute]) {
    assert.match(route, /request\.headers\.get\("x-panel-store-id"\)/);
    assert.match(route, /assertStoreAccess\(auth, requestedStoreId/);
    assert.match(route, /storesQuery = storesQuery\.eq\("id", requestedStoreId\)/);
    assert.match(route, /categoriesQuery = categoriesQuery\.eq\("store_id", requestedStoreId\)/);
    assert.match(route, /productsQuery = productsQuery\.eq\("store_id", requestedStoreId\)/);
  }
});

test("configuracion delivery y opciones respetan la sede activa", () => {
  const routes = [
    "../src/app/api/panel/settings/route.ts",
    "../src/app/api/panel/delivery-settings/route.ts",
    "../src/app/api/panel/options/route.ts",
  ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));

  for (const route of routes) {
    assert.match(route, /request\.headers\.get\("x-panel-store-id"\)/);
    assert.match(route, /assertStoreAccess\(auth, requestedStoreId/);
  }

  assert.match(routes[0], /query = query\.eq\("id", requestedStoreId\)/);
  assert.match(routes[1], /requestedStoreId \? \[requestedStoreId\] : auth\.storeIds/);
  assert.match(routes[2], /groupsQuery = groupsQuery\.eq\("store_id", requestedStoreId\)/);
});

test("inicio usa la sede activa para catalogo y metricas", () => {
  const statsRoute = readFileSync(
    new URL("../src/app/api/panel/stats/route.ts", import.meta.url),
    "utf8",
  );
  const dashboard = readFileSync(
    new URL("../src/components/panel/DashboardManager.tsx", import.meta.url),
    "utf8",
  );

  assert.match(statsRoute, /request\.headers\.get\("x-panel-store-id"\)/);
  assert.match(statsRoute, /storesQuery = storesQuery\.eq\("id", selectedStoreId\)/);
  assert.match(statsRoute, /ordersQuery = ordersQuery\.eq\("store_id", selectedStoreId\)/);
  assert.match(dashboard, /href={`\/\${primaryStore\.slug}`}/);
});

test("tarjeta de pedido muestra la sede sin truncado agresivo", () => {
  const manager = readFileSync(
    new URL("../src/components/panel/OrdersManager.tsx", import.meta.url),
    "utf8",
  );

  assert.match(manager, /lg:grid-cols-\[92px_1fr_86px/);
  assert.match(manager, /function getCompactStoreName/);
  assert.match(manager, /replace\(\/\^Pasteler\[ií\]a TDK/);
  assert.match(manager, /className="line-clamp-2 text-\[11px\]/);
  assert.match(manager, /title=\{order\.stores\?\.name \|\| "Sede"\}/);
});

test("clientes suscripcion y logros quedan aislados por sede", () => {
  const customers = readFileSync(
    new URL("../src/app/api/panel/customers/route.ts", import.meta.url),
    "utf8",
  );
  const backfill = readFileSync(
    new URL("../src/app/api/panel/customers/backfill/route.ts", import.meta.url),
    "utf8",
  );
  const customerExport = readFileSync(
    new URL("../src/app/api/panel/customers/export/route.ts", import.meta.url),
    "utf8",
  );
  const subscription = readFileSync(
    new URL("../src/app/api/panel/subscription-payments/route.ts", import.meta.url),
    "utf8",
  );
  const achievements = readFileSync(
    new URL("../src/app/api/panel/achievements/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(customers, /const scopedStoreIds = requestedStoreId \? \[requestedStoreId\] : auth\.storeIds/);
  assert.match(customers, /hydrateCustomersFromExistingOrders\(supabase, scopedStoreIds\)/);
  assert.match(backfill, /request\.headers\.get\("x-panel-store-id"\)/);
  assert.match(customerExport, /request\.headers\.get\("x-panel-store-id"\)/);
  assert.match(subscription, /paymentsQuery = paymentsQuery\.eq\("store_id", requestedStoreId\)/);
  assert.match(achievements, /request\.headers\.get\("x-panel-store-id"\)/);
});

test("delivery conserva una sola sede despues de guardar reglas", () => {
  const route = readFileSync(
    new URL("../src/app/api/panel/delivery-settings/route.ts", import.meta.url),
    "utf8",
  );

  assert.equal((route.match(/loadRows\(supabase, \[storeId\]\)/g) || []).length, 3);
});

test("TDK puede estar activa sin aparecer en Marketplace", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260821030000_add_marketplace_visibility.sql", import.meta.url),
    "utf8",
  );
  const catalog = readFileSync(
    new URL("../src/lib/supabase/catalog.ts", import.meta.url),
    "utf8",
  );

  assert.match(migration, /marketplace_visible boolean not null default true/);
  assert.match(migration, /payment_methods = '\["Efectivo"\]'::jsonb/);
  assert.match(migration, /is_active = true/);
  assert.match(migration, /marketplace_visible = false/);
  assert.match(migration, /stores\.marketplace_visible is true/);
  assert.match(catalog, /row\.marketplace_visible !== false/);
});

test("super admin calcula crecimiento en PostgreSQL sin descargar pedidos", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260821040000_admin_growth_metrics.sql", import.meta.url),
    "utf8",
  );
  const route = readFileSync(
    new URL("../src/app/api/admin/summary/route.ts", import.meta.url),
    "utf8",
  );
  const dashboard = readFileSync(
    new URL("../src/components/admin/AdminDashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(migration, /create or replace function public\.admin_growth_metrics/);
  assert.match(migration, /stores\.is_test is not true/);
  assert.match(migration, /where is_cancelled is false/);
  assert.match(migration, /revoke all on function public\.admin_growth_metrics\(integer\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.admin_growth_metrics\(integer\) to service_role/);
  assert.match(route, /supabase\.rpc\("admin_growth_metrics", \{ p_months: 12 \}\)/);
  assert.match(dashboard, /Pedidos mes a mes/);
  assert.match(dashboard, /Ranking de comercios este mes/);
  assert.match(dashboard, /Pedidos por modalidad este mes/);
});

test("Marketplace usa ofertas ventas y ubicacion reales sin pedir permiso al abrir", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260821041000_marketplace_discovery.sql", import.meta.url),
    "utf8",
  );
  const marketplace = readFileSync(
    new URL("../src/components/public/MarketplaceClient.tsx", import.meta.url),
    "utf8",
  );
  const page = readFileSync(
    new URL("../src/app/marketplace/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(migration, /sum\(order_items\.quantity\)/);
  assert.match(migration, /orders\.created_at >= now\(\) - interval '7 days'/);
  assert.match(migration, /weekly_sales\.units_sold >= 10/);
  assert.match(migration, /partition by eligible_products\.store_id/);
  assert.match(migration, /where store_rank = 1/);
  assert.match(migration, /products\.discount_percent/);
  assert.match(migration, /where created_at >= now\(\) - interval '45 days'/);
  assert.match(migration, /stores\.marketplace_visible is true/);
  assert.match(migration, /revoke all on function public\.marketplace_discovery\(integer\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.marketplace_discovery\(integer\) to service_role/);
  assert.match(page, /getMarketplaceDiscovery\(\)/);
  assert.match(readFileSync(new URL("../src/lib/supabase/catalog.ts", import.meta.url), "utf8"), /row\.is_test !== true/);
  assert.match(marketplace, /onClick=\{requestLocation\}/);
  assert.doesNotMatch(marketplace, /useEffect\(\(\) => \{[^}]*requestLocation\(\)/);
  assert.match(marketplace, /distanceKm\(coordinates, store\)/);
  assert.match(marketplace, /Ofertas que valen la pena/);
  assert.match(marketplace, /Los favoritos de la semana/);
  assert.match(marketplace, /Las mejores opciones en un solo lugar/);
  assert.doesNotMatch(marketplace, /Un ganador por tienda|Comercios locales, productos reales|pedidos directos por WhatsApp/);
  assert.doesNotMatch(marketplace, /Tiendas recomendadas/);
  assert.match(marketplace, /grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4/);
  assert.match(marketplace, /placeholder="¿Que quieres pedir hoy\?"/);
  assert.match(marketplace, /"Abiertos", "Delivery", "Retiro", "Ofertas"/);
  assert.doesNotMatch(marketplace, />Ver catalogo/);
  assert.match(marketplace, /Reci.n llegados/);
  assert.match(marketplace, /No autorizaste la ubicacion/);
  assert.match(marketplace, /products=\{filteredOffers\}/);
  assert.match(marketplace, /products=\{filteredBestSellers\}/);
  assert.doesNotMatch(marketplace, /Escribe tu zona, ciudad o sector/);
});

test("Marketplace nuevo exige foto propia y usa una experiencia movil tipo app", () => {
  const marketplace = readFileSync(new URL("../src/components/public/MarketplaceClient.tsx", import.meta.url), "utf8");
  const discovery = readFileSync(new URL("../src/lib/marketplace.ts", import.meta.url), "utf8");

  assert.match(discovery, /select\("id, image_url"\)/);
  assert.match(discovery, /filter\(\(product\) => productImages\.has\(product\.productId\)\)/);
  assert.match(marketplace, /sticky top-14 z-30/);
  assert.match(marketplace, /Navegación del Marketplace/);
  assert.match(marketplace, /grid max-w-md grid-cols-4/);
  assert.match(marketplace, /<button type="button" onClick=\{requestLocation\}[\s\S]*<Compass[\s\S]*Cerca<\/button>/);
  assert.doesNotMatch(marketplace, /aria-label="Usar mi ubicación"/);
  assert.match(marketplace, /badge === "Oferta"[\s\S]*bg-\[#FFF0E8\][\s\S]*bg-\[#FFF7D9\][\s\S]*bg-\[#E8F6F1\]/);
  assert.match(marketplace, /bg-\[#FFF0E8\][\s\S]*<Home[\s\S]*bg-\[#E8F6F1\][\s\S]*<Compass/);
  assert.match(marketplace, /<BrandLogo size="sm" priority \/>/);
  assert.match(marketplace, /<PwaInstallButton subtle label="Instalar" \/>/);
});

test("instalacion PWA funciona aunque la pagina ya haya cargado y falla con ayuda", () => {
  const register = readFileSync(new URL("../src/components/pwa/RegisterServiceWorker.tsx", import.meta.url), "utf8");
  const install = readFileSync(new URL("../src/components/pwa/PwaInstallButton.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

  assert.match(register, /document\.readyState === "complete"[\s\S]*register\(\)/);
  assert.match(register, /addEventListener\("load", register, \{ once: true \}\)/);
  assert.match(layout, /strategy="beforeInteractive"[\s\S]*__somosInstallPrompt/);
  assert.match(install, /__somosInstallPrompt[\s\S]*somosinstallpromptready/);
  assert.match(install, /try \{[\s\S]*installPrompt\.prompt\(\)[\s\S]*catch \{[\s\S]*setShowHelp\(true\)/);
  assert.match(install, /disabled=\{installing\}/);
  assert.match(install, /fixed inset-x-4 top-20 z-\[80\][\s\S]*max-w-sm/);
});

test("registro configuracion y Marketplace comparten los mismos rubros", () => {
  const businessTypes = readFileSync(
    new URL("../src/lib/business-types.ts", import.meta.url),
    "utf8",
  );
  const signup = readFileSync(
    new URL("../src/components/public/SignupForm.tsx", import.meta.url),
    "utf8",
  );
  const marketplace = readFileSync(
    new URL("../src/components/public/MarketplaceClient.tsx", import.meta.url),
    "utf8",
  );
  const settings = readFileSync(
    new URL("../src/components/panel/ConfigManager.tsx", import.meta.url),
    "utf8",
  );

  assert.match(businessTypes, /value: "food", label: "Comida"/);
  assert.match(businessTypes, /value: "desserts", label: "Postres"/);
  assert.match(businessTypes, /value: "fashion", label: "Ropa"/);
  assert.match(businessTypes, /value: "tech", label: "Tecnología"/);
  assert.match(businessTypes, /value: "general", label: "Otros"/);
  assert.match(businessTypes, /\["fashion", "ropa", "moda", "ropa \/ moda"\]/);
  assert.match(signup, /BUSINESS_TYPES\.map/);
  assert.match(settings, /BUSINESS_TYPES\.map/);
  assert.match(marketplace, /businessTypeLabel\(store\.category\)/);
  assert.match(marketplace, /\["Todos", \.\.\.BUSINESS_TYPES\.map/);
});

test("Home pregunta una sola vez si el visitante quiere comprar o vender", () => {
  const welcome = readFileSync(
    new URL("../src/components/public/WelcomeChoice.tsx", import.meta.url),
    "utf8",
  );
  const home = readFileSync(
    new URL("../src/components/public/HomeClient.tsx", import.meta.url),
    "utf8",
  );

  assert.match(welcome, /somos-welcome-choice-v1/);
  assert.match(welcome, /localStorage\.getItem\(WELCOME_CHOICE_KEY\)/);
  assert.match(welcome, /localStorage\.setItem\(WELCOME_CHOICE_KEY, choice\)/);
  assert.match(welcome, /href="\/marketplace"/);
  assert.match(welcome, /Quiero comprar/);
  assert.match(welcome, /Quiero vender con Somos/);
  assert.match(welcome, /aria-modal="true"/);
  assert.match(welcome, /setAttribute\("inert", ""\)/);
  assert.match(welcome, /event\.key === "Escape"/);
  assert.match(welcome, /firstChoiceRef\.current\?\.focus\(\)/);
  assert.match(welcome, /Ahora no, ver inicio/);
  assert.match(home, /<WelcomeChoice \/>/);
});

test("Somos usa su WhatsApp oficial en Home y despues de cada registro", () => {
  const whatsapp = readFileSync(new URL("../src/lib/whatsapp.ts", import.meta.url), "utf8");
  const home = readFileSync(new URL("../src/components/public/HomeClient.tsx", import.meta.url), "utf8");
  const signup = readFileSync(new URL("../src/components/public/SignupForm.tsx", import.meta.url), "utf8");
  const transport = readFileSync(new URL("../src/components/transport/TransportRegistrationForm.tsx", import.meta.url), "utf8");

  assert.match(whatsapp, /SOMOS_WHATSAPP_PHONE = "584224600742"/);
  assert.match(home, /Contactar por WhatsApp/);
  assert.match(signup, /window\.location\.assign\(officialWhatsappUrl\)/);
  assert.match(signup, /Enviar registro a Somos/);
  assert.doesNotMatch(signup, /`Cédula: \$\{representativeIdNumber/);
  assert.match(transport, /window\.location\.assign\(whatsappUrl\)/);
  assert.match(transport, /Enviar registro a Somos/);
});

test("catalogo compacta acciones instala Somos y oculta el horario predeterminado", () => {
  const catalog = readFileSync(new URL("../src/components/public/CatalogClient.tsx", import.meta.url), "utf8");
  const header = readFileSync(new URL("../src/components/public/StoreBrandHeader.tsx", import.meta.url), "utf8");
  const mapper = readFileSync(new URL("../src/lib/supabase/catalog.ts", import.meta.url), "utf8");

  assert.match(catalog, /grid grid-cols-4/);
  assert.match(catalog, /<PwaInstallButton tile label="Instalar Somos" \/>/);
  assert.match(catalog, /<span className="sr-only">WhatsApp<\/span>/);
  assert.doesNotMatch(catalog, />Promocional<\/p>/);
  assert.doesNotMatch(catalog, /ShieldCheck/);
  assert.doesNotMatch(catalog, /store\.deliveryEstimate \|\| "Delivery"/);
  assert.match(header, /toLowerCase\(\) !== "disponible hoy"/);
  assert.doesNotMatch(header, /store\.openingHours \|\| "Disponible hoy"/);
  assert.match(mapper, /toLowerCase\(\) === "disponible hoy"/);
  const install = readFileSync(new URL("../src/components/pwa/PwaInstallButton.tsx", import.meta.url), "utf8");
  assert.match(install, /if \(tile\)[\s\S]*href="\/"[\s\S]*somos-isotipo-preview\.png/);
});

test("La Cremita comparte cuenta y ofrece selector seguro de sedes", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260821213759_clone_la_cremita_las_ballenas.sql", import.meta.url),
    "utf8",
  );
  const page = readFileSync(new URL("../src/app/la-cremita/page.tsx", import.meta.url), "utf8");

  assert.match(migration, /la-cremita-gourmet-las-ballenas/);
  assert.match(migration, /10\.267079665610519/);
  assert.match(migration, /-67\.59386449349098/);
  assert.match(migration, /insert into public\.store_users/);
  assert.match(migration, /product_option_groups/);
  assert.doesNotMatch(migration, /insert into public\.orders/);
  assert.match(page, /somos:la-cremita:last-branch/);
  assert.match(page, /la-cremita-gourmet-las-ballenas/);
});

test("delivery propio conserva km adicional simula tarifas y rechaza precios vacios", () => {
  const manager = readFileSync(new URL("../src/components/panel/DeliveryManager.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../src/app/api/panel/delivery-settings/route.ts", import.meta.url), "utf8");
  const delivery = readFileSync(new URL("../src/lib/delivery.ts", import.meta.url), "utf8");
  const ranges = readFileSync(new URL("../src/lib/distance-ranges.ts", import.meta.url), "utf8");

  assert.match(manager, /USD por km adicional/);
  assert.match(manager, /Simulador de tarifa/);
  assert.match(manager, /describeDistanceRangeFee/);
  assert.match(route, /distance_factor: optionalNumber\(body\.distanceFactor\)/);
  assert.match(route, /Indica el precio de este rango/);
  assert.match(route, /Indica el precio de esta zona/);
  assert.match(route, /findDistanceRangeGap\(activeRates\)/);
  assert.match(manager, /Falta precio desde \{distanceRangeGap\.fromKm\} km hasta \{distanceRangeGap\.toKm\} km/);
  assert.match(ranges, /next\.minKm > current\.maxKm/);
  assert.match(ranges, /first\.minKm < secondEnd && second\.minKm < firstEnd/);
  assert.match(delivery, /distanceFactor: optionalNumber\(settings\.distance_factor\)/);
});

test("checkout destaca nota opcional con ejemplo por rubro o por comercio", () => {
  const checkout = readFileSync(new URL("../src/components/public/CheckoutForm.tsx", import.meta.url), "utf8");
  const examples = readFileSync(new URL("../src/lib/checkout-notes.ts", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../src/components/panel/ConfigManager.tsx", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/20260824170036_add_checkout_note_placeholder.sql", import.meta.url), "utf8");

  assert.match(checkout, /5\. Indicaciones del pedido \(opcional\)/);
  assert.match(checkout, /checkoutNoteExample\(store\.category, store\.checkoutNotePlaceholder\)/);
  assert.match(examples, /Feliz cumpleaños Ana/);
  assert.match(settings, /Ejemplo para la nota del pedido/);
  assert.match(migration, /add column if not exists checkout_note_placeholder text/);
});

test("checkout presenta empresa delivery como informacion y no como boton", () => {
  const checkout = readFileSync(new URL("../src/components/public/CheckoutForm.tsx", import.meta.url), "utf8");

  assert.match(checkout, /aria-label="Información sobre la empresa delivery"/);
  assert.match(checkout, /Tu entrega será coordinada por/);
  assert.doesNotMatch(checkout, /Recibirá los datos de entrega cuando confirmes tu pedido/);
  assert.match(checkout, /border-l-2 border-\[#FFB547\]/);
  assert.doesNotMatch(checkout, /Delivery gestionado por \{deliveryPartnerName\}/);
  assert.match(checkout, /overflow-hidden rounded-full/);
  assert.match(checkout, /className="object-cover"/);
});

test("checkout separa nota del pedido de la informacion del efectivo", () => {
  const checkout = readFileSync(new URL("../src/components/public/CheckoutForm.tsx", import.meta.url), "utf8");
  const orderRoute = readFileSync(new URL("../src/app/api/orders/route.ts", import.meta.url), "utf8");
  const ordersPanel = readFileSync(new URL("../src/components/panel/OrdersManager.tsx", import.meta.url), "utf8");
  const whatsapp = readFileSync(new URL("../src/lib/whatsapp.ts", import.meta.url), "utf8");

  assert.match(checkout, /value=\{form\.cashPaymentNote\}/);
  assert.match(checkout, /value=\{form\.notes\}/);
  assert.match(checkout, /5\. Indicaciones del pedido \(opcional\)/);
  assert.match(checkout, /rounded-\[30px\] border border-\[#FFB547\]\/45 bg-\[#FFF8F0\]/);
  assert.doesNotMatch(checkout, /value=\{form\.cashPaymentNote\}[\s\S]{0,250}bg-\[#FFF8F0\]/);
  assert.match(orderRoute, /payment_notes: isCashPaymentMethod\(order\.form\.paymentMethod\)/);
  assert.match(orderRoute, /\.eq\("store_id", storeId\)/);
  assert.match(ordersPanel, /order\.payment_notes/);
  assert.match(whatsapp, /cashPaymentNote/);
});

test("estadisticas agregan en Postgres sin limite y conservan aislamiento", () => {
  const route = readFileSync(new URL("../src/app/api/panel/stats/route.ts", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../supabase/migrations/20260825024934_optimize_panel_store_stats_rpc.sql", import.meta.url),
    "utf8",
  );

  assert.match(route, /rpc\(\s*"panel_store_stats"/);
  assert.match(route, /p_store_ids: auth\.storeIds/);
  assert.match(route, /p_store_id: selectedStoreId/);
  assert.match(route, /aggregate\?\.summary\?\.aggregationVersion === 2/);
  assert.match(route, /capped: false/);
  assert.match(migration, /'aggregationVersion', 2/);
  assert.match(migration, /sum\(merchant_revenue_usd\)/);
  assert.match(migration, /'deliveryFeesUsd'/);
  assert.match(migration, /from billable_orders as scoped_orders/);
  assert.match(
    migration,
    /revoke all on function public\.panel_store_stats\([\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.panel_store_stats\([\s\S]*to service_role/,
  );
});

test("Pizza Mia carga promociones idempotentes con ingrediente incluido", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260826014000_load_pizza_mia_promotions.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /where slug = 'pizza-mia'/);
  assert.match(migration, /lower\(btrim\(name\)\) = 'promociones'/);
  assert.match(migration, /'Pizza Personal Margarita'.*3\.99::numeric/);
  assert.match(migration, /'Pizza Personal Tocineta \+ Maíz'.*5\.99::numeric/);
  assert.match(migration, /'Sici Box'.*6\.99::numeric/);
  assert.match(migration, /'Pasticho Personal'.*6\.99::numeric/);
  assert.match(migration, /'Pizza Grande Margarita'.*9\.99::numeric/);
  assert.match(migration, /'Pizza Grande Charchu Mix'.*14\.99::numeric/);
  assert.match(migration, /'Pizza Gigante 4x4'.*16\.99::numeric/);
  assert.match(migration, /'2 Pizzas Grandes'.*19\.99::numeric/);
  assert.match(migration, /'Siciliana'.*19\.99::numeric/);
  assert.match(migration, /'Elige tu ingrediente incluido'/);
  assert.match(migration, /on conflict \(product_id, option_group_id\)/);
  assert.doesNotMatch(migration, /set image_url\s*=/);
  assert.doesNotMatch(migration, /update public\.stores/);
});

test("Pizza Mia carga menu regular oculto sin tocar promociones", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260826023000_load_pizza_mia_regular_menu.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /No toca la categoria Promociones/);
  assert.match(migration, /'Mía Especial'/);
  assert.match(migration, /'Buffalo Chicken Pizza'/);
  assert.match(migration, /'Arma tu pizza como quieras'/);
  assert.match(migration, /'Pizza Siciliana'.*Precio base pendiente por confirmar/);
  assert.match(migration, /'Philly Cheesesteak'/);
  assert.match(migration, /'Crispy Chicken'/);
  assert.match(migration, /Grande con borde de queso/);
  assert.match(migration, /product_option_value_variant_prices/);
  assert.match(migration, /when 'Personal \(8" \/ 20\.5 cm\)' then 1/);
  assert.match(migration, /when 'Pequeña \(10" \/ 25 cm\)' then 1\.5/);
  assert.match(migration, /when 'Grande \(13" \/ 33 cm\)' then 2/);
  assert.match(migration, /when 'Gigante \(17" \/ 42 cm\)' then 2\.5/);
  assert.match(migration, /'Ingredientes adicionales - Pan Pizza'.*\$2\.50/);
  assert.match(migration, /'Ingredientes adicionales - Pizza Siciliana'.*\$3\.00/);
  assert.match(migration, /'Extras para tu Sub'.*\$1\.50/);
  assert.match(migration, /is_available = false/);
  assert.doesNotMatch(migration, /update public\.stores/);
  assert.doesNotMatch(migration, /category_name[^\n]*Promociones/);
});

test("La Maravilla del Sushi queda con veinte productos exactos", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260826031500_correct_la_maravilla_sushi_menu.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /where slug = 'la-maravilla-del-sushi'/);
  assert.match(migration, /'Entradas'.*1/);
  assert.match(migration, /'Tempurizados'.*'Tempurizados \(12 piezas\)'/);
  assert.match(migration, /'Fríos'.*'Fríos \(10 piezas\)'/);
  assert.match(migration, /'Promociones'.*4/);
  assert.match(migration, /'Croquetas de Cangrejo'.*'Croquetas de cangrejo'/);
  assert.match(migration, /'Dinamita Roll'.*'Dinamit Roll'/);
  assert.match(migration, /'Camarón Roll'.*10/);
  assert.match(migration, /'Salmón Roll'.*11/);
  assert.match(migration, /'Me Prefieres a Mí'.*11/);
  assert.match(migration, /'Pa'' Que La Pases Bien'.*21/);
  assert.match(migration, /5 Cangrejo Rolls/);
  assert.match(migration, /delete from public\.product_variants/);
  assert.match(migration, /not exists \([\s\S]*desired\.product_id = products\.id/);
  assert.doesNotMatch(migration, /update public\.stores/);
});

test("Superadmin controla exclusivamente la visibilidad de Marketplace", () => {
  const manager = readFileSync(
    new URL("../src/components/admin/AdminStoresManager.tsx", import.meta.url),
    "utf8",
  );
  const adminStores = readFileSync(
    new URL("../src/lib/admin/stores.ts", import.meta.url),
    "utf8",
  );
  const route = readFileSync(
    new URL("../src/app/api/admin/stores/[storeId]/marketplace/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(adminStores, /marketplace_visible/);
  assert.match(manager, /toggleMarketplace/);
  assert.match(manager, /\/api\/admin\/stores\/\$\{store\.id\}\/marketplace/);
  assert.match(route, /requireAdminAuth\(request\)/);
  assert.match(route, /\.update\(\{ marketplace_visible: body\.visible \}\)/);
  assert.match(route, /\.eq\("id", storeId\)/);
  assert.doesNotMatch(route, /is_active|subscription_status|plan_type/);
});
test("Marketplace y registro conservan ciudad estructurada", () => {
  const marketplace = readFileSync(
    new URL("../src/components/public/MarketplaceClient.tsx", import.meta.url),
    "utf8",
  );
  const signup = readFileSync(
    new URL("../src/app/api/signup/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(marketplace, /Filtrar por ciudad/);
  assert.match(marketplace, /store\.citySlug === activeCity/);
  assert.match(signup, /from\("service_cities"\)/);
  assert.match(signup, /city_id: city\.id/);
});

test("registro preserva la clave y no confunde rechazo de seguridad con longitud", () => {
  const signup = readFileSync(
    new URL("../src/app/api/signup/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(signup, /const password = String\(body\.get\("password"\) \|\| ""\)/);
  assert.match(signup, /Por seguridad, no podemos aceptar esa combinacion/);
  assert.doesNotMatch(signup, /const password = cleanText/);
});

test("cuentas pueden cambiar contraseña desde ambos paneles", () => {
  const form = readFileSync(new URL("../src/components/panel/UpdatePasswordForm.tsx", import.meta.url), "utf8");
  const panelShell = readFileSync(new URL("../src/components/panel/PanelShell.tsx", import.meta.url), "utf8");
  const transportNav = readFileSync(new URL("../src/components/transport/transport-panel-helpers.ts", import.meta.url), "utf8");
  const transportPage = readFileSync(new URL("../src/app/transporte/panel/seguridad/page.tsx", import.meta.url), "utf8");

  assert.match(form, /supabase\.auth\.updateUser\(\{ password \}\)/);
  assert.match(form, /password\.length < 8/);
  assert.match(form, /password !== confirmPassword/);
  assert.match(panelShell, /\/panel\/update-password/);
  assert.match(transportNav, /\/transporte\/panel\/seguridad/);
  assert.match(transportPage, /loginHref="\/transporte\/panel"/);
});

test("empresa delivery personaliza colores de su Marketplace con validacion server-side", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260904044204_transport_agency_marketplace_colors.sql", import.meta.url), "utf8");
  const route = readFileSync(new URL("../src/app/api/transport/agencies/[agencyId]/route.ts", import.meta.url), "utf8");
  const marketplace = readFileSync(new URL("../src/components/public/MarketplaceClient.tsx", import.meta.url), "utf8");

  assert.match(migration, /marketplace_primary_color text not null default '#143D42'/);
  assert.match(migration, /check \(marketplace_primary_color ~ '\^#\[0-9A-Fa-f\]\{6\}\$'\)/);
  assert.match(route, /assertAgencyManager\(auth, agencyId/);
  assert.match(route, /\^#\[0-9A-F\]\{6\}\$/);
  assert.match(marketplace, /--marketplace-primary/);
  assert.match(marketplace, /bg-\[var\(--marketplace-primary\)\]/);
});

test("respaldo CSV de pedidos delivery queda limitado a la empresa autorizada", () => {
  const route = readFileSync(new URL("../src/app/api/transport/panel/orders/export/route.ts", import.meta.url), "utf8");
  const billing = readFileSync(new URL("../src/components/transport/TransportBillingTab.tsx", import.meta.url), "utf8");

  assert.match(route, /requireTransportAgencyAuth\(request\)/);
  assert.match(route, /canUseAgencyRole\(auth, requestedAgencyId, \["owner", "admin", "billing"\]\)/);
  assert.match(route, /if \(!requestedAgencyId\)/);
  assert.match(route, /\.eq\("agency_id", requestedAgencyId\)/);
  assert.match(route, /MAX_EXPORT_ROWS = 5000/);
  assert.match(route, /checkDistributedRateLimit/);
  assert.match(route, /X-Content-Type-Options": "nosniff"/);
  assert.match(route, /\^\[=\+\\-@\\t\\r\]/);
  assert.match(billing, /Descargar respaldo CSV/);
});
