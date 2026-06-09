export const USD_TO_BS = 600;

export function formatUsd(value: number | string | null | undefined) {
  const parsed = Number(value || 0);
  const safeValue = Number.isFinite(parsed) ? parsed : 0;
  return `$${safeValue.toFixed(2)}`;
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
