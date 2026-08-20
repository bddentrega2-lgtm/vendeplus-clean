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
