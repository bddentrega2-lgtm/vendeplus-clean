import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreManager,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { getPlan } from "@/lib/plans";

const productsSelect = `
  id,
  store_id,
  category_id,
  name,
  description,
  price_usd,
  discount_percent,
  image_url,
  is_available,
  is_featured,
  sort_order,
  stores(name),
  categories(name),
  product_variants (
    id,
    product_id,
    name,
    price_usd,
    is_available,
    sort_order
  ),
  product_option_group_products (
    product_option_groups (
      id,
      name
    )
  )
`;

const legacyProductsSelect = `
  id,
  store_id,
  category_id,
  name,
  description,
  price_usd,
  discount_percent,
  image_url,
  is_available,
  is_featured,
  sort_order,
  stores(name),
  categories(name)
`;

type NormalizedVariant = {
  id: string | null;
  name: string;
  price_usd: number;
  is_available: boolean;
  sort_order: number;
};

type ProductImageInput = { image_url: string; alt_text: string | null; sort_order: number };
const maxProductImages = 2;

function normalizeProductImages(body: any, primaryImageUrl: string | null): ProductImageInput[] {
  const extra = Array.isArray(body.product_images) ? body.product_images : [];
  return [primaryImageUrl, ...extra.map((image: any) => typeof image === "string" ? image : image?.image_url)]
    .map((url) => String(url || "").trim())
    .filter((url, index, urls) => Boolean(url) && urls.indexOf(url) === index)
    .slice(0, maxProductImages)
    .map((image_url, sort_order) => ({ image_url, alt_text: String(body.name || "").trim() || null, sort_order }));
}

async function attachProductImages(supabase: ReturnType<typeof createSupabaseAdminClient>, products: any[]) {
  const ids = products.map((product) => product.id).filter(Boolean);
  if (!ids.length) return products;
  const { data, error } = await supabase.from("product_images")
    .select("id, product_id, store_id, image_url, alt_text, sort_order, is_active")
    .in("product_id", ids).eq("is_active", true).order("sort_order");
  if (error) throw error;
  const imagesByProductId = new Map<string, any[]>();
  for (const image of data || []) {
    const productId = String(image.product_id || "");
    if (!productId) continue;
    const current = imagesByProductId.get(productId) || [];
    current.push(image);
    imagesByProductId.set(productId, current);
  }
  return products.map((product) => ({
    ...product,
    product_images: imagesByProductId.get(String(product.id)) || [],
  }));
}

async function syncProductImages(supabase: ReturnType<typeof createSupabaseAdminClient>, productId: string, storeId: string, images: ProductImageInput[]) {
  const { error: deleteError } = await supabase.from("product_images").delete().eq("product_id", productId);
  if (deleteError) throw deleteError;
  if (!images.length) return;
  const { error } = await supabase.from("product_images").insert(images.map((image) => ({ ...image, product_id: productId, store_id: storeId })));
  if (error) throw error;
}

function normalizeVariants(body: any): NormalizedVariant[] {
  const variants = Array.isArray(body.variants) ? body.variants : [];

  return variants
    .map((variant: any, index: number) => ({
      id: variant.id ? String(variant.id) : null,
      name: String(variant.name || "").trim(),
      price_usd: Number(variant.price_usd || 0),
      is_available: variant.is_available !== false,
      sort_order: Number.isFinite(Number(variant.sort_order))
        ? Number(variant.sort_order)
        : index + 1,
    }))
    .filter((variant: NormalizedVariant) => variant.name);
}

function normalizeProductPayload(body: any) {
  return {
    store_id: body.store_id,
    category_id: body.category_id || null,
    name: String(body.name || "").trim(),
    description: body.description ? String(body.description).trim() : null,
    price_usd: Number(body.price_usd || 0),
    discount_percent: Math.max(0, Math.min(95, Number(body.discount_percent || 0))),
    image_url: body.image_url ? String(body.image_url).trim() : null,
    is_available: Boolean(body.is_available),
    is_featured: Boolean(body.is_featured),
    sort_order: Number(body.sort_order || 0),
  };
}

function validateVariants(variants: NormalizedVariant[]) {
  for (const variant of variants) {
    if (variant.price_usd < 0) {
      return "El precio de una presentación no puede ser negativo.";
    }
  }

  return "";
}

