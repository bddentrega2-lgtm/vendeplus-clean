import { createHmac, timingSafeEqual } from "crypto";

export const PANEL_SESSION_COOKIE = "somos_panel_session";

export type PanelSessionCookiePayload = {
  sub: string;
  email: string;
  exp: number;
  founder: boolean;
};

const MAX_SESSION_SECONDS = 60 * 60 * 24 * 7;

function getCookieSecret() {
  return (
    process.env.PANEL_SESSION_COOKIE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_JWT_SECRET ||
    ""
  );
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string) {
  const secret = getCookieSecret();
  if (!secret) return "";

  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function getPanelSessionCookieMaxAge(exp: number) {
  const secondsUntilExpiry = Math.floor(exp - Date.now() / 1000);
  return Math.max(0, Math.min(secondsUntilExpiry, MAX_SESSION_SECONDS));
}

export function createPanelSessionCookie(payload: PanelSessionCookiePayload) {
  const normalizedPayload: PanelSessionCookiePayload = {
    sub: String(payload.sub || ""),
    email: String(payload.email || "").toLowerCase(),
    exp: Number(payload.exp || 0),
    founder: Boolean(payload.founder),
  };

  if (!normalizedPayload.sub || !normalizedPayload.email || !normalizedPayload.exp) {
    return "";
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(normalizedPayload));
  const signature = signPayload(encodedPayload);
  if (!signature) return "";

  return `${encodedPayload}.${signature}`;
}

export function readPanelSessionCookie(value?: string | null) {
  if (!value) return null;

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload);
  if (!expectedSignature) return null;

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as PanelSessionCookiePayload;
    if (!payload.sub || !payload.email || !payload.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
