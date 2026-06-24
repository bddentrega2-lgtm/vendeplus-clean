export type PlanId = "trial" | "emprendedor" | "visionario";

export const TRIAL_DAYS = 15;

export const plans: Array<{
  id: PlanId;
  name: string;
  priceUsd: number;
  billingLabel: string;
  storeLimit: number;
  productLimit: number;
  features: string[];
}> = [
  {
    id: "trial",
    name: "Prueba gratis",
    priceUsd: 0,
    billingLabel: "15 días",
    storeLimit: 1,
    productLimit: 30,
    features: ["1 comercio", "30 productos", "Pedidos por WhatsApp", "Delivery básico"],
  },
  {
    id: "emprendedor",
    name: "Emprendedor",
    priceUsd: 10,
    billingLabel: "al mes",
    storeLimit: 1,
    productLimit: 80,
    features: ["1 comercio", "80 productos", "Opciones y extras", "Clientes y estadísticas base"],
  },
  {
    id: "visionario",
    name: "Visionario",
    priceUsd: 20,
    billingLabel: "al mes",
    storeLimit: 3,
    productLimit: 300,
    features: ["Hasta 3 comercios", "300 productos", "Delivery avanzado", "Prioridad en integraciones"],
  },
];

export function getPlan(planId?: string | null) {
  return plans.find((plan) => plan.id === planId) || plans[0];
}
