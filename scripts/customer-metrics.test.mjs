import assert from "node:assert/strict";
import { test } from "node:test";
import {
  customerProductValueUsd,
  isCustomerOrderCancelled,
} from "../src/lib/customers/customer-metrics.ts";

test("customer value uses products only and excludes delivery", () => {
  assert.equal(customerProductValueUsd({ subtotal_usd: 12, total_usd: 15, delivery_usd: 3 }), 12);
  assert.equal(customerProductValueUsd({ subtotal_usd: null, total_usd: 15, delivery_usd: 3 }), 12);
  assert.equal(customerProductValueUsd({ subtotal_usd: null, total_usd: 2, delivery_usd: 3 }), 0);
});

test("customer metrics recognize every supported cancelled status", () => {
  assert.equal(isCustomerOrderCancelled("cancelled"), true);
  assert.equal(isCustomerOrderCancelled("CANCELED"), true);
  assert.equal(isCustomerOrderCancelled("cancelado"), true);
  assert.equal(isCustomerOrderCancelled("completed"), false);
});
