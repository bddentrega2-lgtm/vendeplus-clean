import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_MFA_SESSION_COOKIE = "somos_admin_mfa";

export type AdminMfaCookiePayload = {
  sid: string;
  secret: string;
  sub: string;
  email: string;
  exp: number;
};

function getCookieSecret() {
  return process.env.ADMIN_MFA_SESSION_COOKIE_SECRET || process.env.PANEL_SESSION_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function sign(encodedPayload: string) {
  const secret = getCookieSecret();
  return secret ? createHmac("sha256", secret).update(encodedPayload).digest("base64url") : "";
}

export function getAdminMfaCookieMaxAge(exp: number) {
  return Math.max(0, Math.min(Math.floor(exp - Date.now() / 1000), 60 * 60 * 12));
}

export function createAdminMfaCookie(payload: AdminMfaCookiePayload) {
  const normalized = {
    sid: String(payload.sid || ""), secret: String(payload.secret || ""), sub: String(payload.sub || ""),
    email: String(payload.email || "").toLowerCase(), exp: Number(payload.exp || 0),
  };
  if (!normalized.sid || !normalized.secret || !normalized.sub || !normalized.email || !normalized.exp) return "";
  const encoded = Buffer.from(JSON.stringify(normalized), "utf8").toString("base64url");
  const signature = sign(encoded);
  return signature ? `${encoded}.${signature}` : "";
}

export function readAdminMfaCookie(value?: string | null): AdminMfaCookiePayload | null {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (!expected || actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AdminMfaCookiePayload;
    if (!payload.sid || !payload.secret || !payload.sub || !payload.email || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export function readAdminMfaCookieFromStore(cookies: { get?: (name: string) => { value?: string | null } | undefined }) {
  return readAdminMfaCookie(cookies.get?.(ADMIN_MFA_SESSION_COOKIE)?.value);
}
