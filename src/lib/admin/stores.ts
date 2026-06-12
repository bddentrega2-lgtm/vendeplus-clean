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

  return {
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
    accepts_delivery: body.accepts_delivery !== false,
    accepts_pickup: body.accepts_pickup !== false,
    is_active: body.is_active !== false,
  };
}
