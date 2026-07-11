import { NextRequest, NextResponse } from "next/server";
import { fetchExchangeRate, type BaseCurrency } from "@/lib/exchange-rate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${secret}`;
}

function normalizeCurrency(value: unknown): BaseCurrency {
  return String(value || "").toUpperCase() === "EUR" ? "EUR" : "USD";
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: stores, error } = await supabase
    .from("stores")
    .select("id, base_currency, auto_update_exchange_rate")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar comercios." },
      { status: 500 }
    );
  }

  const enabledStores = (stores || []).filter(
    (store: any) => store.auto_update_exchange_rate !== false
  );
  const currencies = Array.from(
    new Set(enabledStores.map((store: any) => normalizeCurrency(store.base_currency)))
  );
  const rates = new Map<BaseCurrency, Awaited<ReturnType<typeof fetchExchangeRate>>>();
  const errors: Array<{ currency: BaseCurrency; error: string }> = [];

  for (const currency of currencies) {
    try {
      rates.set(currency, await fetchExchangeRate(currency));
    } catch (error: any) {
      errors.push({
        currency,
        error: error?.message || "No se pudo obtener la tasa.",
      });
    }
  }

  let updated = 0;
  let failedUpdates = 0;
  for (const store of enabledStores) {
    const currency = normalizeCurrency((store as any).base_currency);
    const rate = rates.get(currency);
    if (!rate) continue;

    const { error: updateError } = await supabase
      .from("stores")
      .update({
        usd_to_bs: rate.rate,
        exchange_rate_source: rate.source,
        exchange_rate_updated_at: rate.updatedAt,
      })
      .eq("id", (store as any).id);

    if (updateError) {
      failedUpdates += 1;
    } else {
      updated += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    updated,
    failedUpdates,
    skipped: enabledStores.length - updated - failedUpdates,
    currencies: Array.from(rates.values()).map((rate) => ({
      currency: rate.currency,
      rate: rate.rate,
      updatedAt: rate.updatedAt,
    })),
    errors,
  });
}
