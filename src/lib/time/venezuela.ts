export const VENEZUELA_TIME_ZONE = "America/Caracas";

const VENEZUELA_UTC_OFFSET = "-04:00";
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function getVenezuelaDateKey(value: Date | string = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VENEZUELA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getVenezuelaDayRange(value: Date | string = new Date()) {
  const key = typeof value === "string" ? parseDateKey(value) || getVenezuelaDateKey(value) : getVenezuelaDateKey(value);
  const start = new Date(`${key}T00:00:00.000${VENEZUELA_UTC_OFFSET}`);
  const end = new Date(start.getTime() + DAY_MS - 1);

  return { key, start, end };
}

export function addVenezuelaDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function getVenezuelaRelativeRange(
  range: "today" | "last_7_days" | "last_30_days",
  now = new Date()
) {
  const today = getVenezuelaDayRange(now);
  const daysBack = range === "last_30_days" ? 29 : range === "last_7_days" ? 6 : 0;
  const start = addVenezuelaDays(today.start, -daysBack);

  return {
    start,
    end: today.end,
  };
}

export function formatVenezuelaDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("es-VE", {
      timeZone: VENEZUELA_TIME_ZONE,
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
