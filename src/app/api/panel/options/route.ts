import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
  assertStoreManager,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function toSafeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeVariantName(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeVariantPricesByName(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return new Map<string, number>();
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([name, price]) => {
      const normalizedName = normalizeVariantName(name);
      const parsedPrice = Number(price);
      if (!normalizedName || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return null;
      }

      return [normalizedName, parsedPrice] as const;
    })
    .filter(Boolean) as Array<readonly [string, number]>;

  return new Map(entries);
}

function normalizeGroupPayload(body: any) {
  const selectionType = body.selection_type === "multiple" ? "multiple" : "single";
  const required = Boolean(body.required);
  const minSelect = Math.max(0, Math.floor(toSafeNumber(body.min_select, required ? 1 : 0)));
  const maxSelect =
    selectionType === "single"
      ? 1
      : Math.max(0, Math.floor(toSafeNumber(body.max_select, 0)));

  return {
    store_id: cleanText(body.store_id),
    name: cleanText(body.name),
    description: cleanText(body.description) || null,
    selection_type: selectionType,
    required,
    min_select: required ? Math.max(1, minSelect) : minSelect,
    max_select: maxSelect,
    sort_order: Math.floor(toSafeNumber(body.sort_order, 0)),
    is_active: body.is_active !== false,
  };
}

async function getGroupStoreId(supabase: any, groupId: string) {
  const { data, error } = await supabase
    .from("product_option_groups")
    .select("id, store_id")
    .eq("id", groupId)
    .single();

  if (error) throw error;
  return cleanText(data?.store_id);
}

