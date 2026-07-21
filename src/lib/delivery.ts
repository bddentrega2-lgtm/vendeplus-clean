import type {
  DeliveryPricingType,
  DeliveryProvider,
  DeliveryQuote,
  StoreDeliverySettings,
} from "@/types";

const EARTH_RADIUS_KM = 6371;
const DEFAULT_MANUAL_DELIVERY_MESSAGE =
  "Confirma el precio de tu delivery por WhatsApp con el comercio.";

export function haversineDistanceKm(
  originLat: number,
  originLng: number,
  destinationLat: number,
  destinationLng: number,
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(destinationLat - originLat);
  const dLng = toRad(destinationLng - originLng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(originLat)) *
      Math.cos(toRad(destinationLat)) *
      Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateDeliveryFee(distanceKm: number): number {
  if (distanceKm <= 1) return 1;
  if (distanceKm <= 3) return 2;
  if (distanceKm <= 7) return 3;
  if (distanceKm <= 10) return 4;
  return Number((4 + (distanceKm - 10) * 0.5).toFixed(2));
}

export function buildDeliveryQuote(distanceKm: number | null, source: DeliveryQuote["source"]): DeliveryQuote {
  if (distanceKm === null) {
    return {
      distanceKm: null,
      feeUsd: 0,
      label: "Pendiente por calcular",
      source: "pending",
      available: true,
    };
  }

  const rounded = Number(distanceKm.toFixed(2));

  return {
    distanceKm: rounded,
    feeUsd: calculateDeliveryFee(rounded),
    label: `${rounded.toFixed(2)} km estimados`,
    source,
    available: true,
  };
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeProvider(value: unknown): DeliveryProvider {
  return ["own_delivery", "entrega2", "manual_quote", "transport_agency", "disabled"].includes(String(value))
    ? (String(value) as DeliveryProvider)
    : "own_delivery";
}

function normalizePricingType(value: unknown): DeliveryPricingType {
  if (String(value) === "fixed") return "fixed_distance";

  return ["fixed_distance", "distance_ranges", "zones", "free_over_amount", "manual"].includes(String(value))
    ? (String(value) as DeliveryPricingType)
    : "manual";
}

export function createDefaultDeliverySettings(): StoreDeliverySettings {
  return {
    deliveryEnabled: false,
    pickupEnabled: true,
    deliveryProvider: "disabled",
    pricingType: "manual",
    fixedFeeUsd: 0,
    freeDeliveryMinUsd: null,
    deliveryPromoEnabled: false,
    deliveryPromoMinSubtotalUsd: null,
    deliveryPromoDiscountType: "free",
    deliveryPromoDiscountValue: 0,
    maxDistanceKm: null,
    distanceFactor: null,
    manualQuoteMessage: DEFAULT_MANUAL_DELIVERY_MESSAGE,
    zones: [],
    distanceRates: [],
    transportAgencyLogoUrl: null,
  };
}

export function mapStoreDeliverySettings(row: any): StoreDeliverySettings {
  const fallback = createDefaultDeliverySettings();
  const settingsRows = Array.isArray(row?.store_delivery_settings)
    ? row.store_delivery_settings
    : [];
  const hasSettings = settingsRows.length > 0;
  const settings = settingsRows[0] || {};
  const legacyDeliveryEnabled =
    typeof row?.accepts_delivery === "boolean"
      ? row.accepts_delivery
      : fallback.deliveryEnabled;
  const legacyPickupEnabled =
    typeof row?.accepts_pickup === "boolean"
      ? row.accepts_pickup
      : fallback.pickupEnabled;
  const settingsDeliveryEnabled =
    typeof settings.delivery_enabled === "boolean"
      ? settings.delivery_enabled
      : legacyDeliveryEnabled;
  const settingsPickupEnabled =
    typeof settings.pickup_enabled === "boolean"
      ? settings.pickup_enabled
      : legacyPickupEnabled;
  const settingsDisabledBoth =
    hasSettings && settingsDeliveryEnabled === false && settingsPickupEnabled === false;
  const deliveryEnabled = hasSettings
    ? settingsDisabledBoth && legacyDeliveryEnabled
      ? true
      : settingsDeliveryEnabled
    : legacyDeliveryEnabled;
  const pickupEnabled = hasSettings
    ? settingsDisabledBoth && legacyPickupEnabled
      ? true
      : settingsPickupEnabled
    : legacyPickupEnabled;
  const legacyPromoMin = optionalNumber(settings.free_delivery_min_usd);
  const promoEnabled = settings.delivery_promo_enabled ?? (legacyPromoMin !== null && legacyPromoMin > 0);
  const promoMin = optionalNumber(settings.delivery_promo_min_subtotal_usd) ?? legacyPromoMin;
  const promoType = ["free", "amount", "percent"].includes(String(settings.delivery_promo_discount_type))
    ? String(settings.delivery_promo_discount_type)
    : "free";
  const rawProvider = normalizeProvider(settings.delivery_provider || "own_delivery");
  const normalizedProvider = deliveryEnabled
    ? rawProvider === "disabled"
      ? "own_delivery"
      : rawProvider
    : "disabled";
  const zones = (Array.isArray(row?.store_delivery_zones) ? row.store_delivery_zones : [])
    .map((zone: any) => ({
      id: String(zone.id),
      name: String(zone.name || "Zona"),
      description: String(zone.description || ""),
      feeUsd: Math.max(0, toNumber(zone.fee_usd, 0)),
      isActive: zone.is_active !== false,
      sortOrder: toNumber(zone.sort_order, 0),
    }))
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  const distanceRates = (Array.isArray(row?.store_delivery_distance_rates)
    ? row.store_delivery_distance_rates
    : []
  )
    .map((rate: any) => ({
      id: String(rate.id),
      minKm: Math.max(0, toNumber(rate.min_km, 0)),
      maxKm: optionalNumber(rate.max_km),
      feeUsd: Math.max(0, toNumber(rate.fee_usd, 0)),
      isActive: rate.is_active !== false,
      sortOrder: toNumber(rate.sort_order, 0),
    }))
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  const normalizedPricingType = normalizePricingType(settings.pricing_type);
  const inferredPricingType =
    normalizedProvider === "entrega2" ||
    normalizedProvider === "manual_quote" ||
    normalizedProvider === "disabled"
      ? "manual"
      : normalizedPricingType === "manual" || normalizedPricingType === "free_over_amount"
        ? zones.some((zone: any) => zone.isActive)
          ? "zones"
          : distanceRates.some((rate: any) => rate.isActive)
            ? "distance_ranges"
            : optionalNumber(settings.fixed_fee_usd) !== null && toNumber(settings.fixed_fee_usd, 0) > 0
              ? "fixed_distance"
              : normalizedPricingType
        : normalizedPricingType;

  return {
    deliveryEnabled,
    pickupEnabled,
    deliveryProvider: normalizedProvider,
    pricingType: deliveryEnabled ? inferredPricingType : "manual",
    fixedFeeUsd: Math.max(0, toNumber(settings.fixed_fee_usd, fallback.fixedFeeUsd)),
    freeDeliveryMinUsd: legacyPromoMin,
    deliveryPromoEnabled: Boolean(promoEnabled),
    deliveryPromoMinSubtotalUsd: promoMin,
    deliveryPromoDiscountType: promoType as StoreDeliverySettings["deliveryPromoDiscountType"],
    deliveryPromoDiscountValue: Math.max(0, toNumber(settings.delivery_promo_discount_value, 0)),
    maxDistanceKm: optionalNumber(settings.max_distance_km),
    distanceFactor: null,
    manualQuoteMessage:
      String(settings.manual_quote_message || "").trim() ||
      DEFAULT_MANUAL_DELIVERY_MESSAGE,
    zones,
    distanceRates,
    transportAgencyConnectionId: settings.transport_agency_connection_id || null,
    transportAgencyId: settings.transport_agency_id || null,
  };
}

export function disableUnavailableTransportAgencySettings(
  settings: StoreDeliverySettings
): StoreDeliverySettings {
  if (settings.deliveryProvider !== "transport_agency") return settings;

  return {
    ...settings,
    deliveryEnabled: false,
    deliveryProvider: "disabled",
    pricingType: "manual",
    fixedFeeUsd: 0,
    freeDeliveryMinUsd: null,
    deliveryPromoEnabled: false,
    deliveryPromoMinSubtotalUsd: null,
    deliveryPromoDiscountValue: 0,
    maxDistanceKm: null,
    distanceFactor: null,
    zones: [],
    distanceRates: [],
    transportAgencyConnectionId: null,
    transportAgencyId: null,
    transportAgencyName: null,
    transportAgencyLogoUrl: null,
  };
}

function applyDeliveryPromo(feeUsd: number, settings: StoreDeliverySettings, subtotalUsd: number) {
  const minSubtotal = settings.deliveryPromoMinSubtotalUsd ?? settings.freeDeliveryMinUsd;
  if (!settings.deliveryPromoEnabled || minSubtotal === null || minSubtotal <= 0 || subtotalUsd < minSubtotal) {
    return { feeUsd, discountUsd: 0 };
  }

  let discountUsd = 0;

  if (settings.deliveryPromoDiscountType === "amount") {
    discountUsd = Math.min(feeUsd, settings.deliveryPromoDiscountValue);
  } else if (settings.deliveryPromoDiscountType === "percent") {
    discountUsd = Math.min(feeUsd, feeUsd * Math.min(100, settings.deliveryPromoDiscountValue) / 100);
  } else {
    discountUsd = feeUsd;
  }

  return {
    feeUsd: Number(Math.max(0, feeUsd - discountUsd).toFixed(2)),
    discountUsd: Number(discountUsd.toFixed(2)),
  };
}

export function calculateDistanceRangeFee(
  distanceKm: number,
  rates: StoreDeliverySettings["distanceRates"],
  distanceFactor: number | null = null
) {
  const activeRates = rates
    .filter((entry) => entry.isActive)
    .sort((a, b) => a.minKm - b.minKm || a.sortOrder - b.sortOrder);

  const matchingRate = activeRates.find(
    (entry) =>
      distanceKm >= entry.minKm &&
      (entry.maxKm === null || distanceKm <= entry.maxKm)
  );
  if (matchingRate) return Number(matchingRate.feeUsd.toFixed(2));

  const finalFiniteRate = [...activeRates]
    .reverse()
    .find((entry) => entry.maxKm !== null);
  if (
    finalFiniteRate?.maxKm !== null &&
    finalFiniteRate?.maxKm !== undefined &&
    distanceFactor !== null &&
    distanceKm > finalFiniteRate.maxKm
  ) {
    return Number(
      (finalFiniteRate.feeUsd + (distanceKm - finalFiniteRate.maxKm) * distanceFactor).toFixed(2)
    );
  }

  return null;
}

export function describeDistanceRangeFee(params: {
  distanceKm: number;
  rates: StoreDeliverySettings["distanceRates"];
  distanceFactor?: number | null;
}) {
  const roundedDistance = Number(params.distanceKm.toFixed(2));
  const activeRates = params.rates
    .filter((entry) => entry.isActive)
    .sort((a, b) => a.minKm - b.minKm || a.sortOrder - b.sortOrder);
  const matchingRate = activeRates.find(
    (entry) =>
      roundedDistance >= entry.minKm &&
      (entry.maxKm === null || roundedDistance <= entry.maxKm)
  );

  if (matchingRate) {
    return {
      feeUsd: Number(matchingRate.feeUsd.toFixed(2)),
      summary:
        matchingRate.maxKm === null
          ? `Rango ${matchingRate.minKm} km en adelante`
          : `Rango ${matchingRate.minKm}-${matchingRate.maxKm} km`,
    };
  }

  const finalFiniteRate = [...activeRates]
    .reverse()
    .find((entry) => entry.maxKm !== null);
  const distanceFactor = params.distanceFactor ?? null;

  if (
    finalFiniteRate?.maxKm !== null &&
    finalFiniteRate?.maxKm !== undefined &&
    distanceFactor !== null &&
    roundedDistance > finalFiniteRate.maxKm
  ) {
    const extraKm = Number((roundedDistance - finalFiniteRate.maxKm).toFixed(2));
    const feeUsd = Number(
      (finalFiniteRate.feeUsd + extraKm * distanceFactor).toFixed(2)
    );

    return {
      feeUsd,
      summary: `Rango final ${finalFiniteRate.minKm}-${finalFiniteRate.maxKm} km + ${extraKm.toFixed(2)} km adicional a $${distanceFactor.toFixed(2)}/km`,
    };
  }

  return null;
}

export function calculateDeliveryQuoteFromSettings(params: {
  settings?: StoreDeliverySettings | null;
  deliveryType: "delivery" | "pickup";
  subtotalUsd: number;
  distanceKm?: number | null;
  zoneId?: string | null;
  source?: DeliveryQuote["source"];
}): DeliveryQuote {
  const settings = params.settings || createDefaultDeliverySettings();
  const source = params.source || "manual";
  const agencyQuoteMeta = {
    transportAgencyId: settings.transportAgencyId || null,
    transportAgencyName: settings.transportAgencyName || null,
    transportAgencyLogoUrl: settings.transportAgencyLogoUrl || null,
  };

  if (params.deliveryType === "pickup") {
    return {
      distanceKm: 0,
      feeUsd: 0,
      label: "Retiro (pick up)",
      source: "pickup",
      available: settings.pickupEnabled,
      provider: settings.deliveryProvider,
      pricingType: settings.pricingType,
      ...agencyQuoteMeta,
    };
  }

  if (!settings.deliveryEnabled || settings.deliveryProvider === "disabled") {
    return {
      distanceKm: null,
      feeUsd: 0,
      label: "Delivery no disponible",
      source: "manual",
      available: false,
      provider: settings.deliveryProvider,
      pricingType: settings.pricingType,
      ...agencyQuoteMeta,
      message: "Este comercio no tiene delivery activo en este momento.",
    };
  }

  if (settings.deliveryProvider === "entrega2") {
    return {
      distanceKm: params.distanceKm ?? null,
      feeUsd: 0,
      label: "Entrega2 App cotiza el delivery",
      source: params.distanceKm === null ? "pending" : source,
      available: true,
      provider: settings.deliveryProvider,
      pricingType: settings.pricingType,
      ...agencyQuoteMeta,
      message: "El delivery se cotiza con Entrega2 App al confirmar el pedido.",
    };
  }

  if (settings.deliveryProvider === "manual_quote" || settings.pricingType === "manual") {
    return {
      distanceKm: params.distanceKm ?? null,
      feeUsd: 0,
      label: "Delivery por confirmar",
      source: "manual",
      available: true,
      provider: settings.deliveryProvider,
      pricingType: settings.pricingType,
      ...agencyQuoteMeta,
      message: settings.manualQuoteMessage,
    };
  }

  if (settings.pricingType === "zones") {
    const activeZones = settings.zones.filter((zone) => zone.isActive);
    const zone = activeZones.find((entry) => entry.id === params.zoneId) || null;

    if (!zone) {
      return {
        distanceKm: params.distanceKm ?? null,
        feeUsd: 0,
        label: activeZones.length ? "Selecciona tu zona" : "Zonas no configuradas",
        source: "pending",
        available: activeZones.length > 0,
        provider: settings.deliveryProvider,
        pricingType: settings.pricingType,
        ...agencyQuoteMeta,
        message: activeZones.length
          ? undefined
          : "Este comercio aún no tiene zonas activas para calcular el delivery.",
      };
    }

    const promo = applyDeliveryPromo(zone.feeUsd, settings, params.subtotalUsd);
    return {
      distanceKm: params.distanceKm ?? null,
      feeUsd: promo.feeUsd,
      originalFeeUsd: zone.feeUsd,
      discountUsd: promo.discountUsd,
      label:
        promo.discountUsd > 0
          ? `${zone.name} - promo delivery -$${promo.discountUsd.toFixed(2)}`
          : `${zone.name} - delivery $${zone.feeUsd.toFixed(2)}`,
      source: "manual",
      available: true,
      provider: settings.deliveryProvider,
      pricingType: settings.pricingType,
      zoneId: zone.id,
      zoneName: zone.name,
      ...agencyQuoteMeta,
    };
  }

  if (settings.pricingType === "fixed_distance") {
    const distanceKm = params.distanceKm ?? null;

    if (distanceKm === null) {
      return {
        distanceKm: null,
        feeUsd: 0,
        label: "Ubicacion pendiente",
        source: "pending",
        available: true,
        provider: settings.deliveryProvider,
        pricingType: settings.pricingType,
        ...agencyQuoteMeta,
        message: "Comparte tu ubicacion para calcular el delivery.",
      };
    }

    const rounded = Number(distanceKm.toFixed(2));
    if (settings.maxDistanceKm !== null && rounded > settings.maxDistanceKm) {
      return {
        distanceKm: rounded,
        feeUsd: 0,
        label: "Fuera del radio de delivery",
        source: "pending",
        available: false,
        provider: settings.deliveryProvider,
        pricingType: settings.pricingType,
        ...agencyQuoteMeta,
        message: `La ubicacion supera el radio configurado de ${settings.maxDistanceKm} km.`,
      };
    }

    const promo = applyDeliveryPromo(settings.fixedFeeUsd, settings, params.subtotalUsd);
    return {
      distanceKm: rounded,
      feeUsd: promo.feeUsd,
      originalFeeUsd: settings.fixedFeeUsd,
      discountUsd: promo.discountUsd,
      label:
        promo.discountUsd > 0
          ? `${rounded.toFixed(2)} km - tarifa plana con promo -$${promo.discountUsd.toFixed(2)}`
          : `${rounded.toFixed(2)} km - tarifa plana $${settings.fixedFeeUsd.toFixed(2)}`,
      source,
      available: true,
      provider: settings.deliveryProvider,
      pricingType: settings.pricingType,
      ...agencyQuoteMeta,
    };
  }

  if (settings.pricingType === "distance_ranges") {
    const distanceKm = params.distanceKm ?? null;

    if (distanceKm === null) {
      return {
        distanceKm: null,
        feeUsd: 0,
        label: "Ubicacion pendiente",
        source: "pending",
        available: true,
        provider: settings.deliveryProvider,
        pricingType: settings.pricingType,
        ...agencyQuoteMeta,
        message: "Comparte tu ubicacion para calcular el delivery por km.",
      };
    }

    const rounded = Number(distanceKm.toFixed(2));
    if (settings.maxDistanceKm !== null && rounded > settings.maxDistanceKm) {
      return {
        distanceKm: rounded,
        feeUsd: 0,
        label: "Fuera del radio de delivery",
        source: "pending",
        available: false,
        provider: settings.deliveryProvider,
        pricingType: settings.pricingType,
        ...agencyQuoteMeta,
        message: `La ubicacion supera el radio configurado de ${settings.maxDistanceKm} km.`,
      };
    }

    const rangeFee = describeDistanceRangeFee({
      distanceKm: rounded,
      rates: settings.distanceRates,
      distanceFactor: settings.distanceFactor,
    });
    const baseFee = rangeFee?.feeUsd ?? null;

    if (baseFee === null) {
      return {
        distanceKm: rounded,
        feeUsd: 0,
        label: "Tarifa no configurada",
        source: "pending",
        available: false,
        provider: settings.deliveryProvider,
        pricingType: settings.pricingType,
        ...agencyQuoteMeta,
        message: "El comercio debe configurar rangos activos para cobrar este delivery.",
      };
    }

    const rawFee = Number(baseFee.toFixed(2));
    const promo = applyDeliveryPromo(rawFee, settings, params.subtotalUsd);
    return {
      distanceKm: rounded,
      feeUsd: promo.feeUsd,
      originalFeeUsd: rawFee,
      discountUsd: promo.discountUsd,
      label:
        promo.discountUsd > 0
          ? `${rounded.toFixed(2)} km - promo delivery -$${promo.discountUsd.toFixed(2)}`
          : `${rounded.toFixed(2)} km estimados - delivery $${rawFee.toFixed(2)}`,
      source,
      available: true,
      provider: settings.deliveryProvider,
      pricingType: settings.pricingType,
      ...agencyQuoteMeta,
      ruleSummary: rangeFee?.summary || null,
    };
  }

  return {
    distanceKm: params.distanceKm ?? null,
    feeUsd: 0,
    label: "Delivery por confirmar",
    source: "manual",
    available: true,
    provider: settings.deliveryProvider,
    pricingType: settings.pricingType,
    ...agencyQuoteMeta,
    message: settings.manualQuoteMessage || DEFAULT_MANUAL_DELIVERY_MESSAGE,
  };
}

export function calculateEntrega2FallbackQuote(params: {
  settings?: StoreDeliverySettings | null;
  subtotalUsd: number;
  distanceKm: number | null;
  source?: DeliveryQuote["source"];
}): DeliveryQuote {
  const settings = params.settings || createDefaultDeliverySettings();
  const fallbackSettings: StoreDeliverySettings = {
    ...settings,
    deliveryProvider: "own_delivery",
    pricingType: "distance_ranges",
  };
  const quote = calculateDeliveryQuoteFromSettings({
    settings: fallbackSettings,
    deliveryType: "delivery",
    subtotalUsd: params.subtotalUsd,
    distanceKm: params.distanceKm,
    source: params.source || "fallback",
  });

  return {
    ...quote,
    provider: "entrega2",
    pricingType: "distance_ranges",
    source: quote.source === "pending" ? "pending" : "fallback",
    label:
      quote.available === false
        ? quote.label
        : `Entrega2 App respaldo · ${quote.label}`,
    message:
      quote.available === false
        ? quote.message
        : "Cotizacion de respaldo calculada con las tarifas por km guardadas en Somos.",
    ruleSummary: quote.ruleSummary || "Tarifa local de respaldo Entrega2 App",
  };
}

export async function calculateRouteDistanceKm(params: {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
}) {
  const { originLat, originLng, destinationLat, destinationLng } = params;

  const fallback = haversineDistanceKm(originLat, originLng, destinationLat, destinationLng) * 1.25;

  try {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), 3500);
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destinationLng},${destinationLat}?overview=false`;

    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        return { distanceKm: fallback, source: "fallback" as const };
      }

      const data = await response.json();
      const meters = data?.routes?.[0]?.distance;

      if (typeof meters !== "number") {
        return { distanceKm: fallback, source: "fallback" as const };
      }

      return { distanceKm: meters / 1000, source: "route" as const };
    } finally {
      globalThis.clearTimeout(timeout);
    }
  } catch {
    return { distanceKm: fallback, source: "fallback" as const };
  }
}

export function buildMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function buildRouteUrl(params: {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
}) {
  const { originLat, originLng, destinationLat, destinationLng } = params;
  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destinationLat},${destinationLng}&travelmode=driving`;
}
