import assert from "node:assert/strict";
import test from "node:test";
import { loadServiceFeeBalances } from "../src/lib/billing/service-fees.ts";

function mockSupabase(orders, payments = []) {
  const orderRanges = [];
  return {
    orderRanges,
    from(table) {
      assert.ok(["orders", "store_subscription_payments"].includes(table));
      const filters = {};
      const query = {
        select() { return query; },
        in(_column, ids) { filters.ids = ids; return query; },
        eq(column, value) { filters[column] = value; return query; },
        gt(_column, value) { filters.minFee = value; return query; },
        gte(_column, value) { filters.start = value; return query; },
        order() { return query; },
        range(from, to) {
          if (table === "orders") orderRanges.push([from, to]);
          const rows = table === "orders"
            ? orders
              .filter((row) => filters.ids.includes(row.store_id))
              .filter((row) => row.platform_service_fee_usd > filters.minFee)
              .filter((row) => !filters.start || row.created_at >= filters.start)
              .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
            : payments
              .filter((row) => filters.ids.includes(row.store_id))
              .filter((row) => row.status === filters.status && row.plan_type === filters.plan_type)
              .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
          return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
        },
      };
      return query;
    },
  };
}

test("fees include cancelled orders and paginate beyond the API row limit", async () => {
  const orders = Array.from({ length: 1200 }, (_, index) => ({
    id: String(index).padStart(4, "0"),
    store_id: "china",
    created_at: index < 488 ? "2026-09-19T10:00:00Z" : "2026-09-20T17:00:00Z",
    status: index % 8 === 0 ? "cancelled" : "received",
    platform_service_fee_usd: 0.1,
  }));
  orders.push({ id: "other", store_id: "monthly", created_at: "2026-09-20T17:00:00Z", platform_service_fee_usd: 0.1 });
  const supabase = mockSupabase(orders);
  const result = await loadServiceFeeBalances(supabase, [
    { id: "china", plan_type: "per_service", last_payment_at: "2026-09-20T16:00:00Z" },
    { id: "monthly", plan_type: "monthly" },
  ]);

  assert.deepEqual(result.get("china"), {
    periodStart: "2026-09-20T16:00:00Z",
    serviceCount: 712,
    amountUsd: 71.2,
  });
  assert.equal(result.has("monthly"), false);
  assert.deepEqual(supabase.orderRanges, [[0, 499], [500, 999]]);
});

test("fees keep each store's own payment cutoff", async () => {
  const supabase = mockSupabase([
    { id: "1", store_id: "a", created_at: "2026-09-18T00:00:00Z", platform_service_fee_usd: 0.1 },
    { id: "2", store_id: "a", created_at: "2026-09-20T00:00:00Z", platform_service_fee_usd: 0.1 },
    { id: "3", store_id: "b", created_at: "2026-09-18T00:00:00Z", platform_service_fee_usd: 0.25 },
    { id: "4", store_id: "b", created_at: "2026-09-20T00:00:00Z", platform_service_fee_usd: 0 },
  ]);
  const balances = await loadServiceFeeBalances(supabase, [
    { id: "a", plan_type: "per_service", last_payment_at: "2026-09-19T00:00:00Z" },
    { id: "b", plan_type: "per_service", created_at: "2026-09-17T00:00:00Z" },
    { id: "test", plan_type: "per_service", is_test: true },
  ]);

  assert.equal(balances.get("a").amountUsd, 0.1);
  assert.equal(balances.get("b").amountUsd, 0.25);
  assert.equal(balances.has("test"), false);
});

test("approved payment starts the next period at submission, including review-time orders", async () => {
  const supabase = mockSupabase([
    { id: "before", store_id: "realza", created_at: "2026-09-05T12:00:00Z", platform_service_fee_usd: 0.1 },
    { id: "review", store_id: "realza", created_at: "2026-09-05T14:00:00Z", platform_service_fee_usd: 0.1 },
    { id: "after", store_id: "realza", created_at: "2026-09-06T12:00:00Z", platform_service_fee_usd: 0.1 },
  ], [{
    id: "paid", store_id: "realza", status: "approved", plan_type: "per_service",
    created_at: "2026-09-05T13:00:00Z",
  }]);
  const balances = await loadServiceFeeBalances(supabase, [{
    id: "realza", plan_type: "per_service", last_payment_at: "2026-09-05T16:00:00Z",
  }]);

  assert.deepEqual(balances.get("realza"), {
    periodStart: "2026-09-05T13:00:00Z",
    serviceCount: 2,
    amountUsd: 0.2,
  });
});
