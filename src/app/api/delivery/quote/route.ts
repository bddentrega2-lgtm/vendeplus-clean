import { NextRequest, NextResponse } from "next/server";
import {
  calculateDeliveryQuoteFromSettings,
  calculateEntrega2FallbackQuote,
  calculateRouteDistanceKm,
  disableUnavailableTransportAgencySettings,
  mapStoreDeliverySettings,
} from "@/lib/delivery";
import {
  getEntrega2DefaultVehicleType,
  quoteEntrega2Delivery,
} from "@/lib/integrations/entrega2";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadTransportAgencyDeliverySettings } from "@/lib/transport";
import {
  attachApiResponseHeaders,
  createApiRequestContext,
  logApiError,
} from "@/lib/server/observability";
import { signDeliveryQuote } from "@/lib/server/signed-delivery-quote";
import type { DeliveryQuote } from "@/types";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toSafeNumber(value: unknown, fallback = Number.NaN) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    return mapStoreDeliverySettings(row);
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

  return settings;
}

export async function POST(request: NextRequest) {
  const apiContext = createApiRequestContext(request, "delivery-quote");
  const withHeaders = (response: NextResponse) =>
    attachApiResponseHeaders(response, apiContext, "delivery-quote");

  try {
    const body = await request.json().catch(() => null);
    const storeId = String(body?.storeId || "").trim();
    const latitude = toSafeNumber(body?.latitude);
    const longitude = toSafeNumber(body?.longitude);
    const subtotalUsd = Math.max(0, toSafeNumber(body?.subtotalUsd, 0));
    const zoneId = String(body?.zoneId || "").trim() || null;

    if (!storeId) return withHeaders(badRequest("Falta el comercio para cotizar delivery."));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return withHeaders(badRequest("Comparte tu ubicacion para cotizar el delivery."));
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

    const settings = await loadStoreDeliverySettings(supabase, store);
    const storeLat = toSafeNumber(store.latitude);
    const storeLng = toSafeNumber(store.longitude);
    if (!Number.isFinite(storeLat) || !Number.isFinite(storeLng)) {
      return withHeaders(
        badRequest("El comercio necesita ubicacion GPS configurada para cotizar con Entrega2 App.")
      );
    }

    const routeDistance = await calculateRouteDistanceKm({
      originLat: storeLat,
      originLng: storeLng,
      destinationLat: latitude,
      destinationLng: longitude,
    });
    const routeDistanceKm = Number(routeDistance.distanceKm.toFixed(2));
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

    if (settings.deliveryProvider !== "entrega2") {
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

    try {
      const entrega2Quote = await quoteEntrega2Delivery({
        latitud_retiro: storeLat,
        longitud_retiro: storeLng,
        latitud_entrega: latitude,
        longitud_entrega: longitude,
        tipo_vehiculo: getEntrega2DefaultVehicleType(),
      });

      const payload = (entrega2Quote.payload || {}) as any;
      const cost = toSafeNumber(payload.costo_total);
      if (!Number.isFinite(cost) || cost < 0) {
        throw new Error("Entrega2 App no devolvio una cotizacion valida.");
      }

      const roundedCost = Number(cost.toFixed(2));
      const entrega2Distance = Number.isFinite(Number(payload.distancia_km))
        ? Number(Number(payload.distancia_km).toFixed(2))
        : null;
      const quotedDistance =
        entrega2Distance !== null && entrega2Distance > 0 ? entrega2Distance : routeDistanceKm;
      const duration = String(payload.duracion_estimada || "").trim();
      const detail = [
        `${quotedDistance.toFixed(2)} km`,
        duration && duration.toLowerCase() !== "n/a" ? duration : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const quote = calculateDeliveryQuoteFromSettings({
        settings,
        deliveryType: "delivery",
        subtotalUsd,
        distanceKm: quotedDistance,
        source: routeDistance.source,
      });

      const finalQuote = {
            ...quote,
            distanceKm: quotedDistance,
            feeUsd: roundedCost,
            originalFeeUsd: roundedCost,
            discountUsd: 0,
            label: `Entrega2 App · ${detail} · $${roundedCost.toFixed(2)}`,
            source: "route",
            available: true,
            provider: "entrega2",
            pricingType: "manual",
            message: undefined,
            ruleSummary: detail || "Cotizado por Entrega2 App",
          } satisfies DeliveryQuote;

      return withHeaders(
        NextResponse.json({
          ok: true,
          quote: attachQuoteToken(finalQuote),
        })
      );
    } catch (error) {
      logApiError(apiContext, "entrega2_quote_fallback_used", error, { storeId });
      const fallbackQuote = calculateEntrega2FallbackQuote({
        settings,
        subtotalUsd,
        distanceKm: routeDistanceKm,
        source: routeDistance.source,
      });

      return withHeaders(
        NextResponse.json({
          ok: true,
          quote: attachQuoteToken(fallbackQuote),
          fallback: {
            provider: "entrega2",
            reason: "entrega2_quote_failed",
          },
        })
      );
    }
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
