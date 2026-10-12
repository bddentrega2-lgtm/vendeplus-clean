import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAffiliateCodeAvailable, isValidAffiliateCode, normalizeAffiliateCode, setupDueUsd } from "@/lib/affiliates";
import { checkDistributedRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { slugifyStore } from "@/lib/admin/stores";

export async function GET(request: NextRequest) {
  const limit = await checkDistributedRateLimit({ key: `affiliate-code:${getClientIp(request)}`, limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "Intenta mas tarde." }, { status: 429 });
  const code = normalizeAffiliateCode(new URL(request.url).searchParams.get("code"));
  if (!code || code.length > 100) return NextResponse.json({ valid: false });
  const db = createSupabaseAdminClient();
  const { data, error } = isValidAffiliateCode(code)
    ? await db.from("affiliate_codes")
      .select("status, starts_at, expires_at, max_uses, used_count, discount_percent")
      .eq("code", code).maybeSingle()
    : { data: null, error: null };
  if (error) return NextResponse.json({ error: "No se pudo validar el codigo." }, { status: 500 });
  if (data) {
    if (!isAffiliateCodeAvailable(data)) return NextResponse.json({ valid: false });
    return NextResponse.json({ valid: true, kind: "affiliate", discountPercent: Number(data.discount_percent), dueUsd: setupDueUsd(Number(data.discount_percent)) });
  }
  const { data: store, error: storeError } = await db.from("stores").select("id").eq("slug", slugifyStore(code)).maybeSingle();
  if (storeError) return NextResponse.json({ error: "No se pudo validar el codigo." }, { status: 500 });
  return NextResponse.json(store ? { valid: true, kind: "store", discountPercent: 0, dueUsd: 20 } : { valid: false });
}
