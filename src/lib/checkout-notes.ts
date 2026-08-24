import { normalizeBusinessType } from "@/lib/business-types";

const CHECKOUT_NOTE_EXAMPLES: Record<string, string> = {
  food: "Ej: sin cebolla, salsa aparte o tocar el timbre.",
  desserts: "Ej: escribir ‘Feliz cumpleaños Ana’ en la torta.",
  fashion: "Ej: confirmar talla o color antes de enviar.",
  tech: "Ej: confirmar modelo o compatibilidad.",
  general: "Ej: cualquier detalle importante para preparar o entregar tu pedido.",
};

export function checkoutNoteExample(businessType: unknown, customExample?: unknown) {
  const custom = String(customExample || "").trim();
  if (custom) return custom;
  return CHECKOUT_NOTE_EXAMPLES[normalizeBusinessType(businessType)] || CHECKOUT_NOTE_EXAMPLES.general;
}
