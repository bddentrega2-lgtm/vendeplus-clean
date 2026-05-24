import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPanelAuthContext } from "@/lib/panel/auth";

function unauthorized(message = "No autorizado.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

function canAccessStore(storeIds: string[] | null, storeId?: string) {
  if (storeIds === null) return true;
  return Boolean(storeId && storeIds.includes(storeId));
}

function normalizeProductPayload(body: any) {
  return {
    store_id: body.store_id,
    category_id: body.category_id || null,
    name: String(body.name || "").trim(),
    description: body.description ? String(body.description).trim() : null,
    price_usd: Number(body.price_usd || 0),
    image_url: body.image_url ? String(body.image_url).trim() : null,
    is_available: Boolean(body.is_available),
    is_featured: Boolean(body.is_featured),
    sort_order: Number(body.sort_order || 0),
  };
}

export async function GET(request: NextRequest) {
  const auth = await getPanelAuthContext(request);
  if (!auth.isAuthorized) return unauthorized(auth.error);

  try {
    const supabase = createSupabaseAdminClient();

    let storesQuery = supabase
      .from("stores")
      .select("id, slug, name, whatsapp, address, latitude, longitude, is_active, accepts_delivery, accepts_pickup")
      .order("name", { ascending: true });

    let categoriesQuery = supabase
      .from("categories")
      .select("id, store_id, name, sort_order, is_active")
      .order("sort_order", { ascending: true });

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
        stores(name),
        categories(name)
      `
      )
      .order("sort_order", { ascending: true });

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
      { error: error.message || "Error cargando productos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await getPanelAuthContext(request);
  if (!auth.isAuthorized) return unauthorized(auth.error);

  try {
    const body = await request.json();
    const payload = normalizeProductPayload(body);

    if (!payload.store_id) {
      return NextResponse.json(
        { error: "Selecciona un comercio." },
        { status: 400 }
      );
    }

    if (!canAccessStore(auth.storeIds, payload.store_id)) {
      return NextResponse.json(
        { error: "No tienes permiso para crear productos en este comercio." },
        { status: 403 }
      );
    }

    if (!payload.name) {
      return NextResponse.json(
        { error: "El nombre del producto es obligatorio." },
        { status: 400 }
      );
    }

    if (payload.price_usd < 0) {
      return NextResponse.json(
        { error: "El precio no puede ser negativo." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ product: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error creando producto." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await getPanelAuthContext(request);
  if (!auth.isAuthorized) return unauthorized(auth.error);

  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Falta el ID del producto." },
        { status: 400 }
      );
    }

    const payload = normalizeProductPayload(body);

    if (!payload.name) {
      return NextResponse.json(
        { error: "El nombre del producto es obligatorio." },
        { status: 400 }
      );
    }

    if (!canAccessStore(auth.storeIds, payload.store_id)) {
      return NextResponse.json(
        { error: "No tienes permiso para editar productos de este comercio." },
        { status: 403 }
      );
    }

    const supabase = createSupabaseAdminClient();

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

    const { data, error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", body.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ product: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error actualizando producto." },
      { status: 500 }
    );
  }
}

