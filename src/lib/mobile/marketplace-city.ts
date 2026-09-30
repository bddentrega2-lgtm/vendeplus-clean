export type NativeCityPreference = {
  mode: "auto" | "manual" | "blocked";
  city?: string;
  updatedAt: number;
};

// Store coordinates are hints, not city boundaries. Ambiguous or remote fixes
// require an explicit choice instead of assigning the nearest city in the country.
export function inferMarketplaceCity(
  candidates: Array<{ slug: string | null | undefined; distance: number | null }>,
  accuracyMeters: number,
): string | null {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0 || accuracyMeters > 5000) return null;
  const distances = new Map<string, number>();
  for (const { slug, distance } of candidates) {
    if (!slug || distance === null || !Number.isFinite(distance) || distance < 0) continue;
    distances.set(slug, Math.min(distances.get(slug) ?? Infinity, distance));
  }
  const cities = [...distances].sort((a, b) => a[1] - b[1]);
  if (!cities.length || cities[0][1] > 20) return null;
  if (cities[1] && cities[1][1] - cities[0][1] <= Math.max(1, accuracyMeters / 1000)) return null;
  return cities[0][0];
}
