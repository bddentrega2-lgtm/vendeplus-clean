import "server-only";

import {
  calculateEntrega2FallbackQuote,
  calculateRouteDistanceKm,
} from "@/lib/delivery";
import {
  getEntrega2DefaultVehicleType,
  quoteEntrega2Delivery,
} from "@/lib/integrations/entrega2";
import type {
  DeliveryProvider,
  DeliveryQuote,
  StoreDeliverySettings,
} from "@/types";
import { parseEntrega2QuoteCost } from "@/lib/entrega2-contract";

export const ENTREGA2_AGENCY_SLUG = "entrega2";

type AgencySnapshot = {
  id: string;
  name: string;
  logoUrl?: string | null;
};

type Entrega2BridgeQuoteParams = {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  subtotalUsd: number;
  fallbackSettings: StoreDeliverySettings;
  provider: Extract<DeliveryProvider, "entrega2" | "transport_agency">;
  agency?: AgencySnapshot | null;
};

export type Entrega2BridgeQuoteResult = {
  quote: DeliveryQuote;
  fallbackError: unknown | null;
  fallback: null | {
    provider: "entrega2";
    reason: "entrega2_quote_failed";
    rateSource: "entrega2_somos";
  };
};

function transportAgencyMetadata(agency?: AgencySnapshot | null) {
  return agency
    ? {
        transportAgencyId: agency.id,
        transportAgencyName: agency.name,
        transportAgencyLogoUrl: agency.logoUrl || null,
      }
    : {};
}

export function isEntrega2AgencySlug(value: unknown) {
  return String(value || "").trim().toLowerCase() === ENTREGA2_AGENCY_SLUG;
}

export async function quoteEntrega2ThroughSomos(
  params: Entrega2BridgeQuoteParams
): Promise<Entrega2BridgeQuoteResult> {
  const agencyMetadata = transportAgencyMetadata(params.agency);
  // La ruta y Entrega2 App se consultan al mismo tiempo. Si App demora o falla,
  // la distancia ya esta disponible para calcular el respaldo de Somos.
  const routeDistancePromise = calculateRouteDistanceKm({
    originLat: params.pickupLat,
    originLng: params.pickupLng,
    destinationLat: params.deliveryLat,
    destinationLng: params.deliveryLng,
  });

  try {
    const response = await quoteEntrega2Delivery({
      latitud_retiro: params.pickupLat,
      longitud_retiro: params.pickupLng,
      latitud_entrega: params.deliveryLat,
      longitud_entrega: params.deliveryLng,
      tipo_vehiculo: getEntrega2DefaultVehicleType(),
    });
    const routeDistance = await routeDistancePromise;
    const payload = (response.payload || {}) as Record<string, unknown>;
    const cost = parseEntrega2QuoteCost(payload.costo_total);

    if (cost === null) {
      throw new Error("Entrega2 App no devolvio una cotizacion valida.");
    }

    const roundedCost = Number(cost.toFixed(2));
    const apiDistance = Number(payload.distancia_km);
    const quotedDistance =
      Number.isFinite(apiDistance) && apiDistance > 0
        ? Number(apiDistance.toFixed(2))
        : Number(routeDistance.distanceKm.toFixed(2));
    const duration = String(payload.duracion_estimada || "").trim();
    const detail = [
      `${quotedDistance.toFixed(2)} km`,
      duration && duration.toLowerCase() !== "n/a" ? duration : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      quote: {
        distanceKm: quotedDistance,
        feeUsd: roundedCost,
        originalFeeUsd: roundedCost,
        discountUsd: 0,
        label: `Entrega2 App · ${detail} · $${roundedCost.toFixed(2)}`,
        source: "route",
        available: true,
        provider: params.provider,
        pricingType: "manual",
        ruleSummary: detail || "Cotizado por Entrega2 App",
        ...agencyMetadata,
      },
      fallbackError: null,
      fallback: null,
    };
  } catch (error) {
    const routeDistance = await routeDistancePromise;
    const fallbackQuote = calculateEntrega2FallbackQuote({
      settings: params.fallbackSettings,
      subtotalUsd: params.subtotalUsd,
      distanceKm: Number(routeDistance.distanceKm.toFixed(2)),
      source: routeDistance.source,
    });

    return {
      quote: {
        ...fallbackQuote,
        provider: params.provider,
        label:
          fallbackQuote.available === false
            ? fallbackQuote.label
            : `Entrega2 Somos respaldo · ${fallbackQuote.label.replace(/^Entrega2 App respaldo · /, "")}`,
        message:
          fallbackQuote.available === false
            ? fallbackQuote.message
            : "Entrega2 App no respondio a tiempo. Tarifa calculada con la configuracion de respaldo de Entrega2 Somos.",
        ruleSummary: `Respaldo Entrega2 Somos · ${
          fallbackQuote.ruleSummary || "Tarifa configurada por la empresa"
        }`,
        ...agencyMetadata,
      },
      fallbackError: error,
      fallback: {
        provider: "entrega2",
        reason: "entrega2_quote_failed",
        rateSource: "entrega2_somos",
      },
    };
  }
}
