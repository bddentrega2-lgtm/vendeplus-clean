import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
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
        categories(name)
      `
      )
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (auth.storeIds !== null) {
      storesQuery = storesQuery.in("id", auth.storeIds);
      categoriesQuery = categoriesQuery.in("store_id", auth.storeIds);
      productsQuery = productsQuery.in("store_id", auth.storeIds);
    }

    const [storesResult, categoriesResult, productsResult] = await Promise.all([
      storesQuery,
      categoriesQuery,
      productsQuery,
    ]);

    if (storesResult.error) throw storesResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (productsResult.error) throw productsResult.error;

    return NextResponse.json({
      stores: storesResult.data || [],
      categories: categoriesResult.data || [],
      products: productsResult.data || [],
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

    assertStoreAccess(
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

      assertStoreAccess(
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

      assertStoreAccess(
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

      assertStoreAccess(
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
