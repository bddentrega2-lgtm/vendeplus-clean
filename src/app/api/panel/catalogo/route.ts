import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
  assertStoreManager,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";

function cleanName(value: unknown) {
  return String(value || "").trim();
}

function toSafeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();
    const requestedStoreId = String(request.headers.get("x-panel-store-id") || "").trim();

    if (requestedStoreId) {
      assertStoreAccess(auth, requestedStoreId, "No tienes permiso para consultar esta sede.");
    }

    let storesQuery = supabase
      .from("stores")
      .select("id, slug, name, whatsapp, address, cover_image_url, payment_methods, is_active, accepts_delivery, accepts_pickup")
      .order("name", { ascending: true });

    let categoriesQuery = supabase
      .from("categories")
      .select("id, store_id, name, sort_order, is_active, created_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    let productsQuery = supabase
      .from("products")
      .select(
        `
        id,
        store_id,
        category_id,
        name,
        description,
        price_usd,
        image_url,
        is_available,
        is_featured,
        sort_order,
        created_at,
        stores(name, slug),
        categories(name),
        product_variants(id, name, price_usd, is_available, sort_order)
      `
      )
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (auth.storeIds !== null) {
      storesQuery = storesQuery.in("id", auth.storeIds);
      categoriesQuery = categoriesQuery.in("store_id", auth.storeIds);
      productsQuery = productsQuery.in("store_id", auth.storeIds);
    }

    if (requestedStoreId) {
      storesQuery = storesQuery.eq("id", requestedStoreId);
      categoriesQuery = categoriesQuery.eq("store_id", requestedStoreId);
      productsQuery = productsQuery.eq("store_id", requestedStoreId);
    }

    const [storesResult, categoriesResult, productsResult] = await Promise.all([
      storesQuery,
      categoriesQuery,
      productsQuery,
    ]);

    if (storesResult.error) throw storesResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (productsResult.error) throw productsResult.error;

    let stores = storesResult.data || [];
    let products = productsResult.data || [];
    try {
      const storeIds = stores.map((store: any) => String(store.id));
      const settingsResult = storeIds.length
        ? await supabase
            .from("store_inventory_settings")
            .select("store_id, enabled")
            .in("store_id", storeIds)
            .eq("enabled", true)
        : { data: [], error: null };
      if (!settingsResult.error) {
        const enabledStoreIds = new Set((settingsResult.data || []).map((row: any) => String(row.store_id)));
        const managedProductIds = products
          .filter((product: any) => enabledStoreIds.has(String(product.store_id)))
          .map((product: any) => String(product.id));
        if (managedProductIds.length) {
          const [skusResult, inventoryVariantsResult] = await Promise.all([
            supabase
              .from("product_inventory_skus")
              .select("id, store_id, product_id, code, attributes, stock_on_hand, is_active")
              .in("product_id", managedProductIds),
            supabase
              .from("product_variants")
              .select("id, product_id, inventory_units")
              .in("product_id", managedProductIds),
          ]);
          if (!skusResult.error && !inventoryVariantsResult.error) {
            const skusByProduct = new Map<string, any[]>();
            for (const sku of skusResult.data || []) {
              const productId = String((sku as any).product_id);
              skusByProduct.set(productId, [...(skusByProduct.get(productId) || []), sku]);
            }
            const unitsByVariant = new Map(
              (inventoryVariantsResult.data || []).map((variant: any) => [String(variant.id), Number(variant.inventory_units || 1)])
            );
            stores = stores.map((store: any) => ({
              ...store,
              inventory_enabled: enabledStoreIds.has(String(store.id)),
            }));
            products = products.map((product: any) => ({
              ...product,
              product_inventory_skus: skusByProduct.get(String(product.id)) || [],
              product_variants: (product.product_variants || []).map((variant: any) => ({
                ...variant,
                inventory_units: unitsByVariant.get(String(variant.id)) || 1,
              })),
            }));
          }
        }
      }
    } catch {
      // Compatibilidad antes de aplicar la migración: catálogo y pedidos siguen igual.
    }

    return NextResponse.json({
      stores,
      categories: categoriesResult.data || [],
      products,
      auth: {
        mode: auth.mode,
        email: auth.email || null,
        role: auth.role || null,
      },
    });
  } catch (error: any) {
    return panelErrorResponse(error, "Error cargando catálogo.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();

    const payload = {
      store_id: String(body.store_id || ""),
      name: cleanName(body.name),
      sort_order: toSafeNumber(body.sort_order, 0),
      is_active: body.is_active !== false,
    };

    if (!payload.store_id) {
      return badRequest("Selecciona un comercio.");
    }

    assertStoreManager(
      auth,
      payload.store_id,
      "No tienes permiso para crear categorías en este comercio."
    );

    if (!payload.name) {
      return badRequest("El nombre de la categoría es obligatorio.");
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("categories")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ category: data });
  } catch (error: any) {
    return panelErrorResponse(error, "Error creando categoría.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const resource = String(body.resource || "");

    if (!body.id) {
      return badRequest("Falta el ID del recurso.");
    }

    const supabase = createSupabaseAdminClient();

    if (resource === "category") {
      const { data: existingCategory, error: existingError } = await supabase
        .from("categories")
        .select("id, store_id")
        .eq("id", body.id)
        .single();

      if (existingError) throw existingError;

      assertStoreManager(
        auth,
        existingCategory.store_id,
        "No tienes permiso para editar esta categoría."
      );

      const payload: Record<string, any> = {};

      if (body.name !== undefined) {
        const name = cleanName(body.name);

        if (!name) {
          return badRequest("El nombre de la categoría no puede estar vacío.");
        }

        payload.name = name;
      }

      if (body.sort_order !== undefined) {
        payload.sort_order = toSafeNumber(body.sort_order, 0);
      }

      if (body.is_active !== undefined) {
        payload.is_active = Boolean(body.is_active);
      }

      const { data, error } = await supabase
        .from("categories")
        .update(payload)
        .eq("id", body.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ category: data });
    }

    if (resource === "product") {
      const { data: existingProduct, error: existingError } = await supabase
        .from("products")
        .select("id, store_id")
        .eq("id", body.id)
        .single();

      if (existingError) throw existingError;

      assertStoreManager(
        auth,
        existingProduct.store_id,
        "No tienes permiso para editar este producto."
      );

      const payload: Record<string, any> = {};

      if (body.category_id !== undefined) {
        payload.category_id = body.category_id || null;
      }

      if (body.is_available !== undefined) {
        payload.is_available = Boolean(body.is_available);
      }

      if (body.is_featured !== undefined) {
        payload.is_featured = Boolean(body.is_featured);
      }

      if (body.sort_order !== undefined) {
        payload.sort_order = toSafeNumber(body.sort_order, 0);
      }

      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", body.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ product: data });
    }

    return badRequest("Recurso no soportado.");
  } catch (error: any) {
    return panelErrorResponse(error, "Error actualizando catálogo.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const resource = String(body.resource || "");

    if (!body.id) {
      return badRequest("Falta el ID del recurso.");
    }

    const supabase = createSupabaseAdminClient();

    if (resource === "category") {
      const { data: existingCategory, error: existingError } = await supabase
        .from("categories")
        .select("id, store_id")
        .eq("id", body.id)
        .single();

      if (existingError) throw existingError;

      assertStoreManager(
        auth,
        existingCategory.store_id,
        "No tienes permiso para eliminar esta categoría."
      );

      const { error: productsError } = await supabase
        .from("products")
        .update({ category_id: null })
        .eq("category_id", body.id)
        .eq("store_id", existingCategory.store_id);

      if (productsError) throw productsError;

      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", body.id);

      if (error) throw error;

      return NextResponse.json({ ok: true });
    }

    return badRequest("Recurso no soportado.");
  } catch (error: any) {
    return panelErrorResponse(error, "Error eliminando catálogo.");
  }
}
