export type DistanceRangeLike = {
  id?: string | null;
  minKm?: number | string | null;
  maxKm?: number | string | null;
  min_km?: number | string | null;
  max_km?: number | string | null;
  isActive?: boolean;
  is_active?: boolean;
};

export type NormalizedDistanceRange = {
  id: string | null;
  minKm: number;
  maxKm: number | null;
};

function optionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

export function formatDistanceRange(range: NormalizedDistanceRange) {
  return `${range.minKm} km a ${range.maxKm === null ? "sin limite" : `${range.maxKm} km`}`;
}

export function normalizeDistanceRangeInput(params: {
  id?: string | null;
  minKm: unknown;
  maxKm: unknown;
}) {
  const minKm = optionalNumber(params.minKm) ?? 0;
  const maxKm = optionalNumber(params.maxKm);

  if (maxKm !== null && maxKm <= minKm) {
    return {
      range: null,
      error: "El kilometro final debe ser mayor que el kilometro inicial.",
    };
  }

  return {
    range: {
      id: params.id || null,
      minKm,
      maxKm,
    },
    error: null,
  };
}

export function normalizeDistanceRangeRow(row: DistanceRangeLike): NormalizedDistanceRange {
  return {
    id: row.id ? String(row.id) : null,
    minKm: optionalNumber(row.minKm ?? row.min_km) ?? 0,
    maxKm: optionalNumber(row.maxKm ?? row.max_km),
  };
}

export function distanceRangesOverlap(
  first: NormalizedDistanceRange,
  second: NormalizedDistanceRange
) {
  const firstEnd = first.maxKm ?? Number.POSITIVE_INFINITY;
  const secondEnd = second.maxKm ?? Number.POSITIVE_INFINITY;

  return first.minKm < secondEnd && second.minKm < firstEnd;
}

export function findDistanceRangeGap(ranges: DistanceRangeLike[]) {
  const active = ranges
    .filter((row) => row.isActive ?? row.is_active ?? true)
    .map(normalizeDistanceRangeRow)
    .sort((a, b) => a.minKm - b.minKm);

  if (!active.length) return null;
  if (active[0].minKm > 0) return { fromKm: 0, toKm: active[0].minKm };

  for (let index = 0; index < active.length - 1; index += 1) {
    const current = active[index];
    const next = active[index + 1];
    if (current.maxKm === null) return null;
    if (next.minKm > current.maxKm) {
      return { fromKm: current.maxKm, toKm: next.minKm };
    }
  }

  return null;
}

export function findOverlappingDistanceRange(params: {
  candidate: NormalizedDistanceRange;
  ranges: DistanceRangeLike[];
  excludeId?: string | null;
}) {
  const excludeId = params.excludeId ? String(params.excludeId) : null;

  for (const row of params.ranges) {
    const rowId = row.id ? String(row.id) : null;
    const isActive = row.isActive ?? row.is_active ?? true;

    if (!isActive || (excludeId && rowId === excludeId)) continue;

    const current = normalizeDistanceRangeRow(row);
    if (distanceRangesOverlap(params.candidate, current)) return current;
  }

  return null;
}
