import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import {
  adminStoreSelect,
  normalizeAdminStorePayload,
} from "@/lib/admin/stores";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/server";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
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

    const [
      assignmentsResult,
      productsResult,
      ordersResult,
      customersResult,
      deliverySettingsResult,
    ] = await Promise.all([
      supabase
        .from("store_users")
        .select("id, user_id, store_id, role, created_at")
        .eq("store_id", storeId),
      supabase.from("products").select("id, is_available").eq("store_id", storeId).limit(5000),
      supabase
        .from("orders")
        .select("id, total_usd, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase.from("customers").select("id").eq("store_id", storeId).limit(5000),
      supabase
        .from("store_delivery_settings")
        .select("delivery_enabled, pickup_enabled, delivery_provider, pricing_type")
        .eq("store_id", storeId)
        .maybeSingle(),
    ]);

    if (assignmentsResult.error) throw assignmentsResult.error;
    if (productsResult.error) throw productsResult.error;
    if (ordersResult.error) throw ordersResult.error;
    if (customersResult.error) throw customersResult.error;
    if (deliverySettingsResult.error) throw deliverySettingsResult.error;

    const products = productsResult.data || [];
    const orders = ordersResult.data || [];
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    return NextResponse.json({
      store: data,
      assignments: assignmentsResult.data || [],
      metrics: {
        activeProducts: products.filter((product: any) => product.is_available !== false).length,
        totalProducts: products.length,
        totalOrders: orders.length,
        ordersLast7Days: orders.filter((order: any) => new Date(order.created_at).getTime() >= sevenDaysAgo).length,
        ordersLast30Days: orders.filter((order: any) => new Date(order.created_at).getTime() >= thirtyDaysAgo).length,
        totalRevenueUsd: orders.reduce((sum: number, order: any) => sum + Number(order.total_usd || 0), 0),
        customers: customersResult.data?.length || 0,
      },
      deliverySettings: deliverySettingsResult.data || null,
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
    const auth = await requireAdminAuth(request);
    const { storeId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const adminPassword = String(body.adminPassword || "");

    if (!storeId) return badRequest("Falta el ID del comercio.");
    if (!adminPassword) return badRequest("Confirma tu clave de admin para borrar.");
    if (!auth.email) return badRequest("No se pudo validar el email del admin.");

    const publicSupabase = createSupabasePublicClient();
    if (!publicSupabase) return badRequest("Faltan variables públicas de Supabase.");

    const { error: signInError } = await publicSupabase.auth.signInWithPassword({
      email: auth.email,
      password: adminPassword,
    });

    if (signInError) return badRequest("Clave de admin incorrecta.");

    const supabase = createSupabaseAdminClient();
    const { data: orders } = await supabase
      .from("orders")
      .select("id")
      .eq("store_id", storeId);
    const orderIds = (orders || []).map((order: any) => order.id).filter(Boolean);
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("id, orders!inner(store_id)")
      .eq("orders.store_id", storeId);
    const orderItemIds = (orderItems || []).map((item: any) => item.id).filter(Boolean);

    if (orderItemIds.length) {
      await supabase.from("order_item_options").delete().in("order_item_id", orderItemIds);
    }

    await Promise.all([
      supabase.from("order_integrations").delete().in("order_id", orderIds.length ? orderIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("order_items").delete().in("id", orderItemIds.length ? orderItemIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("orders").delete().eq("store_id", storeId),
      supabase.from("customers").delete().eq("store_id", storeId),
      supabase.from("store_delivery_distance_rates").delete().eq("store_id", storeId),
      supabase.from("store_delivery_zones").delete().eq("store_id", storeId),
      supabase.from("store_delivery_settings").delete().eq("store_id", storeId),
      supabase.from("product_option_group_products").delete().eq("store_id", storeId),
      supabase.from("product_option_values").delete().eq("store_id", storeId),
      supabase.from("product_option_groups").delete().eq("store_id", storeId),
      supabase.from("product_variants").delete().eq("store_id", storeId),
      supabase.from("products").delete().eq("store_id", storeId),
      supabase.from("categories").delete().eq("store_id", storeId),
      supabase.from("store_users").delete().eq("store_id", storeId),
    ]);

    const { error } = await supabase.from("stores").delete().eq("id", storeId);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      message: "Comercio eliminado definitivamente.",
    });
  } catch (error) {
    return adminErrorResponse(error, "Error eliminando comercio.");
  }
}
