import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const catalog = readFileSync("src/lib/supabase/catalog.ts", "utf8");
const checkout = readFileSync("src/components/public/CheckoutForm.tsx", "utf8");

const transportLookup = catalog.indexOf("loadTransportAgencyDeliverySettings(");
const ownDeliveryFallback = catalog.indexOf("disableUnavailableTransportAgencySettings(");

assert.ok(transportLookup >= 0, "El catálogo debe consultar la conexión delivery activa.");
assert.ok(
  ownDeliveryFallback > transportLookup,
  "La conexión delivery activa debe resolverse antes que el delivery propio."
);
assert.match(
  catalog,
  /if \(transport\) \{[\s\S]*?deliverySettings:[\s\S]*?\.\.\.transport\.settings/,
  "La configuración de la empresa delivery debe reemplazar la configuración propia."
);
assert.match(
  checkout,
  /deliverySettings\.deliveryProvider !== "entrega2"[\s\S]*?deliverySettings\.pricingType === "zones"/,
  "Entrega2 no debe mostrar el selector de zonas propias."
);

console.log("Delivery priority contract OK.");
