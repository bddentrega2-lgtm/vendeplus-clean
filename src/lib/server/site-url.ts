import type { NextRequest } from "next/server";

function normalizeBaseUrl(value: string | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.origin;
  } catch {
    return "";
  }
}

export function getPublicSiteUrl(request: NextRequest) {
  const configuredUrl =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeBaseUrl(process.env.SITE_URL) ||
    normalizeBaseUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeBaseUrl(process.env.VERCEL_URL);

  if (configuredUrl) return configuredUrl;

  if (["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname)) {
    return request.nextUrl.origin;
  }

  return "https://vendeplus-clean.vercel.app";
}

export function buildPublicSiteUrl(request: NextRequest, path = "/") {
  const baseUrl = getPublicSiteUrl(request);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, baseUrl).toString();
}
