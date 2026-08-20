import "server-only";

const PROVIDER = "entrega2";
const ENTREGA2_QUOTE_TIMEOUT_MS = 4_500;
const ENTREGA2_ORDER_TIMEOUT_MS = 8_000;
const ENTREGA2_CIRCUIT_FAILURE_LIMIT = 3;
const ENTREGA2_CIRCUIT_OPEN_MS = 30_000;

const quoteCircuit = {
  failures: 0,
  openUntil: 0,
};

export class Entrega2ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Entrega2ConfigError";
  }
}

export class Entrega2ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "Entrega2ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function getEntrega2Provider() {
  return PROVIDER;
}

export function getEntrega2ExternalOrderId(orderId: string) {
  return `vendeplus_${orderId}`;
}

export function getEntrega2WebhookSecret() {
  return process.env.ENTREGA2_WEBHOOK_SECRET?.trim() || "";
}

export function isValidEntrega2Webhook(headers: Headers) {
  const expectedSecret = getEntrega2WebhookSecret();
  const receivedSecret = headers.get("x-vendeplus-webhook-secret")?.trim() || "";

  return Boolean(expectedSecret && receivedSecret && expectedSecret === receivedSecret);
}

function getEntrega2Config() {
  const baseUrl = process.env.ENTREGA2_API_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.ENTREGA2_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    throw new Entrega2ConfigError(
      "Faltan variables de entorno de Entrega2 App en el servidor."
    );
  }

  return {
    baseUrl,
    apiKey,
  };
}

async function parseResponse(response: Response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function sendEntrega2Order(payload: Record<string, unknown>) {
  const config = getEntrega2Config();
  const endpoint = `${config.baseUrl}/pedidos`;

  const { response, responsePayload } = await requestEntrega2(
    endpoint,
    payload,
    ENTREGA2_ORDER_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Entrega2ApiError(
      "Entrega2 App rechazó el pedido.",
      response.status,
      responsePayload
    );
  }

  return {
    endpoint,
    status: response.status,
    payload: responsePayload,
  };
}

export async function quoteEntrega2Delivery(payload: Record<string, unknown>) {
  const config = getEntrega2Config();
  const endpoint = `${config.baseUrl}/cotiza2`;
  assertEntrega2QuoteCircuitAvailable();

  try {
    const { response, responsePayload } = await requestEntrega2(
      endpoint,
      payload,
      ENTREGA2_QUOTE_TIMEOUT_MS
    );

    if (!response.ok) {
      throw new Entrega2ApiError(
        "Entrega2 App no pudo cotizar el delivery.",
        response.status,
        responsePayload
      );
    }

    recordEntrega2QuoteSuccess();
    return {
      endpoint,
      status: response.status,
      payload: responsePayload,
    };
  } catch (error) {
    recordEntrega2QuoteFailure(error);
    throw error;
  }
}

export function getEntrega2CreatedByUserId() {
  return "somos_ve@entrega2company.com";
}

async function requestEntrega2(
  endpoint: string,
  payload: Record<string, unknown>,
  timeoutMs: number
) {
  const config = getEntrega2Config();
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "X-API-Key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    return { response, responsePayload: await parseResponse(response) };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Entrega2ApiError(
        "Entrega2 App tardó demasiado en responder.",
        504,
        { reason: "timeout", timeoutMs }
      );
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function assertEntrega2QuoteCircuitAvailable() {
  if (quoteCircuit.openUntil <= Date.now()) {
    if (quoteCircuit.openUntil) {
      quoteCircuit.failures = 0;
      quoteCircuit.openUntil = 0;
    }
    return;
  }

  throw new Entrega2ApiError(
    "Entrega2 App está temporalmente en contingencia.",
    503,
    { reason: "circuit_open", retryAt: quoteCircuit.openUntil }
  );
}

function recordEntrega2QuoteFailure(error: unknown) {
  const shouldCount =
    !(error instanceof Entrega2ApiError) || error.status === 429 || error.status >= 500;
  if (!shouldCount) return;

  quoteCircuit.failures += 1;
  if (quoteCircuit.failures >= ENTREGA2_CIRCUIT_FAILURE_LIMIT) {
    quoteCircuit.openUntil = Date.now() + ENTREGA2_CIRCUIT_OPEN_MS;
  }
}

function recordEntrega2QuoteSuccess() {
  quoteCircuit.failures = 0;
  quoteCircuit.openUntil = 0;
}

export function getEntrega2DefaultVehicleType() {
  return "tapp";
}

export function normalizeEntrega2OrderStatus(value: unknown) {
  const status = String(value || "").trim().toLowerCase();

  if (!status) return null;

  const map: Record<string, string> = {
    accepted: "accepted",
    aceptado: "accepted",
    asignado: "accepted",
    assigned: "accepted",
    confirmado: "accepted",
    pendiente: "sent",
    retirando: "delivering",
    llevando: "delivering",
    pickup: "delivering",
    picked_up: "delivering",
    collected: "delivering",
    en_camino: "delivering",
    on_route: "delivering",
    delivering: "delivering",
    con_novedad: "issue",
    delivered: "completed",
    entregado: "completed",
    completed: "completed",
    cancelled: "cancelled",
    canceled: "cancelled",
    cancelado: "cancelled",
  };

  return map[status] || null;
}
