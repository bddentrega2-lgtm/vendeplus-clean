import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function countRows(rows: any[] | null | undefined) {
  return Array.isArray(rows) ? rows.length : 0;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    const supabase = createSupabaseAdminClient();

    const [
      storesResult,
      ordersResult,
      productsResult,
      storeUsersResult,
      recentStoresResult,
    ] = await Promise.all([
      supabase.from("stores").select("id, is_active"),
      supabase.from("orders").select("id, total_usd"),
      supabase.from("products").select("id"),
      supabase.from("store_users").select("id"),
      supabase
        .from("stores")
        .select("id, slug, name, business_type, whatsapp, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    if (storesResult.error) throw storesResult.error;
    if (ordersResult.error) throw ordersResult.error;
    if (productsResult.error) throw productsResult.error;
    if (storeUsersResult.error) throw storeUsersResult.error;
    if (recentStoresResult.error) throw recentStoresResult.error;

    const stores = storesResult.data || [];
    const orders = ordersResult.data || [];
    const revenueUsd = orders.reduce(
      (sum: number, order: any) => sum + Number(order.total_usd || 0),
      0
    );

    return NextResponse.json({
      summary: {
        totalStores: stores.length,
        activeStores: stores.filter((store: any) => store.is_active !== false).length,
        inactiveStores: stores.filter((store: any) => store.is_active === false).length,
        totalOrders: orders.length,
        totalProducts: countRows(productsResult.data),
        totalAssignments: countRows(storeUsersResult.data),
        revenueUsd,
      },
      recentStores: recentStoresResult.data || [],
      auth: {
        mode: auth.mode,
        email: auth.email || null,
      },
    });
  } catch (error) {
    return adminErrorResponse(error, "Error cargando resumen admin.");
  }
}
