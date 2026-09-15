import { NextRequest, NextResponse } from "next/server";
import {
  checkDistributedRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/server/rate-limit";

const GEOCODE_LIMIT = 40;
const GEOCODE_RATE_WINDOW_MS = 10 * 60 * 1000;
const MIN_QUERY_LENGTH = 3;

type GeocodeResult = {
  label: string;
  latitude: number;
  longitude: number;
  source: "openstreetmap";
  locationLink: string;
};

function cleanText(value: unknown, maxLength = 140) {
  return String(value || "").trim().slice(0, maxLength);
}

function toCoordinate(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function normalizeResult(row: any): GeocodeResult | null {
  const latitude = toCoordinate(row?.lat, -90, 90);
  const longitude = toCoordinate(row?.lon, -180, 180);
  if (latitude === null || longitude === null) return null;

  const label = cleanText(row?.display_name, 220);

  return {
    label: label || `${latitude}, ${longitude}`,
    latitude,
    longitude,
    source: "openstreetmap",
    locationLink: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  };
}

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = await checkDistributedRateLimit({
    key: `public:geocode:${clientIp}`,
    limit: GEOCODE_LIMIT,
    windowMs: GEOCODE_RATE_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas busquedas de direccion. Espera unos minutos." },
      { status: 429, headers: rateLimitHeaders(rateLimit, GEOCODE_LIMIT) }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = cleanText(searchParams.get("q"));
  const area = cleanText(searchParams.get("area"), 80);
  const latitude = toCoordinate(searchParams.get("lat"), -90, 90);
  const longitude = toCoordinate(searchParams.get("lng"), -180, 180);

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  const params = new URLSearchParams({
    q: area ? `${query} ${area}` : query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "6",
    countrycodes: "ve",
  });

  if (latitude !== null && longitude !== null) {
    const delta = 0.45;
    params.set(
      "viewbox",
      [
        (longitude - delta).toFixed(6),
        (latitude + delta).toFixed(6),
        (longitude + delta).toFixed(6),
        (latitude - delta).toFixed(6),
      ].join(",")
    );
    params.set("bounded", "0");
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          "Accept-Language": "es",
          "User-Agent": process.env.GEOCODING_USER_AGENT || "Somos/1.0",
        },
        next: { revalidate: 60 * 60 },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "No se pudo consultar el buscador de direcciones.", results: [] },
        { status: 502 }
      );
    }

    const rows = await response.json();
    const results = Array.isArray(rows)
      ? rows.map(normalizeResult).filter(Boolean).slice(0, 5)
      : [];

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "No se pudo consultar el buscador de direcciones.", results: [] },
      { status: 502 }
    );
  }
}
