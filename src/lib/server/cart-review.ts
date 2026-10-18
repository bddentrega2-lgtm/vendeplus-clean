import type { CartItem } from "@/types";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reviewCartRows } from "@/lib/cart-review";
const MAX_ORDER_ITEMS = 80;
const MAX_ITEM_QUANTITY = 99;
function cleanText(value: unknown, maxLength = 500) { return String(value || "").trim().slice(0, maxLength); }
function toSafeNumber(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function isUuid(value?: string) { return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)); }

export function normalizeItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      productId: cleanText(item?.productId),
      productName: cleanText(item?.productName, 140),
      productSlug: cleanText(item?.productSlug, 140),
      productImageUrl: cleanText(item?.productImageUrl, 1000),
      variantId: cleanText(item?.variantId) || undefined,
      variantName: cleanText(item?.variantName, 140) || undefined,
      quantity: Math.min(
        MAX_ITEM_QUANTITY,
        Math.max(1, Math.floor(toSafeNumber(item?.quantity, 1)))
      ),
      unitPriceUsd: toSafeNumber(item?.unitPriceUsd, 0),
      notes: cleanText(item?.notes, 280) || undefined,
          selectedOptions: Array.isArray(item?.selectedOptions)
        ? item.selectedOptions.slice(0, 50).map((option: any) => ({
            groupId: cleanText(option?.groupId),
            groupName: cleanText(option?.groupName, 140),
            valueId: cleanText(option?.valueId),
            valueName: cleanText(option?.valueName, 140),
            priceDeltaUsd: toSafeNumber(option?.priceDeltaUsd, 0),
            quantity: Math.min(50, Math.max(1, Math.floor(toSafeNumber(option?.quantity, 1)))),
          }))
        : [],
      inventorySelections: Array.isArray(item?.inventorySelections)
        ? item.inventorySelections
            .map((selection: any) => ({
              skuId: cleanText(selection?.skuId),
              label: cleanText(selection?.label, 180) || undefined,
              quantity: Math.min(
                MAX_ITEM_QUANTITY,
                Math.max(1, Math.floor(toSafeNumber(selection?.quantity, 1)))
              ),
            }))
            .filter((selection: any) => isUuid(selection.skuId))
        : [],
    }))
    .slice(0, MAX_ORDER_ITEMS)
    .filter((item) => item.productId);
}

async function loadOptionAssignments(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  storeId: string,
  productIds: string[]
) {
  const { data, error } = await supabase
    .from("product_option_group_products")
    .select(
      `
      product_id,
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
    `
    )
    .eq("store_id", storeId)
    .in("product_id", productIds);

  if (error) throw error;

  const byProduct = new Map<string, any[]>();
  for (const assignment of data || []) {
    const productId = String((assignment as any).product_id);
    const current = byProduct.get(productId) || [];
    current.push(assignment);
    byProduct.set(productId, current);
  }

  return byProduct;
}


export async function reviewStoredCart(supabase: ReturnType<typeof createSupabaseAdminClient>, storeId: string, items: CartItem[]) {
  const productIds = [...new Set(items.map(item => item.productId).filter(isUuid))];
  if (!productIds.length) return reviewCartRows(items, [], [], []);
  const { data: products, error } = await supabase.from("products")
    .select("id, store_id, name, price_usd, discount_percent, image_url, is_available")
    .eq("store_id", storeId).in("id", productIds);
  if (error) throw error;
  const ownIds = (products || []).map(product => String(product.id));
  if (!ownIds.length) return reviewCartRows(items, [], [], []);
  const [variantResult, assignments] = await Promise.all([
    supabase.from("product_variants").select("id, product_id, name, price_usd, is_available").in("product_id", ownIds),
    loadOptionAssignments(supabase, storeId, ownIds),
  ]);
  if (variantResult.error) throw variantResult.error;
  return reviewCartRows(items, products || [], variantResult.data || [], [...assignments.values()].flat());
}