async function syncProductVariants(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  productId: string,
  variants: NormalizedVariant[]
) {
  const { data: existingRows, error: existingError } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);

  if (existingError) throw existingError;

  const existingIds = new Set((existingRows || []).map((row: any) => String(row.id)));
  const submittedIds = new Set(
    variants
      .map((variant) => variant.id)
      .filter((id): id is string => Boolean(id) && existingIds.has(String(id)))
  );

  const rowsToInsert = variants
    .filter((variant) => !variant.id || !existingIds.has(String(variant.id)))
    .map((variant, index) => ({
      product_id: productId,
      name: variant.name,
      price_usd: variant.price_usd,
      is_available: variant.is_available,
      sort_order: variant.sort_order || index + 1,
    }));

  const rowsToUpdate = variants.filter(
    (variant) => variant.id && existingIds.has(String(variant.id))
  );

  const updateResults = await Promise.all(
    rowsToUpdate.map((variant) =>
      supabase
        .from("product_variants")
        .update({
          name: variant.name,
          price_usd: variant.price_usd,
          is_available: variant.is_available,
          sort_order: variant.sort_order,
        })
        .eq("id", variant.id)
        .eq("product_id", productId)
    )
  );

  const updateError = updateResults.find((result) => result.error)?.error;
  if (updateError) throw updateError;

  const removedIds = [...existingIds].filter((id) => !submittedIds.has(id));
  if (removedIds.length) {
    const { error } = await supabase
      .from("product_variants")
      .update({ is_available: false })
      .in("id", removedIds)
      .eq("product_id", productId);

    if (error) throw error;
  }

  if (rowsToInsert.length) {
    const { error } = await supabase.from("product_variants").insert(rowsToInsert);
    if (error) throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get("search") || "").trim();
    const limit = Math.min(
      250,
      Math.max(25, Number(searchParams.get("limit") || 120))
    );
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));

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
      .select(productsSelect)
      .order("sort_order", { ascending: true })
      .range(offset, offset + limit - 1);

    if (auth.storeIds !== null) {
      storesQuery = storesQuery.in("id", auth.storeIds);
      categoriesQuery = categoriesQuery.in("store_id", auth.storeIds);
      productsQuery = productsQuery.in("store_id", auth.storeIds);
    }

    if (search) {
      productsQuery = productsQuery.ilike("name", `%${search}%`);
    }

    const [storesResult, categoriesResult, productsResult] = await Promise.all([
      storesQuery,
      categoriesQuery,
      productsQuery,
    ]);

    if (storesResult.error) throw storesResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    let products: any[] = productsResult.data || [];
    let productsError = productsResult.error;

    if (productsError) {
      let fallbackProductsQuery = supabase
        .from("products")
        .select(legacyProductsSelect)
        .order("sort_order", { ascending: true })
        .range(offset, offset + limit - 1);

      if (auth.storeIds !== null) {
        fallbackProductsQuery = fallbackProductsQuery.in("store_id", auth.storeIds);
      }

      if (search) {
        fallbackProductsQuery = fallbackProductsQuery.ilike("name", `%${search}%`);
      }

      const fallbackResult = await fallbackProductsQuery;
      products = fallbackResult.data || [];
      productsError = fallbackResult.error;
    }

    if (productsError) throw productsError;

    products = await attachProductImages(supabase, products);
    return NextResponse.json({
      stores: storesResult.data || [],
      categories: categoriesResult.data || [],
      products,
      page: {
        limit,
        offset,
        hasMore: products.length === limit,
      },
      auth: {
        mode: auth.mode,
        email: auth.email || null,
        role: auth.role || null,
      },
    });
  } catch (error: any) {
    return panelErrorResponse(error, "Error cargando productos.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const payload = normalizeProductPayload(body);
    const variants = normalizeVariants(body);
    const productImages = normalizeProductImages(body, payload.image_url);

    if (!payload.store_id) {
      return badRequest("Selecciona un comercio.");
    }

    assertStoreManager(
      auth,
      payload.store_id,
      "No tienes permiso para crear productos en este comercio."
    );

    if (!payload.name) {
      return badRequest("El nombre del producto es obligatorio.");
    }

    if (payload.price_usd < 0) {
      return badRequest("El precio no puede ser negativo.");
    }

    const variantError = validateVariants(variants);
    if (variantError) {
      return badRequest(variantError);
    }

    const supabase = createSupabaseAdminClient();

    const [{ data: store, error: storeError }, { count: productCount, error: countError }] =
      await Promise.all([
        supabase
          .from("stores")
          .select("id, plan_type")
          .eq("id", payload.store_id)
          .single(),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("store_id", payload.store_id),
      ]);

    if (storeError) throw storeError;
    if (countError) throw countError;

    const plan = getPlan((store as any)?.plan_type);
    if ((productCount || 0) >= plan.productLimit) {
      return badRequest(`Este plan permite hasta ${plan.productLimit} productos.`);
    }

    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await syncProductVariants(supabase, data.id, variants);
    await syncProductImages(supabase, data.id, payload.store_id, productImages);

    return NextResponse.json({ product: data });
  } catch (error: any) {
    return panelErrorResponse(error, "Error creando producto.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();

    if (!body.id) {
      return badRequest("Falta el ID del producto.");
    }

    const payload = normalizeProductPayload(body);
    const variants = normalizeVariants(body);
    const productImages = normalizeProductImages(body, payload.image_url);

    if (!payload.name) {
      return badRequest("El nombre del producto es obligatorio.");
    }

    const variantError = validateVariants(variants);
    if (variantError) {
      return badRequest(variantError);
    }

    assertStoreManager(
      auth,
      payload.store_id,
      "No tienes permiso para editar productos de este comercio."
    );

    const supabase = createSupabaseAdminClient();

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

    const { data, error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", body.id)
      .select()
      .single();

    if (error) throw error;

    await syncProductVariants(supabase, body.id, variants);
    await syncProductImages(supabase, body.id, payload.store_id, productImages);

    return NextResponse.json({ product: data });
  } catch (error: any) {
    return panelErrorResponse(error, "Error actualizando producto.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();

    if (!body.id) {
      return badRequest("Falta el ID del producto.");
    }

    const supabase = createSupabaseAdminClient();

    const { data: existingProduct, error: existingError } = await supabase
      .from("products")
      .select("id, store_id")
      .eq("id", body.id)
      .single();

    if (existingError) throw existingError;

    assertStoreManager(
      auth,
      existingProduct.store_id,
      "No tienes permiso para eliminar este producto."
    );

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", body.id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return panelErrorResponse(error, "Error eliminando producto.");
  }
}

