export const MOBILE_PREFIX = "somos_mobile_v1_";
const PRIVATE_PREFIX = `${MOBILE_PREFIX}private_`;
const reserved = new Set(["api", "auth", "admin", "panel", "transporte", "registro", "prototipos", "_next"]);
const panelRoutes = new Set(["/panel", "/panel/inicio", "/panel/pedidos", "/panel/pedidos/nuevo", "/panel/productos", "/panel/catalogo", "/panel/opciones", "/panel/mesas", "/panel/cocina", "/panel/clientes", "/panel/estadisticas", "/panel/delivery", "/panel/configuracion", "/panel/suscripcion", "/panel/impresion"]);

export function isNativeApp() {
  return typeof window !== "undefined" && Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
}

// Only canonical paths are remembered. Query strings, fragments and table tokens never are.
export function safeMobileRoute(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 150 || /[?#%\\\s]/.test(value)) return null;
  if (panelRoutes.has(value) || value === "/marketplace") return value;
  const match = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/(carrito|checkout|confirmacion))?$/.exec(value);
  return match && !reserved.has(match[1]) ? value : null;
}

export function readMobile<T>(key: string, fallback: T): T {
  if (!isNativeApp()) return fallback;
  try { return JSON.parse(localStorage.getItem(MOBILE_PREFIX + key) || "null") ?? fallback; } catch { return fallback; }
}
export function writeMobile(key: string, value: unknown) {
  if (!isNativeApp()) return;
  try { localStorage.setItem(MOBILE_PREFIX + key, JSON.stringify(value)); } catch { /* Storage may be disabled. */ }
}
export function removeMobile(key: string) {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(MOBILE_PREFIX + key); } catch { /* Optional persistence. */ }
}
export function clearMobilePrivateState() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PRIVATE_PREFIX)) localStorage.removeItem(key);
    }
    localStorage.removeItem(MOBILE_PREFIX + "account");
  } catch { /* Logout must still complete. */ }
}
export function bindMobileAccount(userId: string) {
  if (!isNativeApp()) return;
  if (readMobile("account", "") !== userId) clearMobilePrivateState();
  writeMobile("account", userId);
}

export function mobileBackTarget(path: string): string | null {
  if (path === "/panel/login") return "/marketplace";
  if (["/marketplace", "/panel", "/panel/inicio", "/panel/pedidos"].includes(path)) return null;
  if (path.startsWith("/panel/")) return "/panel/pedidos";
  const safe = safeMobileRoute(path);
  if (!safe) return null;
  const slug = path.split("/")[1];
  if (path.endsWith("/checkout")) return `/${slug}/carrito`;
  if (path.endsWith("/carrito") || path.endsWith("/confirmacion")) return `/${slug}`;
  return "/marketplace";
}

const draftFields = ["customerName", "customerPhone", "deliveryReference", "deliveryZoneId", "nationalShippingCity", "orderDetails", "notes", "cashPaymentNote"] as const;
export function safeCheckoutDraft(form: Record<string, unknown>) {
  const result: Record<string, string> = {};
  for (const field of draftFields) if (typeof form[field] === "string") result[field] = form[field].slice(0, 1000);
  if (["delivery", "pickup", "national_shipping"].includes(String(form.deliveryType))) result.deliveryType = String(form.deliveryType);
  return result;
}
