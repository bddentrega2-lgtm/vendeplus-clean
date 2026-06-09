import "server-only";

const PROVIDER = "entrega2";

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
      "Faltan variables de entorno de Entrega2 en el servidor."
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
  const endpoint = `${config.baseUrl}/orders`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const responsePayload = await parseResponse(response);

  if (!response.ok) {
    throw new Entrega2ApiError(
      "Entrega2 rechazó el pedido.",
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

export function normalizeEntrega2OrderStatus(value: unknown) {
  const status = String(value || "").trim().toLowerCase();

  if (!status) return null;

  const map: Record<string, string> = {
    accepted: "accepted",
    asignado: "accepted",
    assigned: "accepted",
    confirmado: "accepted",
    pickup: "delivering",
    picked_up: "delivering",
    collected: "delivering",
    en_camino: "delivering",
    on_route: "delivering",
    delivering: "delivering",
    delivered: "completed",
    entregado: "completed",
    completed: "completed",
    cancelled: "cancelled",
    canceled: "cancelled",
    cancelado: "cancelled",
  };

  return map[status] || null;
}
