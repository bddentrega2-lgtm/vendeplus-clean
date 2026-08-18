import type { StoreDeliverySettings } from "@/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { normalizePublicBrandText } from "@/lib/brand-copy";
import { isTransportConnectionEnded } from "@/lib/transport/disengagement";
import {
  addVenezuelaDays,
  getVenezuelaDateKey,
  getVenezuelaDayRange,
} from "@/lib/time/venezuela";

export type TransportAgencyPricingType = "flat" | "zones" | "distance_ranges" | "manual";
export type TransportAgencyStatus = "pending" | "active" | "paused" | "rejected";
export type TransportAgencyModality = "open" | "exclusive" | "mixed";
export type TransportAgencyRatesVisibility = "public" | "private";
export type PublicTransportAgencyLogo = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  coverageNotes: string | null;
  logoUrl: string;
  initials: string;
};

function getTransportInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function cleanTransportText(value: unknown, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

export function transportMoney(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export async function getPublicTransportAgencyLogos(
  limit = 10
): Promise<PublicTransportAgencyLogo[]> {
  const supabase = createSupabasePublicClient() || createSupabaseAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("transport_agencies")
    .select("id, name, slug, city, state, coverage_notes, logo_url")
    .eq("status", "active")
    .eq("is_active", true)
    .not("logo_url", "is", null)
    .order("name", { ascending: true })
    .limit(limit);

  if (error || !data?.length) {
    if (error) {
      console.warn("Could not load public transport agency logos:", error.message);
    }
    try {
      const admin = createSupabaseAdminClient();
      const fallback = await admin
        .from("transport_agencies")
        .select("id, name, slug, city, state, coverage_notes, logo_url")
        .eq("status", "active")
        .eq("is_active", true)
        .not("logo_url", "is", null)
        .order("name", { ascending: true })
        .limit(limit);

      if (fallback.error || !fallback.data?.length) return [];
      return mapPublicTransportAgencyLogos(fallback.data);
    } catch {
      return [];
    }
  }

  return mapPublicTransportAgencyLogos(data);
}

function mapPublicTransportAgencyLogos(data: any[]): PublicTransportAgencyLogo[] {
  return data
    .filter((agency) => agency.name && agency.slug && agency.logo_url)
    .map((agency) => ({
      id: String(agency.id),
      name: String(agency.name),
      slug: String(agency.slug),
      city: agency.city || null,
      state: agency.state || null,
      coverageNotes: normalizePublicBrandText(agency.coverage_notes) || null,
      logoUrl: String(agency.logo_url),
      initials: getTransportInitials(String(agency.name)),
    }));
}

export async function getEntrega2AppBrand() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("transport_agencies")
      .select("id, name, slug, logo_url")
      .eq("status", "active")
      .eq("is_active", true)
      .or("slug.eq.entrega2,name.ilike.%Entrega2%")
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!data?.logo_url) return null;

    return {
      id: String(data.id),
      name: "Entrega2 App",
      slug: String(data.slug || "entrega2"),
      logoUrl: String(data.logo_url),
    };
  } catch {
    return null;
  }
}

export function optionalTransportNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

export function slugifyTransportAgency(value: string) {
  const base = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return base || `agencia-${Date.now()}`;
}

function normalizePricingType(value: unknown): TransportAgencyPricingType {
  return ["flat", "zones", "distance_ranges", "manual"].includes(String(value))
    ? (String(value) as TransportAgencyPricingType)
    : "flat";
}

export function normalizeAgencyModality(value: unknown): TransportAgencyModality {
  return ["open", "exclusive", "mixed"].includes(String(value))
    ? (String(value) as TransportAgencyModality)
    : "open";
}

export function normalizeAgencyStatus(value: unknown): TransportAgencyStatus {
  return ["pending", "active", "paused", "rejected"].includes(String(value))
    ? (String(value) as TransportAgencyStatus)
    : "pending";
}

export function normalizeRatesVisibility(value: unknown): TransportAgencyRatesVisibility {
  return ["public", "private"].includes(String(value))
    ? (String(value) as TransportAgencyRatesVisibility)
    : "public";
}

