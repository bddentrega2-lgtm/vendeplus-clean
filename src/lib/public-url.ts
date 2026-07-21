export const PUBLIC_SITE_URL = "https://www.somos-ve.com";

function normalizePath(path = "/") {
  return path.startsWith("/") ? path : `/${path}`;
}

export function buildPublicUrl(path = "/") {
  return new URL(normalizePath(path), PUBLIC_SITE_URL).toString();
}

export function getPublicOriginForClient() {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return window.location.origin;
    }
  }

  return PUBLIC_SITE_URL;
}

export function buildClientPublicUrl(path = "/") {
  return new URL(normalizePath(path), getPublicOriginForClient()).toString();
}
