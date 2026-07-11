import { NextRequest, NextResponse } from "next/server";
import {
  assertStoreManager,
  canUseStoreRole,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanTransportText, getCurrentWeekRange } from "@/lib/transport";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const { searchParams } = new URL(request.url);
    const storeId = cleanTransportText(searchParams.get("storeId"));

    const managerStoreIds =
      auth.storeIds === null
        ? null
        : auth.storeIds.filter((id) => canUseStoreRole(auth, id, ["owner", "admin"]));

    if (storeId) assertStoreManager(auth, storeId, "No tienes permiso para este comercio.");

    const supabase = createSupabaseAdminClient();
    const week = getCurrentWeekRange();

    let query = supabase
      .from("transport_orders")
      .select("id, order_id, store_id, agency_id, agency_name_snapshot, delivery_fee_usd, status, created_at, orders(public_code, delivery_usd)")
      .gte("created_at", week.start)
      .lt("created_at", week.end)
      .order("created_at", { ascending: false });

    if (storeId) query = query.eq("store_id", storeId);
    else if (managerStoreIds !== null) {
      query = managerStoreIds.length
        ? query.in("store_id", managerStoreIds)
        : query.eq("store_id", "__no_authorized_store__");
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      week,
      orders: data || [],
      totalUsd: (data || []).reduce(
        (sum: number, order: any) =>
          order.status === "delivered"
            ? sum + Number(order.delivery_fee_usd ?? order.orders?.delivery_usd ?? 0)
            : sum,
        0
      ),
    });
  } catch (error) {
    return panelErrorResponse(error, "Error cargando facturacion de transporte.");
  }
}
