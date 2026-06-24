import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import {
  adminStoreSelect,
  normalizeAdminStorePayload,
} from "@/lib/admin/stores";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

async function deleteByStoreId(supabase: any, table: string, storeId: string) {
  const { error } = await supabase.from(table).delete().eq("store_id", storeId);
  if (error) throw error;
}

async function deleteByIds(supabase: any, table: string, column: string, ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from(table).delete().in(column, ids);
  if (error) throw error;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    await requireAdminAuth(request);
    const { storeId } = await context.params;

    if (!storeId) return badRequest("Falta el ID del comercio.");

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("stores")
      .select(adminStoreSelect)
      .eq("id", storeId)
      .single();

    if (error) throw error;

    const { data: assignments, error: assignmentsError } = await supabase
      .from("store_users")
      .select("id, user_id, store_id, role")
      .eq("store_id", storeId);

    if (assignmentsError) throw assignmentsError;

    return NextResponse.json({
      store: data,
      assignments: assignments || [],
    });
  } catch (error) {
    return adminErrorResponse(error, "Error cargando comercio.");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    await requireAdminAuth(request);
    const { storeId } = await context.params;
    const body = await request.json();
    const payload = normalizeAdminStorePayload(body);

    if (!storeId) return badRequest("Falta el ID del comercio.");
    if (!payload.name) return badRequest("El nombre del comercio es obligatorio.");
    if (!payload.slug) return badRequest("El slug del comercio es obligatorio.");

    const supabase = createSupabaseAdminClient();
    const { data: existingSlug, error: slugError } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", payload.slug)
      .neq("id", storeId)
      .maybeSingle();

    if (slugError) throw slugError;
    if (existingSlug) return conflict("Ya existe otro comercio con ese slug.");

    const { data, error } = await supabase
      .from("stores")
      .update(payload)
      .eq("id", storeId)
      .select(adminStoreSelect)
      .single();

    if (error) throw error;

    return NextResponse.json({ store: data });
  } catch (error) {
    return adminErrorResponse(error, "Error actualizando comercio.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    await requireAdminAuth(request);
    const { storeId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const confirmSlug = String(body.confirmSlug || "").trim();

    if (!storeId) return badRequest("Falta el ID del comercio.");

    const supabase = createSupabaseAdminClient();
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, slug, name")
      .eq("id", storeId)
      .single();

    if (storeError) throw storeError;
    if (!store) return badRequest("Comercio no encontrado.");
    if (confirmSlug !== store.slug) {
      return badRequest("Para eliminar, escribe exactamente el slug del comercio.");
    }

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id")
      .eq("store_id", storeId);
    if (ordersError) throw ordersError;

    const orderIds = (orders || []).map((order: any) => String(order.id));
    let orderItemIds: string[] = [];

    if (orderIds.length) {
      const { data: orderItems, error: orderItemsError } = await supabase
        .from("order_items")
        .select("id")
        .in("order_id", orderIds);
      if (orderItemsError) throw orderItemsError;
      orderItemIds = (orderItems || []).map((item: any) => String(item.id));

      await deleteByIds(supabase, "order_item_options", "order_item_id", orderItemIds);
      await deleteByIds(supabase, "order_integrations", "order_id", orderIds);
      await deleteByIds(supabase, "order_items", "order_id", orderIds);
      await deleteByIds(supabase, "orders", "id", orderIds);
    }

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id")
      .eq("store_id", storeId);
    if (productsError) throw productsError;

    const productIds = (products || []).map((product: any) => String(product.id));

    await deleteByStoreId(supabase, "product_option_group_products", storeId);
    await deleteByIds(supabase, "product_variants", "product_id", productIds);
    await deleteByStoreId(supabase, "products", storeId);
    await deleteByStoreId(supabase, "categories", storeId);
    await deleteByStoreId(supabase, "product_option_groups", storeId);
    await deleteByStoreId(supabase, "customers", storeId);
    await deleteByStoreId(supabase, "store_delivery_distance_rates", storeId);
    await deleteByStoreId(supabase, "store_delivery_zones", storeId);
    await deleteByStoreId(supabase, "store_delivery_settings", storeId);
    await deleteByStoreId(supabase, "store_users", storeId);

    const { error: deleteStoreError } = await supabase
      .from("stores")
      .delete()
      .eq("id", storeId);

    if (deleteStoreError) throw deleteStoreError;

    return NextResponse.json({
      ok: true,
      message: `Comercio ${store.name || store.slug} eliminado.`,
    });
  } catch (error) {
    return adminErrorResponse(error, "Error eliminando comercio.");
  }
}