async function replaceValueVariantPrices({
  supabase,
  optionValueId,
  groupId,
  storeId,
  variantPricesByName,
}: {
  supabase: any;
  optionValueId: string;
  groupId: string;
  storeId: string;
  variantPricesByName: unknown;
}) {
  const pricesByName = normalizeVariantPricesByName(variantPricesByName);

  const { error: deleteError } = await supabase
    .from("product_option_value_variant_prices")
    .delete()
    .eq("option_value_id", optionValueId);

  if (deleteError) throw deleteError;
  if (!pricesByName.size) return;

  const { data: assignments, error: assignmentsError } = await supabase
    .from("product_option_group_products")
    .select("product_id")
    .eq("option_group_id", groupId);

  if (assignmentsError) throw assignmentsError;

  const productIds = Array.from(
    new Set((assignments || []).map((assignment: any) => cleanText(assignment.product_id)).filter(Boolean))
  );

  if (!productIds.length) return;

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, store_id")
    .eq("store_id", storeId)
    .in("id", productIds);

  if (productsError) throw productsError;

  const allowedProductIds = new Set(
    (products || []).map((product: any) => cleanText(product.id)).filter(Boolean)
  );

  if (!allowedProductIds.size) return;

  const { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select("id, product_id, name")
    .in("product_id", Array.from(allowedProductIds));

  if (variantsError) throw variantsError;

  const rows = (variants || [])
    .map((variant: any) => {
      const variantName = normalizeVariantName(variant.name);
      if (!pricesByName.has(variantName)) return null;

      return {
        option_value_id: optionValueId,
        variant_id: cleanText(variant.id),
        price_delta_usd: pricesByName.get(variantName),
      };
    })
    .filter(Boolean);

  if (!rows.length) return;

  const { error: insertError } = await supabase
    .from("product_option_value_variant_prices")
    .insert(rows);

  if (insertError) throw insertError;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();
    const requestedStoreId = String(request.headers.get("x-panel-store-id") || "").trim();

    if (requestedStoreId) {
      assertStoreAccess(auth, requestedStoreId, "No tienes permiso para consultar esta sede.");
    }
    const { searchParams } = new URL(request.url);
    const productsLimit = Math.min(
      300,
      Math.max(50, Number(searchParams.get("productsLimit") || 180))
    );
    const groupsLimit = Math.min(
      150,
      Math.max(25, Number(searchParams.get("groupsLimit") || 80))
    );

    let storesQuery = supabase
      .from("stores")
      .select("id, slug, name")
      .order("name", { ascending: true });
    let productsQuery = supabase
      .from("products")
      .select(
        `
        id,
        store_id,
        name,
        price_usd,
        image_url,
        is_available,
        categories(name),
        product_variants (
          id,
          name,
          price_usd,
          is_available,
          sort_order
        )
      `
      )
      .order("sort_order", { ascending: true })
      .limit(productsLimit);
    let groupsQuery = supabase
      .from("product_option_groups")
      .select(
        `
        id,
        store_id,
        name,
        description,
        selection_type,
        required,
        min_select,
        max_select,
        sort_order,
        is_active,
        product_option_values (
          id,
          name,
          description,
          price_delta_usd,
          sort_order,
          is_active,
          product_option_value_variant_prices (
            variant_id,
            price_delta_usd
          )
        ),
        product_option_group_products (
          product_id,
          sort_order
        )
      `
      )
      .order("sort_order", { ascending: true })
      .limit(groupsLimit);

    if (auth.storeIds !== null) {
      storesQuery = storesQuery.in("id", auth.storeIds);
      productsQuery = productsQuery.in("store_id", auth.storeIds);
      groupsQuery = groupsQuery.in("store_id", auth.storeIds);
    }

    if (requestedStoreId) {
      storesQuery = storesQuery.eq("id", requestedStoreId);
      productsQuery = productsQuery.eq("store_id", requestedStoreId);
      groupsQuery = groupsQuery.eq("store_id", requestedStoreId);
    }

    const [storesResult, productsResult, groupsResult] = await Promise.all([
      storesQuery,
      productsQuery,
      groupsQuery,
    ]);

    if (storesResult.error) throw storesResult.error;
    if (productsResult.error) throw productsResult.error;
    if (groupsResult.error) throw groupsResult.error;

    return NextResponse.json({
      stores: storesResult.data || [],
      products: productsResult.data || [],
      groups: groupsResult.data || [],
      page: {
        productsLimit,
        groupsLimit,
        productsHasMore: (productsResult.data || []).length === productsLimit,
        groupsHasMore: (groupsResult.data || []).length === groupsLimit,
      },
      auth: {
        mode: auth.mode,
        email: auth.email || null,
        role: auth.role || null,
      },
    });
  } catch (error: any) {
    return panelErrorResponse(error, "Error cargando opciones y extras.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const action = cleanText(body.action);
    const supabase = createSupabaseAdminClient();

    if (action === "create_group") {
      const payload = normalizeGroupPayload(body);
      if (!payload.store_id) return badRequest("Selecciona un comercio.");
      if (!payload.name) return badRequest("El nombre del grupo es obligatorio.");
      assertStoreManager(auth, payload.store_id, "No tienes permiso para este comercio.");

      const { data, error } = await supabase
        .from("product_option_groups")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ group: data });
    }

    if (action === "create_value") {
      const groupId = cleanText(body.group_id);
      const name = cleanText(body.name);
      if (!groupId) return badRequest("Falta el grupo.");
      if (!name) return badRequest("El nombre de la opción es obligatorio.");

      const storeId = await getGroupStoreId(supabase, groupId);
      assertStoreManager(auth, storeId, "No tienes permiso para este grupo.");

      const { data, error } = await supabase
        .from("product_option_values")
        .insert({
          option_group_id: groupId,
          name,
          description: cleanText(body.description) || null,
          price_delta_usd: toSafeNumber(body.price_delta_usd, 0),
          sort_order: Math.floor(toSafeNumber(body.sort_order, 0)),
          is_active: body.is_active !== false,
        })
        .select()
        .single();

      if (error) throw error;
      if (Object.prototype.hasOwnProperty.call(body, "variant_prices_by_name")) {
        await replaceValueVariantPrices({
          supabase,
          optionValueId: cleanText(data?.id),
          groupId,
          storeId,
          variantPricesByName: body.variant_prices_by_name,
        });
      }
      return NextResponse.json({ value: data });
    }

    if (action === "apply_products") {
      const groupId = cleanText(body.group_id);
      const productIds: string[] = Array.isArray(body.product_ids)
        ? body.product_ids.map(cleanText).filter(Boolean)
        : [];

      if (!groupId) return badRequest("Falta el grupo.");

      const storeId = await getGroupStoreId(supabase, groupId);
      assertStoreManager(auth, storeId, "No tienes permiso para este grupo.");

      if (productIds.length) {
        const { data: products, error: productsError } = await supabase
          .from("products")
          .select("id, store_id")
          .eq("store_id", storeId)
          .in("id", productIds);

        if (productsError) throw productsError;
        if ((products || []).length !== productIds.length) {
          return badRequest("Uno o más productos no pertenecen al comercio.");
        }
      }

      const { error: deleteError } = await supabase
        .from("product_option_group_products")
        .delete()
        .eq("option_group_id", groupId);

      if (deleteError) throw deleteError;

      if (productIds.length) {
        const { error } = await supabase.from("product_option_group_products").insert(
          productIds.map((productId: string, index: number) => ({
            option_group_id: groupId,
            product_id: productId,
            store_id: storeId,
            sort_order: index,
          }))
        );

        if (error) throw error;
      }

      return NextResponse.json({ ok: true });
    }

    return badRequest("Acción inválida.");
  } catch (error: any) {
    return panelErrorResponse(error, "Error guardando opciones y extras.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const action = cleanText(body.action);
    const supabase = createSupabaseAdminClient();

    if (action === "update_group") {
      const groupId = cleanText(body.id);
      if (!groupId) return badRequest("Falta el grupo.");

      const existingStoreId = await getGroupStoreId(supabase, groupId);
      assertStoreManager(auth, existingStoreId, "No tienes permiso para este grupo.");

      const payload = normalizeGroupPayload({
        ...body,
        store_id: existingStoreId,
      });
      if (!payload.name) return badRequest("El nombre del grupo es obligatorio.");

      const { data, error } = await supabase
        .from("product_option_groups")
        .update(payload)
        .eq("id", groupId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ group: data });
    }

    if (action === "update_value") {
      const valueId = cleanText(body.id);
      if (!valueId) return badRequest("Falta la opción.");

      const { data: value, error: valueError } = await supabase
        .from("product_option_values")
        .select("id, option_group_id")
        .eq("id", valueId)
        .single();

      if (valueError) throw valueError;

      const storeId = await getGroupStoreId(supabase, cleanText(value?.option_group_id));
      assertStoreManager(auth, storeId, "No tienes permiso para esta opción.");

      const name = cleanText(body.name);
      if (!name) return badRequest("El nombre de la opción es obligatorio.");

      const { data, error } = await supabase
        .from("product_option_values")
        .update({
          name,
          description: cleanText(body.description) || null,
          price_delta_usd: toSafeNumber(body.price_delta_usd, 0),
          sort_order: Math.floor(toSafeNumber(body.sort_order, 0)),
          is_active: body.is_active !== false,
        })
        .eq("id", valueId)
        .select()
        .single();

      if (error) throw error;
      if (Object.prototype.hasOwnProperty.call(body, "variant_prices_by_name")) {
        await replaceValueVariantPrices({
          supabase,
          optionValueId: valueId,
          groupId: cleanText(value?.option_group_id),
          storeId,
          variantPricesByName: body.variant_prices_by_name,
        });
      }
      return NextResponse.json({ value: data });
    }

    return badRequest("Acción inválida.");
  } catch (error: any) {
    return panelErrorResponse(error, "Error actualizando opciones y extras.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const action = cleanText(body.action);
    const supabase = createSupabaseAdminClient();

    if (action === "delete_group") {
      const groupId = cleanText(body.id);
      if (!groupId) return badRequest("Falta el grupo.");

      const storeId = await getGroupStoreId(supabase, groupId);
      assertStoreManager(auth, storeId, "No tienes permiso para eliminar este grupo.");

      const { error } = await supabase
        .from("product_option_groups")
        .delete()
        .eq("id", groupId);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_value") {
      const valueId = cleanText(body.id);
      if (!valueId) return badRequest("Falta la opcion.");

      const { data: value, error: valueError } = await supabase
        .from("product_option_values")
        .select("id, option_group_id")
        .eq("id", valueId)
        .single();

      if (valueError) throw valueError;

      const storeId = await getGroupStoreId(supabase, cleanText(value?.option_group_id));
      assertStoreManager(auth, storeId, "No tienes permiso para eliminar esta opcion.");

      const { error } = await supabase
        .from("product_option_values")
        .delete()
        .eq("id", valueId);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return badRequest("Accion invalida.");
  } catch (error: any) {
    return panelErrorResponse(error, "Error eliminando opciones y extras.");
  }
}
