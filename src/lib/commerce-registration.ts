export const WEEKLY_ORDER_VOLUME_OPTIONS = [
  { value: "one_to_ten", label: "De 1 a 10 pedidos", potential: "En crecimiento", score: 1 },
  { value: "eleven_to_thirty", label: "De 11 a 30 pedidos", potential: "Buen potencial", score: 2 },
  { value: "over_thirty", label: "Más de 30 pedidos", potential: "Alto potencial", score: 3 },
  {
    value: "starting",
    label: "Aún no vendo por WhatsApp o estoy comenzando mi negocio",
    potential: "Etapa inicial",
    score: 0,
  },
] as const;

export type WeeklyOrderVolume = (typeof WEEKLY_ORDER_VOLUME_OPTIONS)[number]["value"];

export function isWeeklyOrderVolume(value: unknown): value is WeeklyOrderVolume {
  return WEEKLY_ORDER_VOLUME_OPTIONS.some((option) => option.value === value);
}

export function getWeeklyOrderVolume(value: unknown) {
  return WEEKLY_ORDER_VOLUME_OPTIONS.find((option) => option.value === value)
    || WEEKLY_ORDER_VOLUME_OPTIONS[3];
}