export function getTransportAgencyRateFromRelation(relation: any) {
  if (Array.isArray(relation)) return relation[0] || null;
  return relation || null;
}

export function getTransportAgencyConfigIssues(params: {
  agency: any;
  rate?: any | null;
  zones?: any[] | null;
  distanceRates?: any[] | null;
}) {
  const agency = params.agency || {};
  const rate = params.rate || {};
  const zones = (params.zones || []).filter((zone: any) => zone?.is_active !== false);
  const distanceRates = (params.distanceRates || []).filter(
    (entry: any) => entry?.is_active !== false
  );
  const pricingType = normalizePricingType(agency.pricing_type);
  const issues: string[] = [];

  if (!cleanTransportText(agency.name, 140)) issues.push("Nombre comercial");
  if (!cleanTransportText(agency.contact_name, 120)) issues.push("Responsable");
  if (!cleanTransportText(agency.contact_email, 180).includes("@")) issues.push("Correo valido");
  if (!cleanTransportText(agency.contact_phone || agency.whatsapp_phone, 40)) {
    issues.push("Telefono o WhatsApp");
  }
  if (!cleanTransportText(agency.city, 80)) issues.push("Ciudad base");

  const maxDistanceKm = optionalTransportNumber(rate.max_distance_km);
  if (!maxDistanceKm || maxDistanceKm <= 0) issues.push("KM maximo de cobertura");

  if (pricingType === "flat" && transportMoney(rate.flat_fee_usd) <= 0) {
    issues.push("Tarifa plana mayor a 0");
  }

  if (pricingType === "zones" && zones.length === 0) {
    issues.push("Al menos una zona activa");
  }

  if (pricingType === "distance_ranges" && distanceRates.length === 0) {
    issues.push("Al menos un rango de kilometros");
  }

  if (pricingType === "manual" && !cleanTransportText(rate.manual_quote_message, 260)) {
    issues.push("Mensaje de cotizacion");
  }

  return issues;
}

export function isTransportAgencyReady(params: {
  agency: any;
  rate?: any | null;
  zones?: any[] | null;
  distanceRates?: any[] | null;
}) {
  const agency = params.agency || {};
  return (
    agency.status === "active" &&
    agency.is_active !== false &&
    getTransportAgencyConfigIssues(params).length === 0
  );
}

