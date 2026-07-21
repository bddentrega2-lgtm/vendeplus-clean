import type { NextRequest } from "next/server";
import { PUBLIC_SITE_URL } from "@/lib/public-url";

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
  if (["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname)) {
    return request.nextUrl.origin;
  }

  return normalizeBaseUrl(PUBLIC_SITE_URL);
}

export function buildPublicSiteUrl(request: NextRequest, path = "/") {
  const baseUrl = getPublicSiteUrl(request);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, baseUrl).toString();
}
