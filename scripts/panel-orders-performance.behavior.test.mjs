import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/panel/orders/route.ts", "utf8");
const compactSelect = route.match(/const compactOrdersSelect = `([\s\S]*?)`;/)?.[1] || "";

for (const field of [
  "public_code",
  "customer_name",
  "customer_phone",
  "payment_status",
  "payment_reference",
  "delivery_provider",
  "transport_agency_id",
  "total_usd",
  "status",
  "created_at",
  "order_integrations",
  "transport_orders",
]) {
  assert.match(compactSelect, new RegExp(`\\b${field}\\b`), `Falta ${field} en la lista compacta.`);
}

for (const detailOnlyField of [
  "whatsapp_message",
  "delivery_address",
  "delivery_lat",
  "delivery_lng",
  "order_details",
  "notes",
]) {
  assert.doesNotMatch(compactSelect, new RegExp(`\\b${detailOnlyField}\\b`), `${detailOnlyField} debe cargarse al abrir el detalle.`);
}

assert.match(route, /searchParams\.get\("orderId"\)/);
assert.match(route, /attachOrderRelations\(supabase, data \? \[withPaymentFallback\(data\)\]/);

console.log("panel-orders-performance: PASS");
