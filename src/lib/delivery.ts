import type { DeliveryQuote } from "@/types";

const EARTH_RADIUS_KM = 6371;

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
    };
  }

  const rounded = Number(distanceKm.toFixed(2));

  return {
    distanceKm: rounded,
    feeUsd: calculateDeliveryFee(rounded),
    label: `${rounded.toFixed(2)} km estimados`,
    source,
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
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destinationLng},${destinationLat}?overview=false`;
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return { distanceKm: fallback, source: "fallback" as const };
    }

    const data = await response.json();
    const meters = data?.routes?.[0]?.distance;

    if (typeof meters !== "number") {
      return { distanceKm: fallback, source: "fallback" as const };
    }

    return { distanceKm: meters / 1000, source: "route" as const };
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
