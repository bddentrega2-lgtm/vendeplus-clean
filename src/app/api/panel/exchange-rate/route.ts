import { NextRequest, NextResponse } from "next/server";
import { fetchExchangeRate, type BaseCurrency } from "@/lib/exchange-rate";
import {
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import {
  checkDistributedRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/server/rate-limit";

const EXCHANGE_RATE_LIMIT = 30;
const EXCHANGE_RATE_WINDOW_MS = 10 * 60 * 1000;

function normalizeCurrency(value: unknown): BaseCurrency {
  return String(value || "").toUpperCase() === "EUR" ? "EUR" : "USD";
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const clientIp = getClientIp(request);
    const rateLimit = await checkDistributedRateLimit({
      key: `panel:exchange-rate:${auth.userId || auth.email || "unknown"}:${clientIp}`,
      limit: EXCHANGE_RATE_LIMIT,
      windowMs: EXCHANGE_RATE_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Demasiadas consultas de tasa. Prueba de nuevo en unos minutos." },
        {
          status: 429,
          headers: rateLimitHeaders(rateLimit, EXCHANGE_RATE_LIMIT),
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const currency = normalizeCurrency(searchParams.get("currency"));
    const rate = await fetchExchangeRate(currency);

    return NextResponse.json(rate);
  } catch (error: any) {
    return panelErrorResponse(error, "No se pudo obtener la tasa automatica.");
  }
}
