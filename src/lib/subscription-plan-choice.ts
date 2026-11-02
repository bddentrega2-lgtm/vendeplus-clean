type StorePlanState = {
  plan_type?: string | null;
  subscription_status?: string | null;
};

export function canSelfActivatePerServicePlan(store?: StorePlanState | null) {
  return store?.plan_type === "trial" || store?.subscription_status === "trial";
}
