import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeMobileRoute, safeCheckoutDraft, mobileBackTarget, readMobile, writeMobile, bindMobileAccount, clearMobilePrivateState } from "../src/lib/mobile/state.ts";
import { fetchPanelJson, clearPanelReadCache } from "../src/lib/panel/client-fetch-cache.ts";

test("Android ofrece acceso visible a cliente, comercio y empresa delivery", () => {
  const nativeExperience = readFileSync(new URL("../src/components/mobile/NativeExperience.tsx", import.meta.url), "utf8");
  const panelShell = readFileSync(new URL("../src/components/panel/PanelShell.tsx", import.meta.url), "utf8");
  const transportPanel = readFileSync(new URL("../src/components/transport/TransportAgencyPanel.tsx", import.meta.url), "utf8");

  assert.match(nativeExperience, /title: "Cliente"[\s\S]*?href: "\/marketplace"/);
  assert.match(nativeExperience, /title: "Comercio"[\s\S]*?href: "\/panel\/login"/);
  assert.match(nativeExperience, /title: "Empresa delivery"[\s\S]*?href: "\/transporte\/panel"/);
  assert.match(nativeExperience, /Elige cómo deseas ingresar/);
  assert.match(panelShell, /href="\/" title="Cambiar perfil"/);
  assert.match(transportPanel, /isNativeApp \? <Link href="\/"[\s\S]*?Cambiar perfil/);
});

test("empresa delivery usa navegación y servicios optimizados para Android", () => {
  const transportPanel = readFileSync(new URL("../src/components/transport/TransportAgencyPanel.tsx", import.meta.url), "utf8");
  const transportOrders = readFileSync(new URL("../src/components/transport/TransportOrdersTab.tsx", import.meta.url), "utf8");

  assert.match(transportPanel, /className="native-delivery-nav"/);
  assert.match(transportPanel, />Servicios</);
  assert.match(transportPanel, />Repartidores</);
  assert.match(transportPanel, />Resumen</);
  assert.match(transportPanel, />Más</);
  assert.match(transportPanel, /native-delivery-offline/);
  assert.match(transportPanel, /nativeOrderAlerts\(\)\?\.enable\(\)/);
  assert.match(transportPanel, /nativeOrderAlerts\(\)\?\.show\(\{ id: `delivery-\$\{newOrder\.id\}` \}\)/);
  assert.match(transportOrders, /data-native-delivery-orders/);
  assert.match(transportOrders, /Abrir ubicación en mapas/);
  assert.match(transportOrders, /Enviar servicio al repartidor por WhatsApp/);
});

test("delivery completa Google nativo y abre primero una carga compacta", () => {
  const transportPanel = readFileSync(
    new URL("../src/components/transport/TransportAgencyPanel.tsx", import.meta.url),
    "utf8"
  );
  assert.match(transportPanel, /completeNativePanelOAuthSession/);
  assert.match(transportPanel, /window\.addEventListener\("somos:resume", completeNativeOAuthLogin\)/);
  assert.match(transportPanel, /window\.addEventListener\("focus", completeNativeOAuthLogin\)/);
  assert.match(
    transportPanel,
    /includeBilling: false,[\s\S]*includeConfiguration: false,[\s\S]*includeRelations: false/
  );
});

test("restore accepts canonical internal paths only", () => {
  for (const route of ["/marketplace", "/smash-test", "/smash-test/carrito", "/smash-test/checkout", "/panel/pedidos"]) assert.equal(safeMobileRoute(route), route);
  for (const route of ["https://evil.test", "//evil.test", "/panel?token=secret", "/smash#access_token=secret", "/auth", "/api", "/admin", "/transporte", "/panel/login", "/smash/mesa/private-token", "/%2fexample", "/smash/../panel", "/smash\\panel", " /smash"]) assert.equal(safeMobileRoute(route), null, route);
});
test("back stays inside the current space and root exits", () => {
  assert.equal(mobileBackTarget("/marketplace", "/panel"), null);
  assert.equal(mobileBackTarget("/panel/pedidos", "/marketplace"), null);
  assert.equal(mobileBackTarget("/panel/productos", "/marketplace"), "/panel/pedidos");
  assert.equal(mobileBackTarget("/smash/checkout", "/panel"), "/smash/carrito");
  assert.equal(mobileBackTarget("/smash/confirmacion", "/smash/checkout"), "/smash");
  assert.equal(mobileBackTarget("/smash", "/panel"), "/marketplace");
  assert.equal(mobileBackTarget("/smash", "/smash/carrito"), "/marketplace");
});
test("a response arriving after logout cannot repopulate the panel cache", async () => {
  const originalFetch = globalThis.fetch;
  let resolveFirst;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return new Promise((resolve) => { resolveFirst = resolve; });
    return Response.json({ account: "new" });
  };
  try {
    clearPanelReadCache();
    const first = fetchPanelJson("/api/panel/test");
    clearPanelReadCache();
    resolveFirst(Response.json({ account: "old" }));
    await first;
    assert.deepEqual(await fetchPanelJson("/api/panel/test"), { account: "new" });
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; clearPanelReadCache(); }
});
test("draft stores only customer-entered safe fields, never financial authority or credentials", () => {
  assert.deepEqual(safeCheckoutDraft({ customerName: "Ana", customerPhone: "123", notes: "Sin cebolla", deliveryType: "pickup", paymentReceiptToken: "secret", paymentReference: "bank", quoteToken: "secret", price: 1, access_token: "secret", tableToken: "secret", nationalIdNumber: "id" }), { customerName: "Ana", customerPhone: "123", notes: "Sin cebolla", deliveryType: "pickup" });
  assert.equal(safeCheckoutDraft({ deliveryType: "table" }).deliveryType, undefined);
});
test("switching accounts clears private preferences but preserves carts and buyer drafts", () => {
  const values = {};
  globalThis.window = { Capacitor: { isNativePlatform: () => true } };
  globalThis.localStorage = new Proxy({ getItem: (k) => values[k] || null, setItem: (k, v) => { values[k] = v; }, removeItem: (k) => { delete values[k]; } }, { ownKeys: () => Object.keys(values), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
  bindMobileAccount("A"); writeMobile("private_store", "store-a"); writeMobile("buyer_route", "/smash");
  bindMobileAccount("A"); assert.equal(readMobile("private_store", ""), "store-a");
  bindMobileAccount("B"); assert.equal(readMobile("private_store", ""), "");
  assert.equal(readMobile("buyer_route", ""), "/smash");
  clearMobilePrivateState(); assert.equal(readMobile("account", ""), "");
  window.Capacitor.isNativePlatform = () => false;
  writeMobile("private_store", "never"); assert.equal(readMobile("private_store", ""), "");
  delete globalThis.window; delete globalThis.localStorage;
});
