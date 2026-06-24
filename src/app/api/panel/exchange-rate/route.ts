import { NextRequest, NextResponse } from "next/server";
import { fetchExchangeRate, type BaseCurrency } from "@/lib/exchange-rate";
import {
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";

function normalizeCurrency(value: unknown): BaseCurrency {
  return String(value || "").toUpperCase() === "EUR" ? "EUR" : "USD";
}

export async function GET(request: NextRequest) {
  try {
    await requirePanelAuth(request);

    const { searchParams } = new URL(request.url);
    const currency = normalizeCurrency(searchParams.get("currency"));
    const rate = await fetchExchangeRate(currency);

    return NextResponse.json(rate);
  } catch (error: any) {
    return panelErrorResponse(error, "No se pudo obtener la tasa automática.");
  }
}
