export type BaseCurrency = "USD" | "EUR";

export type ExchangeRateResult = {
  currency: BaseCurrency;
  rate: number;
  source: string;
  updatedAt: string;
};

const fallbackEndpoints: Record<BaseCurrency, string[]> = {
  USD: [
    "https://ve.dolarapi.com/v1/dolares/oficial",
    "https://pydolarve.org/api/v1/dollar?page=bcv",
  ],
  EUR: [
    "https://ve.dolarapi.com/v1/euros/oficial",
    "https://pydolarve.org/api/v1/euro?page=bcv",
  ],
};

export async function fetchExchangeRate(
  currency: BaseCurrency
): Promise<ExchangeRateResult> {
  const configuredUrl =
    currency === "EUR"
      ? process.env.BCV_EUR_RATE_API_URL
      : process.env.BCV_USD_RATE_API_URL;
  const endpoints = [configuredUrl, ...fallbackEndpoints[currency]].filter(
    Boolean
  ) as string[];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        if (!response.ok) continue;

        const data = await response.json();
        const rate = extractRate(data, currency);

        if (rate && rate > 0) {
          return {
            currency,
            rate,
            source: endpoint,
            updatedAt: extractUpdatedAt(data),
          };
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Try the next configured provider.
    }
  }

  throw new Error(
    `No se pudo obtener la tasa ${currency}/Bs desde las APIs configuradas.`
  );
}

function extractRate(data: unknown, currency: BaseCurrency): number | null {
  const candidates: unknown[] = [];

  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const record = value as Record<string, unknown>;
    for (const key of [
      "promedio",
      "price",
      "value",
      "rate",
      "venta",
      "sell",
      "dollar",
      "dolar",
      "usd",
      "euro",
      "eur",
    ]) {
      if (record[key] !== undefined) candidates.push(record[key]);
    }

    const monitorKey = currency === "EUR" ? "eur" : "usd";
    if (record.monitors && typeof record.monitors === "object") {
      const monitors = record.monitors as Record<string, unknown>;
      visit(monitors.bcv || monitors[monitorKey] || monitors[currency]);
    }

    if (record.bcv) visit(record.bcv);
  }

  visit(data);

  for (const candidate of candidates) {
    const parsed =
      typeof candidate === "string"
        ? Number(candidate.replace(",", "."))
        : Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
}

function extractUpdatedAt(data: unknown) {
  if (!data || typeof data !== "object") return new Date().toISOString();

  const record = data as Record<string, unknown>;
  const value =
    record.fechaActualizacion ||
    record.updated_at ||
    record.date ||
    record.last_update;

  return typeof value === "string" ? value : new Date().toISOString();
}
