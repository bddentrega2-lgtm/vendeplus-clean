const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function safeInternalPanelPath(value: unknown, fallback = "/panel") {
  const candidate = String(value || "").trim();
  const safeFallback = fallback.startsWith("/") ? fallback : "/panel";

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    CONTROL_CHARS.test(candidate)
  ) {
    return safeFallback;
  }

  try {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://www.somos-ve.com";
    const parsed = new URL(candidate, origin);

    if (parsed.origin !== origin || parsed.pathname.includes("\\")) {
      return safeFallback;
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return safeFallback;
  }
}
