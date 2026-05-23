import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: NextRequest) {
  const expectedPin = process.env.PANEL_ACCESS_PIN;
  const receivedPin = request.headers.get("x-panel-pin");

  return Boolean(expectedPin && receivedPin && receivedPin === expectedPin);
}

function unauthorized() {
  return NextResponse.json(
    { error: "PIN inválido o no autorizado." },
    { status: 401 }
  );
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
  if (!isAuthorized(request)) return unauthorized();

  try {
    const supabase = createSupabaseAdminClient();

    const [storesResult, categoriesResult, productsResult] = await Promise.all([
      supabase
        .from("stores")
        .select("id, slug, name")
        .order("name", { ascending: true }),

      supabase
        .from("categories")
        .select("id, store_id, name, sort_order, is_active")
        .order("sort_order", { ascending: true }),

      supabase
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
        .order("sort_order", { ascending: true }),
    ]);

    if (storesResult.error) throw storesResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (productsResult.error) throw productsResult.error;

    return NextResponse.json({
      stores: storesResult.data || [],
      categories: categoriesResult.data || [],
      products: productsResult.data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error cargando productos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  try {
    const body = await request.json();
    const payload = normalizeProductPayload(body);

    if (!payload.store_id) {
      return NextResponse.json(
        { error: "Selecciona un comercio." },
        { status: 400 }
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
  if (!isAuthorized(request)) return unauthorized();

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

    const supabase = createSupabaseAdminClient();

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
