import { NextRequest, NextResponse } from "next/server";
import {
  assertStoreManager,
  canUseStoreRole,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanTransportText, getTransportBillingRange } from "@/lib/transport";

function isCancelledStatus(value: unknown) {
  return ["cancelled", "canceled", "cancelado", "agency_rejected", "delivery_failed"].includes(
    String(value || "").toLowerCase()
  );
}

function toAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

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
    const range = getTransportBillingRange(searchParams);

    let transportQuery = supabase
      .from("transport_orders")
      .select(`
        id,
        order_id,
        store_id,
        agency_id,
        agency_name_snapshot,
        customer_name_snapshot,
        customer_phone_snapshot,
        delivery_fee_usd,
        delivery_zone_name,
        status,
        created_at,
        orders (
          public_code,
          customer_name,
          customer_phone,
          delivery_usd,
          delivery_distance_km,
          delivery_zone_name,
          status
        )
      `)
      .gte("created_at", range.start)
      .lt("created_at", range.end)
      .order("created_at", { ascending: false });

    let entrega2Query = supabase
      .from("orders")
      .select(`
        id,
        store_id,
        public_code,
        customer_name,
        customer_phone,
        delivery_usd,
        delivery_distance_km,
        delivery_zone_name,
        delivery_provider,
        delivery_status,
        status,
        created_at
      `)
      .eq("delivery_provider", "entrega2")
      .gte("created_at", range.start)
      .lt("created_at", range.end)
      .order("created_at", { ascending: false });

    if (storeId) {
      transportQuery = transportQuery.eq("store_id", storeId);
      entrega2Query = entrega2Query.eq("store_id", storeId);
    }
    else if (managerStoreIds !== null) {
      transportQuery = managerStoreIds.length
        ? transportQuery.in("store_id", managerStoreIds)
        : transportQuery.eq("store_id", "__no_authorized_store__");
      entrega2Query = managerStoreIds.length
        ? entrega2Query.in("store_id", managerStoreIds)
        : entrega2Query.eq("store_id", "__no_authorized_store__");
    }

    const [transportResult, entrega2Result] = await Promise.all([transportQuery, entrega2Query]);
    if (transportResult.error) throw transportResult.error;
    if (entrega2Result.error) throw entrega2Result.error;

    const transportOrders = (transportResult.data || [])
      .map((order: any) => {
        const nestedOrder = Array.isArray(order.orders) ? order.orders[0] : order.orders || {};
        const feeUsd = toAmount(order.delivery_fee_usd ?? nestedOrder.delivery_usd);
        const status = order.status || nestedOrder.status || "";

        return {
          id: String(order.id),
          orderId: order.order_id ? String(order.order_id) : null,
          publicCode: nestedOrder.public_code || "Pedido",
          provider: "transport_agency",
          providerName: order.agency_name_snapshot || "Empresa delivery",
          customerName: order.customer_name_snapshot || nestedOrder.customer_name || "Cliente",
          customerPhone: order.customer_phone_snapshot || nestedOrder.customer_phone || "",
          feeUsd,
          deliveryDistanceKm: nestedOrder.delivery_distance_km ?? null,
          deliveryZoneName: order.delivery_zone_name || nestedOrder.delivery_zone_name || null,
          status,
          createdAt: order.created_at,
          billable: feeUsd > 0,
        };
      })
      .filter((order: any) => !isCancelledStatus(order.status));

    const entrega2Orders = (entrega2Result.data || [])
      .filter((order: any) => !isCancelledStatus(order.status) && !isCancelledStatus(order.delivery_status))
      .map((order: any) => {
        const feeUsd = toAmount(order.delivery_usd);

        return {
          id: String(order.id),
          orderId: String(order.id),
          publicCode: order.public_code || "Pedido",
          provider: "entrega2",
          providerName: "Entrega2 App",
          customerName: order.customer_name || "Cliente",
          customerPhone: order.customer_phone || "",
          feeUsd,
          deliveryDistanceKm: order.delivery_distance_km ?? null,
          deliveryZoneName: order.delivery_zone_name || null,
          status: order.delivery_status || order.status || "",
          createdAt: order.created_at,
          billable: feeUsd > 0,
        };
      });

    const orders = [...transportOrders, ...entrega2Orders].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    return NextResponse.json({
      range,
      week: range,
      orders,
      ordersCount: orders.length,
      totalUsd: orders.reduce((sum: number, order: any) => order.billable ? sum + order.feeUsd : sum, 0),
    });
  } catch (error) {
    return panelErrorResponse(error, "Error cargando facturacion de transporte.");
  }
}
