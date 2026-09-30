import type { DeliveryLocation } from "../../types";

const KEY = "somos_frequent_location_v1";
export type FrequentLocation = { name: string; reference: string; location: DeliveryLocation };

export function normalizeFrequentLocation(value: unknown): FrequentLocation | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<FrequentLocation>;
  const point = data.location;
  if (!point || typeof point.latitude !== "number" || typeof point.longitude !== "number" || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180 || (point.latitude === 0 && point.longitude === 0)) return null;
  const name = typeof data.name === "string" ? data.name.trim().slice(0, 40) : "";
  const reference = typeof data.reference === "string" ? data.reference.trim().slice(0, 500) : "";
  if (!name || !reference) return null;
  return { name, reference, location: { latitude: point.latitude, longitude: point.longitude, label: reference, source: "map" } };
}

export function readFrequentLocation(): FrequentLocation | null {
  try { return normalizeFrequentLocation(JSON.parse(localStorage.getItem(KEY) || "null")); } catch { return null; }
}

export function saveFrequentLocation(value: unknown): boolean {
  const safe = normalizeFrequentLocation(value);
  if (!safe) return false;
  try { localStorage.setItem(KEY, JSON.stringify(safe)); window.dispatchEvent(new Event("somos:frequent-location")); return true; } catch { return false; }
}

export function clearFrequentLocation(): boolean {
  try { localStorage.removeItem(KEY); window.dispatchEvent(new Event("somos:frequent-location")); return true; } catch { return false; }
}
