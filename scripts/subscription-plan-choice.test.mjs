import assert from "node:assert/strict";
import test from "node:test";
import { canSelfActivatePerServicePlan } from "../src/lib/subscription-plan-choice.ts";

test("only trial stores can self-activate the public per-service plan", () => {
  assert.equal(canSelfActivatePerServicePlan({ plan_type: "trial", subscription_status: "trial" }), true);
  assert.equal(canSelfActivatePerServicePlan({ plan_type: "monthly", subscription_status: "active" }), false);
  assert.equal(canSelfActivatePerServicePlan({ plan_type: "monthly", subscription_status: "past_due" }), false);
  assert.equal(canSelfActivatePerServicePlan({ plan_type: "per_service", subscription_status: "active" }), false);
});

test("the subscription screen defaults an expired trial to the recommended customer payer", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../src/components/panel/SubscriptionPaymentManager.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /useState<"merchant" \| "customer">\("customer"\)/);
  assert.match(source, /needsPlanChoice\s*\?\s*"customer"/);
});
