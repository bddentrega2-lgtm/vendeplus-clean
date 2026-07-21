import { NextRequest, NextResponse } from "next/server";
import { panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";
import {
  checkDistributedRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/server/rate-limit";

const GEOCODE_LIMIT = 30;
const GEOCODE_RATE_WINDOW_MS = 10 * 60 * 1000;

type GeocodeResult = {
  label: string;
  latitude: number;
  longitude: number;
  source: string;
  locationLink: string;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function toCoordinate(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeResult(row: any): GeocodeResult | null {
  const latitude = toCoordinate(row?.lat);
  const longitude = toCoordinate(row?.lon);

  if (latitude === null || longitude === null) return null;

  const label = cleanText(row?.display_name);

  return {
    label: label || `${latitude}, ${longitude}`,
    latitude,
    longitude,
    source: "openstreetmap",
    locationLink: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const clientIp = getClientIp(request);
    const rateLimit = await checkDistributedRateLimit({
      key: `panel:geocode:${auth.userId || auth.email || "unknown"}:${clientIp}`,
      limit: GEOCODE_LIMIT,
      windowMs: GEOCODE_RATE_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Demasiadas búsquedas de dirección. Espera unos minutos." },
        {
          status: 429,
          headers: rateLimitHeaders(rateLimit, GEOCODE_LIMIT),
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = cleanText(searchParams.get("q"));

    if (query.length < 3) {
      return NextResponse.json({ results: [] });
    }

    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      countrycodes: "ve",
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          "Accept-Language": "es",
          "User-Agent":
            process.env.GEOCODING_USER_AGENT ||
            "Somos/1.0",
        },
        next: { revalidate: 60 * 60 },
      }
    );

    if (!response.ok) {
      throw new Error("No se pudo consultar el buscador de direcciones.");
    }

    const rows = await response.json();
    const results = Array.isArray(rows)
      ? rows.map(normalizeResult).filter(Boolean).slice(0, 5)
      : [];

    return NextResponse.json({ results });
  } catch (error: any) {
    return panelErrorResponse(error, "Error buscando direcciones.");
  }
}
