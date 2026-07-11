export const USD_TO_BS = 600;

export function formatUsd(value: number | string | null | undefined) {
  const parsed = Number(value || 0);
  const safeValue = Number.isFinite(parsed) ? parsed : 0;
  return `$${safeValue.toFixed(2)}`;
}

export function formatBaseCurrency(
  value: number | string | null | undefined,
  currency: "USD" | "EUR" | string | null | undefined = "USD"
) {
  const parsed = Number(value || 0);
  const safeValue = Number.isFinite(parsed) ? parsed : 0;
  const symbol = String(currency || "USD").toUpperCase() === "EUR" ? "€" : "$";
  return `${symbol}${safeValue.toFixed(2)}`;
}

export function getBaseCurrencySymbol(currency: "USD" | "EUR" | string | null | undefined) {
  return String(currency || "USD").toUpperCase() === "EUR" ? "€" : "$";
}

export function formatBs(value: number | string | null | undefined) {
  const parsed = Number(value || 0);
  const safeValue = Number.isFinite(parsed) ? parsed : 0;
  return `Bs. ${safeValue.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function usdToBs(value: number) {
  return value * USD_TO_BS;
}
