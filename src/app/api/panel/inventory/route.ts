import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
  assertStoreManager,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";

const SHIBUI_STORE_ID = "126f8168-f1ca-4a08-8eaf-c3816b9d9195";

function cleanAttributes(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => [String(key).trim().toLocaleLowerCase("es").slice(0, 40), String(item || "").trim().slice(0, 80)])
    .filter(([key, item]) => key && item)
    .slice(0, 5);
  return entries.length ? Object.fromEntries(entries) : null;
}

function skuCode(productId: string, attributes: Record<string, string>, index: number) {
  const digest = createHash("sha256")
    .update(`${productId}:${JSON.stringify(attributes)}:${index}`)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();
  return `INV-${productId.slice(0, 8).toUpperCase()}-${digest}`;
}

async function requireInventoryPilot(storeId: string) {
  if (storeId !== SHIBUI_STORE_ID) throw new Error("Inventario Premium todavía está en piloto.");
  const supabase = createSupabaseAdminClient();
  const [{ data: store, error: storeError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("stores").select("id, slug").eq("id", storeId).single(),
    supabase.from("store_inventory_settings").select("enabled").eq("store_id", storeId).maybeSingle(),
  ]);
  if (storeError) throw storeError;
  if (settingsError) throw settingsError;
  if (store?.slug !== "shibui" || settings?.enabled !== true) {
    throw new Error("Inventario Premium no está habilitado para este comercio.");
  }
  return supabase;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const storeId = String(request.nextUrl.searchParams.get("storeId") || "");
    const productId = String(request.nextUrl.searchParams.get("productId") || "");
    if (!storeId) return badRequest("Falta el comercio.");
    assertStoreAccess(auth, storeId);
    const supabase = await requireInventoryPilot(storeId);
    let query = supabase
      .from("inventory_movements")
      .select("id, product_id, sku_id, movement_type, quantity_delta, stock_after, reference, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (productId) query = query.eq("product_id", productId);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ movements: data || [] });
  } catch (error: unknown) {
    return panelErrorResponse(error, "No se pudo cargar el historial de inventario.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const storeId = String(body.store_id || "");
    const productId = String(body.product_id || "");
    if (!storeId || !productId) return badRequest("Falta el comercio o el producto.");
    assertStoreManager(auth, storeId, "Solo owner o admin pueden ajustar el inventario.");
    const supabase = await requireInventoryPilot(storeId);

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("store_id", storeId)
      .single();
    if (productError || !product) return badRequest("El producto no pertenece a SHIBUI.");

    const rawSkus = Array.isArray(body.skus) ? body.skus.slice(0, 500) : [];
    const skus = rawSkus.map((sku: any, index: number) => {
      const attributes = cleanAttributes(sku.attributes);
      const stock = Number(sku.stock_on_hand);
      if (!attributes || !Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
        throw new Error("Hay una combinación o cantidad inválida.");
      }
      const id = String(sku.id || "");
      return {
        id: id.startsWith("preview-") ? null : id || null,
        code: id && !id.startsWith("preview-") ? String(sku.code || "").trim().slice(0, 120) : skuCode(productId, attributes, index),
        attributes,
        stock_on_hand: stock,
      };
    });
    const presentations = (Array.isArray(body.presentations) ? body.presentations : [])
      .slice(0, 50)
      .map((variant: any) => ({
        id: String(variant.id || ""),
        inventory_units: Math.floor(Number(variant.inventory_units || 1)),
      }));
    if (presentations.some((variant: any) => !variant.id || variant.inventory_units < 1 || variant.inventory_units > 50)) {
      return badRequest("Hay una presentación inválida.");
    }

    const { data, error } = await supabase.rpc("manage_inventory_product", {
      p_store_id: storeId,
      p_product_id: productId,
      p_skus: skus,
      p_presentations: presentations,
      p_actor_user_id: auth.userId || null,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, result: data });
  } catch (error: unknown) {
    return panelErrorResponse(error, "No se pudo guardar el inventario. La función sigue protegida hasta completar la migración.");
  }
}
