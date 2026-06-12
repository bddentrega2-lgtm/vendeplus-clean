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

function incrementCount(map: Map<string, number>, key?: string | null) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function withCounts(stores: any[], products: any[], orders: any[], users: any[]) {
  const productCounts = new Map<string, number>();
  const orderCounts = new Map<string, number>();
  const userCounts = new Map<string, number>();

  products.forEach((product) => incrementCount(productCounts, product.store_id));
  orders.forEach((order) => incrementCount(orderCounts, order.store_id));
  users.forEach((user) => incrementCount(userCounts, user.store_id));

  return stores.map((store) => ({
    ...store,
    product_count: productCounts.get(store.id) || 0,
    order_count: orderCounts.get(store.id) || 0,
    user_count: userCounts.get(store.id) || 0,
  }));
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const supabase = createSupabaseAdminClient();

    const [storesResult, productsResult, ordersResult, usersResult] =
      await Promise.all([
        supabase.from("stores").select(adminStoreSelect).order("name", { ascending: true }),
        supabase.from("products").select("id, store_id"),
        supabase.from("orders").select("id, store_id"),
        supabase.from("store_users").select("id, store_id"),
      ]);

    if (storesResult.error) throw storesResult.error;
    if (productsResult.error) throw productsResult.error;
    if (ordersResult.error) throw ordersResult.error;
    if (usersResult.error) throw usersResult.error;

    return NextResponse.json({
      stores: withCounts(
        storesResult.data || [],
        productsResult.data || [],
        ordersResult.data || [],
        usersResult.data || []
      ),
    });
  } catch (error) {
    return adminErrorResponse(error, "Error cargando comercios.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const body = await request.json();
    const payload = normalizeAdminStorePayload(body);

    if (!payload.name) {
      return badRequest("El nombre del comercio es obligatorio.");
    }

    if (!payload.slug) {
      return badRequest("El slug del comercio es obligatorio.");
    }

    const supabase = createSupabaseAdminClient();
    const { data: existingStore, error: existingError } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", payload.slug)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingStore) {
      return conflict("Ya existe un comercio con ese slug.");
    }

    const { data, error } = await supabase
      .from("stores")
      .insert(payload)
      .select(adminStoreSelect)
      .single();

    if (error) throw error;

    return NextResponse.json({ store: data }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error, "Error creando comercio.");
  }
}
