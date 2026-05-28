import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPanelAuthContext } from "@/lib/panel/auth";

function unauthorized(message = "No autorizado.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

function canAccessStore(storeIds: string[] | null, storeId?: string | null) {
  if (storeIds === null) return true;
  return Boolean(storeId && storeIds.includes(storeId));
}

function cleanName(value: unknown) {
  return String(value || "").trim();
}

function toSafeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const auth = await getPanelAuthContext(request);
  if (!auth.isAuthorized) return unauthorized(auth.error);

  try {
    const supabase = createSupabaseAdminClient();

    let storesQuery = supabase
      .from("stores")
      .select("id, slug, name, whatsapp, address, is_active, accepts_delivery, accepts_pickup")
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
    return NextResponse.json(
      { error: error.message || "Error cargando catálogo." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await getPanelAuthContext(request);
  if (!auth.isAuthorized) return unauthorized(auth.error);

  try {
    const body = await request.json();

    const payload = {
      store_id: String(body.store_id || ""),
      name: cleanName(body.name),
      sort_order: toSafeNumber(body.sort_order, 0),
      is_active: body.is_active !== false,
    };

    if (!payload.store_id) {
      return NextResponse.json(
        { error: "Selecciona un comercio." },
        { status: 400 }
      );
    }

    if (!canAccessStore(auth.storeIds, payload.store_id)) {
      return NextResponse.json(
        { error: "No tienes permiso para crear categorías en este comercio." },
        { status: 403 }
      );
    }

    if (!payload.name) {
      return NextResponse.json(
        { error: "El nombre de la categoría es obligatorio." },
        { status: 400 }
      );
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
    return NextResponse.json(
      { error: error.message || "Error creando categoría." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await getPanelAuthContext(request);
  if (!auth.isAuthorized) return unauthorized(auth.error);

  try {
    const body = await request.json();
    const resource = String(body.resource || "");

    if (!body.id) {
      return NextResponse.json(
        { error: "Falta el ID del recurso." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    if (resource === "category") {
      const { data: existingCategory, error: existingError } = await supabase
        .from("categories")
        .select("id, store_id")
        .eq("id", body.id)
        .single();

      if (existingError) throw existingError;

      if (!canAccessStore(auth.storeIds, existingCategory.store_id)) {
        return NextResponse.json(
          { error: "No tienes permiso para editar esta categoría." },
          { status: 403 }
        );
      }

      const payload: Record<string, any> = {};

      if (body.name !== undefined) {
        const name = cleanName(body.name);

        if (!name) {
          return NextResponse.json(
            { error: "El nombre de la categoría no puede estar vacío." },
            { status: 400 }
          );
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

      if (!canAccessStore(auth.storeIds, existingProduct.store_id)) {
        return NextResponse.json(
          { error: "No tienes permiso para editar este producto." },
          { status: 403 }
        );
      }

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

    return NextResponse.json(
      { error: "Recurso no soportado." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error actualizando catálogo." },
      { status: 500 }
    );
  }
}
