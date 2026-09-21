import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPeriodSummary, getSummaryPeriod, isSummaryStoreExpired, moveSummaryAnchor } from "../src/lib/admin/summary-period.ts";

test("day, week and month use Caracas boundaries", () => {
  const day = getSummaryPeriod("day", "2026-09-20");
  assert.equal(day.startIso, "2026-09-20T04:00:00.000Z");
  assert.equal(day.endIso, "2026-09-21T04:00:00.000Z");

  const week = getSummaryPeriod("week", "2026-09-20");
  assert.equal(week.startDate, "2026-09-14");
  assert.equal(week.endDate, "2026-09-21");

  const month = getSummaryPeriod("month", "2026-09-20");
  assert.equal(month.startDate, "2026-09-01");
  assert.equal(month.endDate, "2026-10-01");
  assert.equal(moveSummaryAnchor("month", "2026-01-31", 1), "2026-02-28");
});

test("includes cancelled orders in orders and generated fee, but separates collected fee", () => {
  const period = getSummaryPeriod("day", "2026-09-20");
  const orders = [
    { store_id: "a", created_at: "2026-09-20T04:15:00Z", status: "cancelled", platform_service_fee_usd: 0.1, customer_phone_normalized: "584121111111", customer_id: "ca" },
    { store_id: "a", created_at: "2026-09-20T05:15:00Z", status: "pending", platform_service_fee_usd: 0.1, customer_phone_normalized: "584121111111", customer_id: "ca" },
    { store_id: "b", created_at: "2026-09-20T06:15:00Z", status: "completed", platform_service_fee_usd: 0.1, customer_phone_normalized: "584121111111", customer_id: "cb" },
    { store_id: "b", created_at: "2026-09-20T07:15:00Z", status: "completed", platform_service_fee_usd: 0.1, customer_phone_normalized: "584129999999", customer_id: "cc" },
  ];
  const result = buildPeriodSummary(period, orders, [
    { store_id: "a", amount_usd: 4.8 },
    { store_id: "b", amount_usd: 1.2 },
  ], new Map([["a", "A"], ["b", "B"]]));

  assert.equal(result.orders, 4);
  assert.equal(result.cancelledOrders, 1);
  assert.equal(result.feeGeneratedUsd, 0.4);
  assert.equal(result.feeCollectedUsd, 6);
  assert.equal(result.uniqueCustomers, 2);
  assert.equal(result.frequentCustomers, 1);
  assert.deepEqual(result.ordersRanking.map((row) => [row.storeName, row.value]), [["A", 2], ["B", 2]]);
  assert.deepEqual(result.feeRanking.map((row) => [row.storeName, row.value]), [["A", 4.8], ["B", 1.2]]);
  assert.equal(result.series[0].orders, 1);
  assert.equal(result.series.reduce((sum, point) => sum + point.orders, 0), 4);
});

test("period filters handle midnight, week rollover, leap year and month navigation", () => {
  assert.deepEqual(
    ["2026-09-20T03:59:59Z", "2026-09-20T04:00:00Z", "2026-09-21T03:59:59Z", "2026-09-21T04:00:00Z"]
      .map((value) => {
        const time = new Date(value).getTime();
        const period = getSummaryPeriod("day", "2026-09-20");
        return time >= Date.parse(period.startIso) && time < Date.parse(period.endIso);
      }),
    [false, true, true, false]
  );
  assert.equal(getSummaryPeriod("week", "2027-01-01").startDate, "2026-12-28");
  assert.equal(getSummaryPeriod("month", "2028-02-29").endDate, "2028-03-01");
  assert.equal(moveSummaryAnchor("month", "2026-12-31", 1), "2027-01-31");
  assert.equal(moveSummaryAnchor("week", "2026-12-30", 1), "2027-01-06");
});

test("rankings and series use the selected period's supplied records", () => {
  for (const mode of ["day", "week", "month"]) {
    const period = getSummaryPeriod(mode, "2026-09-20");
    const orders = [
      { store_id: "a", created_at: period.startIso, status: "cancelled", platform_service_fee_usd: 0.25, customer_phone_normalized: "584121111111", customer_id: "c1" },
      { store_id: "a", created_at: period.startIso, status: "completed", platform_service_fee_usd: 0.25, customer_phone_normalized: "584121111111", customer_id: "c1" },
      { store_id: "a", created_at: period.startIso, status: "completed", platform_service_fee_usd: 0.25, customer_phone_normalized: "584121111111", customer_id: "c1" },
      { store_id: "b", created_at: period.startIso, status: "completed", platform_service_fee_usd: 0.5, customer_phone_normalized: null, customer_id: "c2" },
    ];
    const result = buildPeriodSummary(period, orders, [
      { store_id: "b", amount_usd: 1.25 },
      { store_id: "a", amount_usd: 0.25 },
    ], new Map([["a", "A"], ["b", "B"]]));
    assert.equal(result.orders, 4);
    assert.equal(result.cancelledOrders, 1);
    assert.equal(result.feeGeneratedUsd, 1.25);
    assert.equal(result.feeCollectedUsd, 1.5);
    assert.equal(result.uniqueCustomers, 2);
    assert.equal(result.frequentCustomers, 1);
    assert.deepEqual(result.ordersRanking.map((row) => row.storeName), ["A", "B"]);
    assert.deepEqual(result.feeRanking.map((row) => row.storeName), ["B", "A"]);
    assert.equal(result.series.reduce((sum, point) => sum + point.orders, 0), result.orders);
    assert.equal(result.series.reduce((sum, point) => sum + point.feeGeneratedUsd, 0), result.feeGeneratedUsd);
  }
});

test("expired stores do not inherit an old trial date after changing plans", () => {
  const now = new Date("2026-09-20T16:00:00Z");
  assert.equal(isSummaryStoreExpired({ plan_type: "per_service", subscription_status: "active", trial_ends_at: "2026-08-01" }, now), false);
  assert.equal(isSummaryStoreExpired({ plan_type: "trial", subscription_status: "trial", trial_ends_at: "2026-09-19" }, now), true);
  assert.equal(isSummaryStoreExpired({ plan_type: "monthly", subscription_status: "active", next_payment_due_at: "2026-09-19" }, now), true);
  assert.equal(isSummaryStoreExpired({ plan_type: "monthly", subscription_status: "active", next_payment_due_at: "2026-09-20" }, now), false);
  assert.equal(isSummaryStoreExpired({ plan_type: "monthly", subscription_status: "paused", next_payment_due_at: "2026-09-19" }, now), false);
});