export function mapTransportAgencyDeliverySettings(params: {
  agency: any;
  rate?: any | null;
  zones?: any[];
  distanceRates?: any[];
  connectionId?: string | null;
  pickupEnabled?: boolean;
  promoSettings?: Partial<StoreDeliverySettings> | null;
}): StoreDeliverySettings {
  const agency = params.agency || {};
  const rate = params.rate || {};
  const promoSettings = params.promoSettings || {};
  const pricingType = normalizePricingType(agency.pricing_type);
  const manualMessage =
    cleanTransportText(rate.manual_quote_message, 280) ||
    `El delivery lo confirma ${agency.name || "la empresa delivery"} por WhatsApp.`;

  return {
    deliveryEnabled: agency.status === "active" && agency.is_active !== false,
    pickupEnabled: params.pickupEnabled !== false,
    nationalShippingEnabled: promoSettings.nationalShippingEnabled === true,
    deliveryProvider: "transport_agency",
    pricingType:
      pricingType === "flat"
        ? "fixed_distance"
        : pricingType === "manual"
          ? "manual"
          : pricingType,
    fixedFeeUsd: transportMoney(rate.flat_fee_usd),
    freeDeliveryMinUsd: promoSettings.freeDeliveryMinUsd ?? null,
    deliveryPromoEnabled: Boolean(promoSettings.deliveryPromoEnabled),
    deliveryPromoMinSubtotalUsd: promoSettings.deliveryPromoMinSubtotalUsd ?? null,
    deliveryPromoDiscountType: promoSettings.deliveryPromoDiscountType || "free",
    deliveryPromoDiscountValue: promoSettings.deliveryPromoDiscountValue || 0,
    maxDistanceKm: optionalTransportNumber(rate.max_distance_km),
    distanceFactor: optionalTransportNumber(rate.distance_factor_usd),
    manualQuoteMessage: manualMessage,
    zones: (params.zones || [])
      .map((zone) => ({
        id: String(zone.id),
        name: cleanTransportText(zone.name, 120) || "Zona",
        description: cleanTransportText(zone.description, 200),
        feeUsd: transportMoney(zone.fee_usd),
        isActive: zone.is_active !== false,
        sortOrder: Number(zone.sort_order || 0),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    distanceRates: (params.distanceRates || [])
      .map((entry) => ({
        id: String(entry.id),
        minKm: transportMoney(entry.min_km),
        maxKm: optionalTransportNumber(entry.max_km),
        feeUsd: transportMoney(entry.fee_usd),
        isActive: entry.is_active !== false,
        sortOrder: Number(entry.sort_order || 0),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    transportAgencyConnectionId: params.connectionId || null,
    transportAgencyId: agency.id ? String(agency.id) : null,
    transportAgencyName: agency.name || null,
    transportAgencyLogoUrl: agency.logo_url || null,
  };
}

export async function loadTransportAgencyDeliverySettingsBySlug(
  supabase: any,
  agencySlug: string,
  options?: {
    pickupEnabled?: boolean;
    promoSettings?: Partial<StoreDeliverySettings> | null;
  }
) {
  const { data: agency, error: agencyError } = await supabase
    .from("transport_agencies")
    .select("*")
    .eq("slug", agencySlug)
    .eq("status", "active")
    .eq("is_active", true)
    .maybeSingle();

  if (agencyError || !agency?.id) return null;

  const [rateResult, zonesResult, distanceRatesResult] = await Promise.all([
    supabase
      .from("transport_agency_rates")
      .select("*")
      .eq("agency_id", agency.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("transport_agency_zones")
      .select("*")
      .eq("agency_id", agency.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("transport_agency_distance_rates")
      .select("*")
      .eq("agency_id", agency.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (rateResult.error || zonesResult.error || distanceRatesResult.error) {
    return null;
  }

  const configuration = {
    agency,
    rate: rateResult.data,
    zones: zonesResult.data || [],
    distanceRates: distanceRatesResult.data || [],
  };

  if (!isTransportAgencyReady(configuration)) return null;

  return {
    ...configuration,
    settings: mapTransportAgencyDeliverySettings({
      ...configuration,
      pickupEnabled: options?.pickupEnabled,
      promoSettings: options?.promoSettings,
    }),
  };
}

export async function loadTransportAgencyDeliverySettings(
  supabase: any,
  storeId: string,
  pickupEnabled = true
) {
  const { data: connection, error: connectionError } = await supabase
    .from("store_transport_agency_connections")
    .select(
      "id, store_id, agency_id, status, is_default, is_exclusive, disengagement_requested_at, disengagement_confirmed_at, disengagement_effective_at"
    )
    .eq("store_id", storeId)
    .eq("status", "active")
    .eq("is_default", true)
    .maybeSingle();

  if (connectionError || !connection?.agency_id) return null;
  if (isTransportConnectionEnded(connection)) return null;

  const [agencyResult, rateResult, zonesResult, distanceRatesResult, settingsResult] =
    await Promise.all([
      supabase
        .from("transport_agencies")
        .select("*")
        .eq("id", connection.agency_id)
        .maybeSingle(),
      supabase
        .from("transport_agency_rates")
        .select("*")
        .eq("agency_id", connection.agency_id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("transport_agency_zones")
        .select("*")
        .eq("agency_id", connection.agency_id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("transport_agency_distance_rates")
        .select("*")
        .eq("agency_id", connection.agency_id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("store_delivery_settings")
        .select(
          "free_delivery_min_usd, delivery_promo_enabled, delivery_promo_min_subtotal_usd, delivery_promo_discount_type, delivery_promo_discount_value"
        )
        .eq("store_id", storeId)
        .maybeSingle(),
    ]);

  if (
    agencyResult.error ||
    rateResult.error ||
    zonesResult.error ||
    distanceRatesResult.error ||
    settingsResult.error ||
    !agencyResult.data
  ) {
    return null;
  }
  if (agencyResult.data.status !== "active" || agencyResult.data.is_active === false) return null;
  if (
    !isTransportAgencyReady({
      agency: agencyResult.data,
      rate: rateResult.data,
      zones: zonesResult.data || [],
      distanceRates: distanceRatesResult.data || [],
    })
  ) {
    return null;
  }

  return {
    connection,
    agency: agencyResult.data,
    rate: rateResult.data,
    zones: zonesResult.data || [],
    distanceRates: distanceRatesResult.data || [],
    settings: mapTransportAgencyDeliverySettings({
      agency: agencyResult.data,
      rate: rateResult.data,
      zones: zonesResult.data || [],
      distanceRates: distanceRatesResult.data || [],
      connectionId: connection.id,
      pickupEnabled,
      promoSettings: {
        freeDeliveryMinUsd:
          optionalTransportNumber(settingsResult.data?.free_delivery_min_usd) ??
          optionalTransportNumber(settingsResult.data?.delivery_promo_min_subtotal_usd),
        deliveryPromoEnabled: Boolean(settingsResult.data?.delivery_promo_enabled),
        deliveryPromoMinSubtotalUsd:
          optionalTransportNumber(settingsResult.data?.delivery_promo_min_subtotal_usd) ??
          optionalTransportNumber(settingsResult.data?.free_delivery_min_usd),
        deliveryPromoDiscountType: ["free", "amount", "percent"].includes(
          String(settingsResult.data?.delivery_promo_discount_type)
        )
          ? settingsResult.data?.delivery_promo_discount_type
          : "free",
        deliveryPromoDiscountValue: transportMoney(settingsResult.data?.delivery_promo_discount_value),
      },
    }),
  };
}

export function getCurrentWeekRange(now = new Date()) {
  const start = new Date(now);
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diff);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    endDate: new Date(end.getTime() - 1).toISOString().slice(0, 10),
  };
}

export type TransportBillingRangeKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "custom";

export function getTransportBillingRange(
  searchParams: URLSearchParams,
  now = new Date()
) {
  const requestedRange = searchParams.get("range") || "this_week";
  const range: TransportBillingRangeKey = [
    "today",
    "yesterday",
    "this_week",
    "last_week",
    "custom",
  ].includes(requestedRange)
    ? (requestedRange as TransportBillingRangeKey)
    : "this_week";
  const today = getVenezuelaDayRange(now);
  const todayDay = today.start.getUTCDay();
  const mondayOffset = todayDay === 0 ? -6 : 1 - todayDay;
  const thisWeekStart = addVenezuelaDays(today.start, mondayOffset);

  let start = thisWeekStart;
  let endExclusive = addVenezuelaDays(thisWeekStart, 7);

  if (range === "today") {
    start = today.start;
    endExclusive = addVenezuelaDays(today.start, 1);
  }

  if (range === "yesterday") {
    start = addVenezuelaDays(today.start, -1);
    endExclusive = today.start;
  }

  if (range === "last_week") {
    start = addVenezuelaDays(thisWeekStart, -7);
    endExclusive = thisWeekStart;
  }

  if (range === "custom") {
    const fallbackStart = addVenezuelaDays(today.start, -6);
    const startDate = cleanTransportText(searchParams.get("start"), 20);
    const endDate = cleanTransportText(searchParams.get("end"), 20);
    start = startDate ? getVenezuelaDayRange(startDate).start : fallbackStart;
    endExclusive = endDate
      ? addVenezuelaDays(getVenezuelaDayRange(endDate).start, 1)
      : addVenezuelaDays(today.start, 1);

    if (endExclusive <= start) {
      endExclusive = addVenezuelaDays(start, 1);
    }
  }

  const endInclusive = new Date(endExclusive.getTime() - 1);

  return {
    key: range,
    start: start.toISOString(),
    end: endExclusive.toISOString(),
    startDate: getVenezuelaDateKey(start),
    endDate: getVenezuelaDateKey(endInclusive),
  };
}
