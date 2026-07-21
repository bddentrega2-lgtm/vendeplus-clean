export type PlanId =
  | "trial"
  | "monthly"
  | "per_service"
  | "custom"
  | "founder"
  | "emprendedor"
  | "visionario";

export const TRIAL_DAYS = 15;
export const PER_SERVICE_FEE_USD = 0.1;

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
  productLimit: 50,
  features: ["1 comercio", "50 productos", "Pedidos automatizados y ordenados", "Delivery basico"],
};

const monthlyPlan: Plan = {
  id: "monthly",
  name: "Mensual",
  priceUsd: 20,
  billingLabel: "al mes por tienda, pago adelantado",
  storeLimit: 1,
  productLimit: 50,
  features: [
    "1 tienda",
    "Hasta 50 productos",
    "Pedidos automatizados y ordenados",
    "Delivery configurable",
    "Clientes, reportes y estadisticas base",
    "Pago mensual por adelantado",
  ],
};

const perServicePlan: Plan = {
  id: "per_service",
  name: "Por servicio",
  priceUsd: PER_SERVICE_FEE_USD,
  billingLabel: "por servicio procesado",
  storeLimit: 1,
  productLimit: 50,
  serviceFeeUsd: PER_SERVICE_FEE_USD,
  features: [
    "Sin mensualidad fija",
    "$0.10 por servicio procesado",
    "Corte mensual con lo acumulado",
    "Ideal para bajo volumen",
    "Hasta 50 productos",
    "Pedidos automatizados y ordenados",
  ],
};

const customPlan: Plan = {
  id: "custom",
  name: "Personalizado",
  priceUsd: 0,
  billingLabel: "segun operacion",
  storeLimit: 999,
  productLimit: 9999,
  features: [
    "Sin limite de tiendas",
    "Sin limite de productos",
    "Para mayor volumen de pedidos",
    "Condiciones adaptadas a la operacion",
    "Configuracion comercial personalizada",
    "Acompanamiento para escalar",
    "Ideal para equipos con necesidades especiales",
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

export const plans: Plan[] = [monthlyPlan, perServicePlan, customPlan];

const legacyPlans: Plan[] = [
  {
    ...monthlyPlan,
    id: "emprendedor",
    name: "Emprendedor",
  },
  {
    ...monthlyPlan,
    id: "visionario",
    name: "Visionario",
  },
];

export function getPlan(planId?: string | null) {
  const normalizedPlanId =
    planId === "emprendedor" || planId === "visionario" ? "monthly" : planId;

  return (
    [trialPlan, ...plans, founderPlan, ...legacyPlans].find(
      (plan) => plan.id === normalizedPlanId || plan.id === planId
    ) || monthlyPlan
  );
}
