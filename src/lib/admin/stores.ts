import { PER_SERVICE_FEE_USD } from "@/lib/plans";

export const adminStoreSelect = `
  id,
  slug,
  name,
  description,
  business_type,
  whatsapp,
  address,
  latitude,
  longitude,
  cover_image_url,
  logo_url,
  opening_hours,
  delivery_estimate,
  pickup_estimate,
  payment_methods,
  usd_to_bs,
  whatsapp_message_note,
  primary_color,
  accent_color,
  button_text_color,
  accepts_delivery,
  accepts_pickup,
  is_active,
  plan_type,
  service_fee_payer,
  service_fee_billing_cycle,
  trial_started_at,
  trial_ends_at,
  subscription_status,
  subscription_started_at,
  subscription_ends_at,
  next_payment_due_at,
  monthly_price_usd,
  billing_notes,
  last_payment_at,
  created_at
`;

function cleanText(value: unknown) {
  return String(value || "").trim();
}

export function slugifyStore(value: string) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function optionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function yesterdayIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function normalizePastDueDates<
  T extends {
    plan_type: string;
    subscription_status: string;
    trial_ends_at: string | null;
    subscription_ends_at: string | null;
    next_payment_due_at: string | null;
  }
>(payload: T): T {
  if (!["past_due", "expired"].includes(payload.subscription_status)) return payload;

  const yesterday = yesterdayIsoDate();
  const fallbackCutoff =
    payload.next_payment_due_at || payload.subscription_ends_at || payload.trial_ends_at || yesterday;

  return {
    ...payload,
    trial_ends_at:
      payload.plan_type === "trial" ? payload.trial_ends_at || fallbackCutoff : payload.trial_ends_at,
    subscription_ends_at:
      payload.plan_type === "monthly" || payload.plan_type === "per_service"
        ? payload.subscription_ends_at || fallbackCutoff
        : payload.subscription_ends_at,
    next_payment_due_at: payload.next_payment_due_at || fallbackCutoff,
  };
}

export function normalizeAdminDeliverySettingsPayload(body: any) {
  const provider = ["own_delivery", "entrega2", "manual_quote", "transport_agency", "disabled"].includes(
    cleanText(body.admin_delivery_provider)
  )
    ? cleanText(body.admin_delivery_provider)
    : "";

  if (!provider) return null;

  const deliveryEnabled = provider !== "disabled" && body.admin_delivery_enabled !== false;
  const pickupEnabled = body.admin_pickup_enabled !== false;

  return {
    delivery_enabled: deliveryEnabled,
    pickup_enabled: pickupEnabled,
    delivery_provider: provider,
    pricing_type:
      provider === "entrega2"
        ? "manual"
        : provider === "manual_quote"
          ? "manual"
          : provider === "disabled"
            ? "manual"
            : "distance_ranges",
    fixed_fee_usd: 0,
    transport_agency_connection_id: null,
    transport_agency_id: null,
  };
}

function normalizePaymentMethods(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function normalizeAdminStorePayload(body: any) {
  const name = cleanText(body.name);
  const slug = slugifyStore(body.slug || name);
  const planType = [
    "trial",
    "monthly",
    "per_service",
    "emprendedor",
    "visionario",
    "founder",
  ].includes(cleanText(body.plan_type))
    ? cleanText(body.plan_type)
    : "trial";
  const subscriptionStatus = ["trial", "active", "past_due", "paused", "cancelled", "expired"].includes(
    cleanText(body.subscription_status)
  )
    ? cleanText(body.subscription_status)
    : planType === "trial"
      ? "trial"
      : "active";

  return normalizePastDueDates({
    slug,
    name,
    description: cleanText(body.description) || null,
    business_type: cleanText(body.business_type) || "general",
    whatsapp: cleanText(body.whatsapp).replace(/[^0-9]/g, "") || null,
    address: cleanText(body.address) || null,
    latitude: optionalNumber(body.latitude),
    longitude: optionalNumber(body.longitude),
    cover_image_url: cleanText(body.cover_image_url) || null,
    logo_url: cleanText(body.logo_url) || null,
    opening_hours: cleanText(body.opening_hours) || "Disponible hoy",
    delivery_estimate: cleanText(body.delivery_estimate) || "25-40 min",
    pickup_estimate: cleanText(body.pickup_estimate) || "15-25 min",
    payment_methods: normalizePaymentMethods(body.payment_methods),
    usd_to_bs: Number(body.usd_to_bs || 600),
    whatsapp_message_note: cleanText(body.whatsapp_message_note) || null,
    primary_color: cleanText(body.primary_color) || "#2E3A79",
    accent_color: cleanText(body.accent_color) || "#FFB547",
    button_text_color: cleanText(body.button_text_color) || "#25262B",
    accepts_delivery: body.accepts_delivery === true,
    accepts_pickup: body.accepts_pickup !== false,
    is_active: body.is_active !== false,
    plan_type: planType,
    service_fee_payer: body.service_fee_payer === "customer" ? "customer" : "merchant",
    service_fee_billing_cycle: "monthly",
    trial_started_at: cleanText(body.trial_started_at) || null,
    trial_ends_at: cleanText(body.trial_ends_at) || null,
    subscription_status: subscriptionStatus,
    subscription_started_at: cleanText(body.subscription_started_at) || null,
    subscription_ends_at: cleanText(body.subscription_ends_at) || null,
    next_payment_due_at: cleanText(body.next_payment_due_at) || null,
    monthly_price_usd: Math.max(
      0,
      Number(
        body.monthly_price_usd ||
          (planType === "monthly" ? 20 : planType === "per_service" ? PER_SERVICE_FEE_USD : 0)
      )
    ),
    billing_notes: cleanText(body.billing_notes) || null,
    last_payment_at: cleanText(body.last_payment_at) || null,
  });
}

export function normalizeAdminSubscriptionPayload(body: any) {
  const planType = [
    "trial",
    "monthly",
    "per_service",
    "emprendedor",
    "visionario",
    "founder",
  ].includes(cleanText(body.plan_type))
    ? cleanText(body.plan_type)
    : "trial";
  const subscriptionStatus = ["trial", "active", "past_due", "paused", "cancelled", "expired"].includes(
    cleanText(body.subscription_status)
  )
    ? cleanText(body.subscription_status)
    : "trial";

  return normalizePastDueDates({
    plan_type: planType,
    service_fee_payer: body.service_fee_payer === "customer" ? "customer" : "merchant",
    service_fee_billing_cycle: "monthly",
    subscription_status: subscriptionStatus,
    trial_started_at: cleanText(body.trial_started_at) || null,
    trial_ends_at: cleanText(body.trial_ends_at) || null,
    subscription_started_at: cleanText(body.subscription_started_at) || null,
    subscription_ends_at: cleanText(body.subscription_ends_at) || null,
    next_payment_due_at: cleanText(body.next_payment_due_at) || null,
    monthly_price_usd: Math.max(
      0,
      Number(
        body.monthly_price_usd ||
          (planType === "monthly" ? 20 : planType === "per_service" ? PER_SERVICE_FEE_USD : 0)
      )
    ),
    billing_notes: cleanText(body.billing_notes) || null,
    last_payment_at: cleanText(body.last_payment_at) || null,
  });
}
