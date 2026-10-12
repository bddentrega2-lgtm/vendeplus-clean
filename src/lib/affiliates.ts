export const SETUP_PRICE_USD = 20;

export function registrationPriceMessage(terms: { baseUsd: number; discountPercent: number; dueUsd: number; code: string }) {
  return [
    terms.code ? `Codigo de referido: ${terms.code}` : "Registro directo, sin codigo de referido.",
    `Suscripcion y configuracion (pago unico): US$${terms.baseUsd.toFixed(2)}`,
    terms.discountPercent > 0
      ? `Descuento: ${terms.discountPercent}% (US$${(terms.baseUsd - terms.dueUsd).toFixed(2)})`
      : "Descuento: sin descuento.",
    `Total a pagar: US$${terms.dueUsd.toFixed(2)}`,
    terms.dueUsd > 0 ? "Pago pendiente. Por favor, enviame los datos para pagar por WhatsApp." : "Sin pago inicial por el descuento aplicado.",
  ].join("\n");
}

export function affiliateWelcomeMessage(origin: string, ally: { name: string; code: string; partner_type: string; beneficiary_email: string | null }) {
  const base = new URL(origin).origin;
  const delivery = ally.partner_type === "delivery";
  return [
    `Hola ${ally.name}, bienvenido al ecosistema de referidos de SOMOS.`,
    "",
    delivery
      ? "Ingresa con la cuenta propietaria o administradora de tu empresa delivery:"
      : ally.beneficiary_email
        ? `Accede con tu cuenta de Google: ${ally.beneficiary_email}`
        : "Coordina con SOMOS el correo de Google que usaras para acceder.",
    `${base}${delivery ? "/transporte/panel/referidos" : "/aliados"}`,
    "Ahi podras administrar tus referidos y ganancias, y registrar tus datos de Pago Movil para recibir tus comisiones.",
    "",
    "Comparte este enlace con tus clientes:",
    `${base}/registro?ref=${encodeURIComponent(ally.code)}`,
    `Tambien pueden entrar a ${base}/registro y escribir tu codigo de referido: ${ally.code}`,
    "",
    "Gracias por crecer con SOMOS.",
  ].join("\n");
}

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
