import { NextRequest, NextResponse } from "next/server";
import { isStoreSubscriptionPastDue, mapOptionGroups } from "@/lib/supabase/catalog";
import { createSupabasePublicClient } from "@/lib/supabase/server";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const supabase = createSupabasePublicClient();
  if (!supabase) {
    return NextResponse.json({ optionGroups: [] });
  }

  const { searchParams } = new URL(request.url);
  const storeSlug = String(searchParams.get("storeSlug") || "").trim();
  const productId = String(searchParams.get("productId") || "").trim();

  if (!storeSlug || !productId) {
    return badRequest("Falta el producto.");
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, is_active, subscription_status, trial_ends_at, subscription_ends_at, next_payment_due_at")
    .eq("slug", storeSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (storeError) throw storeError;
  if (!store?.id || isStoreSubscriptionPastDue(store)) {
    return NextResponse.json({ optionGroups: [] }, { status: 404 });
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select(
      `
      id,
      store_id,
      is_available,
      product_option_group_products (
        id,
        sort_order,
        product_option_groups (
          id,
          name,
          description,
          selection_type,
          required,
          min_select,
          max_select,
          is_active,
          sort_order,
          product_option_values (
            id,
            name,
            description,
            price_delta_usd,
            is_active,
            sort_order,
            product_option_value_variant_prices (
              variant_id,
              price_delta_usd
            )
          )
        )
      )
    `
    )
    .eq("id", productId)
    .eq("store_id", store.id)
    .eq("is_available", true)
    .maybeSingle();

  if (productError) throw productError;
  if (!product) {
    return NextResponse.json({ optionGroups: [] }, { status: 404 });
  }

  const response = NextResponse.json({
    optionGroups: mapOptionGroups(product),
  });
  response.headers.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
  return response;
}
