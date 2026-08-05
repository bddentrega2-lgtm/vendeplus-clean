import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type ApiLogDetails = Record<string, unknown>;

export type ApiRequestContext = {
  requestId: string;
  scope: string;
  startedAt: number;
};

const REDACTED = "[redacted]";
const SENSITIVE_KEY_PATTERN =
  /(email|phone|whatsapp|password|token|secret|authorization|cookie|payload|message|address|lat|lng|location)/i;

function cleanHeaderRequestId(value: string | null) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  return /^[a-zA-Z0-9._:-]{8,120}$/.test(candidate) ? candidate : "";
}

function sanitizeDetails(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.slice(0, 180);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => sanitizeDetails(entry));

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeDetails(entry),
      ])
    );
  }

  return String(value);
}

function shouldLogInfo() {
  return String(process.env.ENABLE_API_EVENT_LOGS || "").toLowerCase() === "true";
}

export function createApiRequestContext(request: NextRequest, scope: string): ApiRequestContext {
  return {
    requestId: cleanHeaderRequestId(request.headers.get("x-request-id")) || randomUUID(),
    scope,
    startedAt: performance.now(),
  };
}

export function getApiDurationMs(context: ApiRequestContext) {
  return Math.max(0, Math.round((performance.now() - context.startedAt) * 10) / 10);
}

export function attachApiResponseHeaders(
  response: NextResponse,
  context: ApiRequestContext,
  metricName = context.scope
) {
  const durationMs = getApiDurationMs(context).toFixed(1);
  response.headers.set("X-Request-Id", context.requestId);
  response.headers.set("Server-Timing", `${metricName};dur=${durationMs}`);
  response.headers.set("X-Endpoint-Duration-Ms", durationMs);
  return response;
}

export function logApiEvent(
  context: ApiRequestContext,
  event: string,
  details: ApiLogDetails = {}
) {
  if (!shouldLogInfo()) return;

  console.info(
    JSON.stringify({
      level: "info",
      scope: context.scope,
      event,
      requestId: context.requestId,
      durationMs: getApiDurationMs(context),
      ...(sanitizeDetails(details) as ApiLogDetails),
    })
  );
}

export function logApiError(
  context: ApiRequestContext,
  event: string,
  error: unknown,
  details: ApiLogDetails = {}
) {
  const errorRecord =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : null;
  const message =
    error instanceof Error
      ? error.message
      : typeof errorRecord?.message === "string"
        ? errorRecord.message
        : String(error || "unknown_error");
  const errorCode =
    typeof errorRecord?.code === "string" ? errorRecord.code.slice(0, 80) : undefined;

  console.error(
    JSON.stringify({
      level: "error",
      scope: context.scope,
      event,
      requestId: context.requestId,
      durationMs: getApiDurationMs(context),
      error: message.slice(0, 240),
      ...(errorCode ? { errorCode } : {}),
      ...(sanitizeDetails(details) as ApiLogDetails),
    })
  );
}
