import { createHmac, timingSafeEqual } from "crypto";
import type { DeliveryQuote } from "@/types";

const QUOTE_TTL_MS = 30 * 60 * 1000;

type SignedQuotePayload = {
  v: 1;
  storeId: string;
  latitude: number;
  longitude: number;
  subtotalUsd: number;
  zoneId: string | null;
  expiresAt: number;
  quote: Omit<DeliveryQuote, "quoteToken">;
};

function getSigningSecret() {
  const secret = process.env.DELIVERY_QUOTE_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Falta configurar la firma de cotizaciones de delivery.");
  return secret;
}

function signature(value: string) {
  return createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

function normalizeCoordinate(value: number) {
  return Number(Number(value).toFixed(6));
}

function normalizeMoney(value: number) {
  return Number(Number(value).toFixed(2));
}

export function signDeliveryQuote(params: {
  storeId: string;
  latitude: number;
  longitude: number;
  subtotalUsd: number;
  zoneId?: string | null;
  quote: DeliveryQuote;
}) {
  const { quoteToken: _quoteToken, ...quote } = params.quote;
  const payload: SignedQuotePayload = {
    v: 1,
    storeId: params.storeId,
    latitude: normalizeCoordinate(params.latitude),
    longitude: normalizeCoordinate(params.longitude),
    subtotalUsd: normalizeMoney(params.subtotalUsd),
    zoneId: params.zoneId || null,
    expiresAt: Date.now() + QUOTE_TTL_MS,
    quote,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifyDeliveryQuote(params: {
  token?: string | null;
  storeId: string;
  latitude: number;
  longitude: number;
  subtotalUsd: number;
  zoneId?: string | null;
}) {
  const [encoded, providedSignature] = String(params.token || "").split(".");
  if (!encoded || !providedSignature) return null;

  const expectedSignature = signature(encoded);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SignedQuotePayload;
    if (
      payload.v !== 1 ||
      payload.expiresAt < Date.now() ||
      payload.storeId !== params.storeId ||
      payload.latitude !== normalizeCoordinate(params.latitude) ||
      payload.longitude !== normalizeCoordinate(params.longitude) ||
      payload.subtotalUsd !== normalizeMoney(params.subtotalUsd) ||
      payload.zoneId !== (params.zoneId || null) ||
      !payload.quote ||
      payload.quote.available === false
    ) return null;
    return payload.quote;
  } catch {
    return null;
  }
}
