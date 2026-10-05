export const SETUP_PRICE_USD = 20;

export function normalizeAffiliateCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export function setupDueUsd(discountPercent: number) {
  return Math.round(SETUP_PRICE_USD * (100 - discountPercent)) / 100;
}

export function isValidAffiliateCode(code: string) {
  return /^[A-Z0-9_-]{3,32}$/.test(code);
}

export function isAffiliateCodeAvailable(code: {
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
}) {
  const now = Date.now();
  return code.status === "active"
    && (!code.starts_at || Date.parse(code.starts_at) <= now)
    && (!code.expires_at || Date.parse(code.expires_at) > now)
    && (code.max_uses === null || code.used_count < code.max_uses);
}
