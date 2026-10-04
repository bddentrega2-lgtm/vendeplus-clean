export function isBrandColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

export function safeBrandColor(value: unknown, fallback: string): string {
  return isBrandColor(value) ? value.trim() : fallback;
}
