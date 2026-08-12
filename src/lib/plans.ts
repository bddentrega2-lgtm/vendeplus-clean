export type PlanId =
  | "trial"
  | "monthly"
  | "per_service"
  | "founder";

export const TRIAL_DAYS = 15;
export const PER_SERVICE_FEE_USD = 0.1;
export const DEFAULT_PRODUCT_LIMIT = 30;

export type Plan = {
  id: PlanId;
  name: string;
  priceUsd: number;
  billingLabel: string;
  storeLimit: number;
  productLimit: number;
  features: string[];
  serviceFeeUsd?: number;
};

const trialPlan: Plan = {
  id: "trial",
  name: "Prueba gratis",
  priceUsd: 0,
  billingLabel: "15 dias",
  storeLimit: 1,
  productLimit: 30,
  features: ["1 comercio", "30 productos iniciales", "Pedidos recibidos y ordenados", "Delivery, clientes y estadisticas basicas"],
};

const monthlyPlan: Plan = {
  id: "monthly",
  name: "Mensual",
  priceUsd: 20,
  billingLabel: "al mes por tienda, pago adelantado",
  storeLimit: 1,
  productLimit: 30,
  features: [
    "1 tienda",
    "30 productos iniciales, ampliables con logros",
    "Pedidos recibidos y ordenados",
    "Delivery configurable",
    "Clientes, reportes y estadisticas base",
    "Pago mensual por adelantado",
  ],
};

const perServicePlan: Plan = {
  id: "per_service",
  name: "Por servicio",
  priceUsd: PER_SERVICE_FEE_USD,
  billingLabel: "por pedido recibido",
  storeLimit: 1,
  productLimit: 30,
  serviceFeeUsd: PER_SERVICE_FEE_USD,
  features: [
    "Sin mensualidad fija",
    "$0.10 por pedido recibido",
    "Corte mensual con lo acumulado",
    "Ideal para bajo volumen",
    "30 productos iniciales, ampliables con logros",
    "Delivery, clientes y estadisticas basicas incluidos",
    "Mejoras avanzadas desbloqueables con logros",
  ],
};

const founderPlan: Plan = {
  id: "founder",
  name: "Founder",
  priceUsd: 0,
  billingLabel: "interno",
  storeLimit: 999,
  productLimit: 9999,
  features: ["Uso interno", "Sin limites comerciales", "Soporte directo", "Acceso fundador"],
};

export const plans: Plan[] = [perServicePlan, monthlyPlan];

export function getPlan(planId?: string | null) {
  return [trialPlan, ...plans, founderPlan].find((plan) => plan.id === planId) || perServicePlan;
}

export function getStoreProductLimit(store?: {
  plan_type?: string | null;
  product_limit?: number | null;
} | null) {
  const configured = Number(store?.product_limit);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return getPlan(store?.plan_type).productLimit;
}

export function getStoreServiceFeeUsd(store?: {
  plan_type?: string | null;
  monthly_price_usd?: number | null;
} | null) {
  if (!store || store.plan_type !== "per_service") return 0;
  const configured = Number(store.monthly_price_usd);
  if (Number.isFinite(configured) && configured >= 0) return configured;
  return PER_SERVICE_FEE_USD;
}
