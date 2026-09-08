import { NextRequest, NextResponse } from "next/server";
import {
  calculateDeliveryQuoteFromSettings,
  calculateRouteDistanceKm,
  disableUnavailableTransportAgencySettings,
  mapStoreDeliverySettings,
} from "@/lib/delivery";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  loadTransportAgencyDeliverySettings,
  loadTransportAgencyDeliverySettingsBySlug,
} from "@/lib/transport";
import {
  isEntrega2AgencySlug,
  quoteEntrega2ThroughSomos,
} from "@/lib/server/entrega2-bridge";
import {
  attachApiResponseHeaders,
  createApiRequestContext,
  logApiError,
} from "@/lib/server/observability";
import {
  checkDistributedRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/server/rate-limit";
import { signDeliveryQuote } from "@/lib/server/signed-delivery-quote";
import type { DeliveryQuote } from "@/types";

const DELIVERY_QUOTE_IP_LIMIT = 90;
const DELIVERY_QUOTE_STORE_IP_LIMIT = 30;
const DELIVERY_QUOTE_RATE_WINDOW_MS = 10 * 60 * 1000;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toSafeNumber(value: unknown, fallback = Number.NaN) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  ) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasValidCoordinates(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

async function loadStoreDeliverySettings(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  store: any
) {
  const row: any = {
    id: store.id,
    accepts_delivery: store.accepts_delivery,
    accepts_pickup: store.accepts_pickup,
  };

  const [settingsResult, zonesResult, ratesResult] = await Promise.all([
    supabase
      .from("store_delivery_settings")
      .select(
        "delivery_enabled, pickup_enabled, delivery_provider, pricing_type, fixed_fee_usd, free_delivery_min_usd, delivery_promo_enabled, delivery_promo_min_subtotal_usd, delivery_promo_discount_type, delivery_promo_discount_value, max_distance_km, distance_factor, manual_quote_message, transport_agency_connection_id, transport_agency_id"
      )
      .eq("store_id", store.id)
      .maybeSingle(),
    supabase
      .from("store_delivery_zones")
      .select("id, name, description, fee_usd, is_active, sort_order")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("store_delivery_distance_rates")
      .select("id, min_km, max_km, fee_usd, is_active, sort_order")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (settingsResult.error || zonesResult.error || ratesResult.error) {
    return {
      settings: mapStoreDeliverySettings(row),
      transportAgency: null,
    };
  }

  row.store_delivery_settings = settingsResult.data ? [settingsResult.data] : [];
  row.store_delivery_zones = zonesResult.data || [];
  row.store_delivery_distance_rates = ratesResult.data || [];

  let settings = mapStoreDeliverySettings(row);
  const transportSettings = await loadTransportAgencyDeliverySettings(
    supabase,
    store.id,
    settings.pickupEnabled
  );
  if (transportSettings) {
    settings = {
      ...transportSettings.settings,
      nationalShippingEnabled: settings.nationalShippingEnabled === true,
    };
  }
  else settings = disableUnavailableTransportAgencySettings(settings);

  return {
    settings,
    transportAgency: transportSettings
      ? {
          id: String(transportSettings.agency.id),
          name: String(transportSettings.agency.name || "Empresa delivery"),
          slug: String(transportSettings.agency.slug || ""),
          logoUrl: transportSettings.agency.logo_url || null,
        }
      : null,
  };
}

export async function POST(request: NextRequest) {
  const apiContext = createApiRequestContext(request, "delivery-quote");
  const withHeaders = (response: NextResponse) =>
    attachApiResponseHeaders(response, apiContext, "delivery-quote");

  try {
    const clientIp = getClientIp(request);
    const globalLimit = await checkDistributedRateLimit({
      key: `delivery-quote:ip:${clientIp}`,
      limit: DELIVERY_QUOTE_IP_LIMIT,
      windowMs: DELIVERY_QUOTE_RATE_WINDOW_MS,
    });

    if (!globalLimit.allowed) {
      return withHeaders(
        NextResponse.json(
          { error: "Demasiadas cotizaciones. Espera unos minutos y vuelve a intentar." },
          {
            status: 429,
            headers: rateLimitHeaders(globalLimit, DELIVERY_QUOTE_IP_LIMIT),
          }
        )
      );
    }

    const body = await request.json().catch(() => null);
    const storeId = String(body?.storeId || "").trim();
    const latitude = toSafeNumber(body?.latitude);
    const longitude = toSafeNumber(body?.longitude);
    const subtotalUsd = Math.max(0, toSafeNumber(body?.subtotalUsd, 0));
    const zoneId = String(body?.zoneId || "").trim() || null;

    if (!storeId) return withHeaders(badRequest("Falta el comercio para cotizar delivery."));
    if (!hasValidCoordinates(latitude, longitude)) {
      return withHeaders(badRequest("Comparte tu ubicacion para cotizar el delivery."));
    }

    const storeLimit = await checkDistributedRateLimit({
      key: `delivery-quote:store:${storeId}:ip:${clientIp}`,
      limit: DELIVERY_QUOTE_STORE_IP_LIMIT,
      windowMs: DELIVERY_QUOTE_RATE_WINDOW_MS,
    });

    if (!storeLimit.allowed) {
      return withHeaders(
        NextResponse.json(
          { error: "Has solicitado muchas cotizaciones para este comercio. Espera unos minutos e intenta de nuevo." },
          {
            status: 429,
            headers: rateLimitHeaders(storeLimit, DELIVERY_QUOTE_STORE_IP_LIMIT),
          }
        )
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, slug, name, latitude, longitude, accepts_delivery, accepts_pickup")
      .eq("id", storeId)
      .eq("is_active", true)
      .single();

    if (storeError || !store) {
      return withHeaders(badRequest("No encontramos el comercio para cotizar delivery."));
    }

    const deliveryContext = await loadStoreDeliverySettings(supabase, store);
    const settings = deliveryContext.settings;
    const storeLat = toSafeNumber(store.latitude);
    const storeLng = toSafeNumber(store.longitude);
    if (!hasValidCoordinates(storeLat, storeLng)) {
      return withHeaders(
        badRequest("El comercio necesita ubicacion GPS configurada para cotizar delivery.")
      );
    }

    const attachQuoteToken = (quote: DeliveryQuote): DeliveryQuote => ({
      ...quote,
      quoteToken: signDeliveryQuote({
        storeId,
        latitude,
        longitude,
        subtotalUsd,
        zoneId,
        quote,
      }),
    });

    const isLegacyEntrega2 = settings.deliveryProvider === "entrega2";
    const isEntrega2SomosConnection = isEntrega2AgencySlug(
      deliveryContext.transportAgency?.slug
    );

    if (!isLegacyEntrega2 && !isEntrega2SomosConnection) {
      const routeDistance = await calculateRouteDistanceKm({
        originLat: storeLat,
        originLng: storeLng,
        destinationLat: latitude,
        destinationLng: longitude,
      });
      const routeDistanceKm = Number(routeDistance.distanceKm.toFixed(2));
      const quote = calculateDeliveryQuoteFromSettings({
        settings,
        deliveryType: "delivery",
        subtotalUsd,
        distanceKm: routeDistanceKm,
        zoneId,
        source: routeDistance.source,
      });

      return withHeaders(NextResponse.json({ ok: true, quote: attachQuoteToken(quote) }));
    }

    const legacyFallbackConfiguration = isLegacyEntrega2
      ? await loadTransportAgencyDeliverySettingsBySlug(supabase, "entrega2", {
          pickupEnabled: settings.pickupEnabled,
          promoSettings: {
            freeDeliveryMinUsd: settings.freeDeliveryMinUsd,
            deliveryPromoEnabled: settings.deliveryPromoEnabled,
            deliveryPromoMinSubtotalUsd: settings.deliveryPromoMinSubtotalUsd,
            deliveryPromoDiscountType: settings.deliveryPromoDiscountType,
            deliveryPromoDiscountValue: settings.deliveryPromoDiscountValue,
          },
        })
      : null;
    const bridgeResult = await quoteEntrega2ThroughSomos({
      pickupLat: storeLat,
      pickupLng: storeLng,
      deliveryLat: latitude,
      deliveryLng: longitude,
      subtotalUsd,
      fallbackSettings: legacyFallbackConfiguration?.settings || settings,
      provider: isEntrega2SomosConnection ? "transport_agency" : "entrega2",
      agency: isEntrega2SomosConnection ? deliveryContext.transportAgency : null,
    });

    if (bridgeResult.fallback) {
      logApiError(
        apiContext,
        "entrega2_quote_fallback_used",
        bridgeResult.fallbackError,
        { storeId }
      );
    }

    return withHeaders(
      NextResponse.json({
        ok: true,
        quote: attachQuoteToken(bridgeResult.quote),
        ...(bridgeResult.fallback ? { fallback: bridgeResult.fallback } : {}),
      })
    );
  } catch (error) {
    logApiError(apiContext, "delivery_quote_failed", error);
    return withHeaders(
      NextResponse.json(
        { error: "No pudimos cotizar el delivery. Intenta de nuevo." },
        { status: 500 }
      )
    );
  }
}
