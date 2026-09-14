import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function cleanIds(value: string | null) {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 40);
}

function isMissingSuggestionColumn(error: any) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42703" || message.includes("is_cart_suggestion");
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const storeSlug = String(searchParams.get("storeSlug") || "").trim();
  const cartProductIds = cleanIds(searchParams.get("productIds"));
  const excludedProductIds = new Set(cartProductIds);

  if (!storeSlug) {
    return NextResponse.json({ productIds: [] });
  }

  try {
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", storeSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (storeError) throw storeError;
    if (!store?.id) return NextResponse.json({ productIds: [] });

    const storeId = String(store.id);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, sort_order")
        .eq("store_id", storeId)
        .eq("is_available", true)
        .eq("is_cart_suggestion", true)
        .order("sort_order", { ascending: true })
        .limit(20);

      if (error) throw error;

      return NextResponse.json({
        productIds: (data || [])
          .map((row: any) => String(row.id || ""))
          .filter((productId) => productId && !excludedProductIds.has(productId))
          .slice(0, 12),
      });
    } catch (error: any) {
      if (!isMissingSuggestionColumn(error)) throw error;
    }

    return NextResponse.json({ productIds: [] });
  } catch (error) {
    console.warn("Cart suggestions unavailable:", error);
    return NextResponse.json({ productIds: [] });
  }
}
