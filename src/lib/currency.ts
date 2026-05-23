export const USD_TO_BS = 600;

export function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

export function formatBs(value: number) {
  return `Bs. ${value.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function usdToBs(value: number) {
  return value * USD_TO_BS;
}
