import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isStoreSubscriptionPastDue } from "@/lib/supabase/catalog";
import { normalizeItems, reviewStoredCart } from "@/lib/server/cart-review";
import { checkDistributedRateLimit, getClientIp, rateLimitHeaders } from "@/lib/server/rate-limit";

export async function POST(request: NextRequest) {
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    const limit = await checkDistributedRateLimit({ key: `cart-review:${getClientIp(request)}`, limit: 120, windowMs: 60_000 });
    if (!limit.allowed) return NextResponse.json({ error: "Espera un momento antes de revisar de nuevo." }, { status: 429, headers: rateLimitHeaders(limit, 120) });
    if (Number(request.headers.get("content-length") || 0) > 180_000) return reply({ error: "El carrito es demasiado grande." }, 413);
    const raw = await request.text();
    if (raw.length > 180_000) return reply({ error: "El carrito es demasiado grande." }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ error: "Carrito inválido." }, 400); }
    if (!body || typeof body.storeSlug !== "string" || body.storeSlug.length > 140 || !Array.isArray(body.items) || body.items.length > 80) return reply({ error: "Carrito inválido." }, 400);
    const supabase = createSupabaseAdminClient();
    const { data: store, error } = await supabase.from("stores").select("id, subscription_status, trial_ends_at, subscription_ends_at, next_payment_due_at").eq("slug", body.storeSlug).eq("is_active", true).maybeSingle();
    if (error) throw error;
    if (!store || isStoreSubscriptionPastDue(store)) return reply({ error: "El comercio no está disponible." }, 404);
    const items = normalizeItems(body.items);
    if (items.length !== body.items.length) return reply({ error: "Revisa los productos de tu carrito." }, 400);
    return reply(await reviewStoredCart(supabase, String(store.id), items));
  } catch {
    return reply({ error: "No pudimos revisar el carrito. Tus productos siguen guardados. Intenta de nuevo." }, 503);
  }
}
