export const BUSINESS_TYPES = [
  { value: "food", label: "Comida" },
  { value: "desserts", label: "Postres" },
  { value: "fashion", label: "Ropa" },
  { value: "tech", label: "Tecnología" },
  { value: "general", label: "Otros" },
] as const;

function normalize(value: unknown) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function normalizeBusinessType(value: unknown) {
  const normalized = normalize(value);
  if (["food", "comida", "restaurante", "restaurant"].includes(normalized)) return "food";
  if (["desserts", "dessert", "postres", "postre", "dulces", "dulce"].includes(normalized)) return "desserts";
  if (["fashion", "ropa", "moda", "ropa / moda"].includes(normalized)) return "fashion";
  if (["tech", "tecnologia"].includes(normalized)) return "tech";
  return "general";
}

export function businessTypeLabel(value: unknown) {
  const canonical = normalizeBusinessType(value);
  return BUSINESS_TYPES.find((type) => type.value === canonical)?.label || "Otros";
}
