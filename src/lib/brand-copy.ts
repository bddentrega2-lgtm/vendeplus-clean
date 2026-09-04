export const DEFAULT_STORE_COVER_IMAGE = "/brand/new-somos-preview/somos-logo-preview.png";

export function normalizePublicBrandText(value: string | null | undefined) {
  if (!value) return value;

  return value
    .replace(/VendeMas/g, "Somos")
    .replace(/Vende Mas/g, "Somos")
    .replace(/Vende Más/g, "Somos")
    .replace(/Vende\+/g, "Somos")
    .replace(/vendemas/g, "somos");
}
