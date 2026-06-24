import type {
  BusinessDayKey,
  BusinessHours,
  BusinessHoursRange,
  ManualOpenStatus,
  StoreOpenState,
} from "@/types";

const dayKeys: BusinessDayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function minutesFromTime(value: string) {
  const [hours, minutes] = String(value || "").split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return Math.max(0, Math.min(24 * 60, hours * 60 + minutes));
}

function getNowInCaracas(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value || "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);

  return {
    dayKey: dayKeys[Math.max(0, weekdayIndex)] || "sun",
    minutes: hour * 60 + minute,
  };
}

function normalizeRange(range: BusinessHoursRange) {
  const open = minutesFromTime(range.open);
  const close = minutesFromTime(range.close);
  if (open === null || close === null || open === close) return null;
  return { open, close };
}

function hasConfiguredHours(hours?: BusinessHours | null) {
  if (!hours || typeof hours !== "object") return false;
  return Object.values(hours).some((ranges) =>
    Array.isArray(ranges) &&
    ranges.some((range) => range && range.enabled !== false && range.open && range.close)
  );
}

function isWithinRange(currentMinutes: number, range: { open: number; close: number }) {
  if (range.close > range.open) {
    return currentMinutes >= range.open && currentMinutes < range.close;
  }

  return currentMinutes >= range.open || currentMinutes < range.close;
}

export function getStoreOpenState(params: {
  manualOpenStatus?: ManualOpenStatus | string | null;
  manualOpenNote?: string | null;
  businessHours?: BusinessHours | null;
  openingHoursText?: string | null;
  now?: Date;
}): StoreOpenState {
  const manualStatus = params.manualOpenStatus || "auto";

  if (manualStatus === "open") {
    return {
      isOpen: true,
      label: params.manualOpenNote || "Abierto ahora",
      reason: "manual_open",
    };
  }

  if (manualStatus === "closed") {
    return {
      isOpen: false,
      label: params.manualOpenNote || "Cerrado temporalmente",
      reason: "manual_closed",
    };
  }

  if (!hasConfiguredHours(params.businessHours)) {
    return {
      isOpen: true,
      label: params.openingHoursText || "Disponible hoy",
      reason: "not_configured",
    };
  }

  const { dayKey, minutes } = getNowInCaracas(params.now);
  const ranges = params.businessHours?.[dayKey] || [];
  const isOpen = ranges.some((range) => {
    if (!range || range.enabled === false) return false;
    const normalized = normalizeRange(range);
    return normalized ? isWithinRange(minutes, normalized) : false;
  });

  return {
    isOpen,
    label: isOpen ? "Abierto ahora" : "Cerrado por horario",
    reason: isOpen ? "schedule_open" : "schedule_closed",
  };
}
