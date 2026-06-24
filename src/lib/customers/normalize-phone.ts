export function normalizePhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("00")) {
    return digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `58${digits.slice(1)}`;
  }

  if (digits.length === 10 && digits.startsWith("4")) {
    return `58${digits}`;
  }

  if (digits.length === 7) {
    return digits;
  }

  return digits;
}

export function getWhatsappPhone(value: unknown) {
  const normalized = normalizePhone(value);

  if (!normalized) return "";
  if (normalized.length === 10 && normalized.startsWith("4")) return `58${normalized}`;
  if (normalized.length === 11 && normalized.startsWith("0")) {
    return `58${normalized.slice(1)}`;
  }

  return normalized;
}
