import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  canUseAgencyRole,
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";
import { cleanTransportText } from "@/lib/transport";
import { getCurrentWeekRange } from "@/lib/transport";
import { isPremiumDispatchSchemaMissing } from "@/lib/transport/driver-dispatch";

const allowedStatusFilters = new Set([
  "pending",
  "agency_accepted",
  "agency_rejected",
  "on_the_way",
  "delivered",
  "issue_reported",
  "cancelled",
]);

function statusesForFilter(filter: string) {
  if (filter === "pending") return ["sent_to_agency", "agency_received", "pending_agency"];
  if (allowedStatusFilters.has(filter)) return [filter];
  return [];
}

const transportOrdersSummarySelect = `
  id,
  order_id,
  store_id,
  agency_id,
  connection_id,
  status,
  store_name_snapshot,
  store_whatsapp_snapshot,
  customer_name_snapshot,
  customer_phone_snapshot,
  delivery_address,
  delivery_reference,
  delivery_zone_name,
  delivery_fee_usd,
  driver_id,
  driver_name_snapshot,
  driver_commission_percent,
  driver_payout_usd,
  driver_assigned_at,
  created_at,
  stores (id, name, slug, whatsapp),
  orders (
    id,
    public_code,
    total_usd,
    payment_method,
    payment_status,
    status,
    created_at,
    delivery_lat,
    delivery_lng,
    delivery_reference
  )
`;

const transportOrdersSummarySelectWithoutDrivers = transportOrdersSummarySelect
  .replace("driver_id,", "")
  .replace("driver_name_snapshot,", "")
  .replace("driver_commission_percent,", "")
  .replace("driver_payout_usd,", "")
  .replace("driver_assigned_at,", "");

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTransportAgencyAuth(request);
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const status = cleanTransportText(searchParams.get("status"));
    const period = cleanTransportText(searchParams.get("period")) || "today";
    const storeId = cleanTransportText(searchParams.get("storeId"));
    const requestedAgencyId = cleanTransportText(searchParams.get("agencyId"), 80);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(80, Math.max(20, Number(searchParams.get("limit") || 40)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let agencyIds = auth.agencyIds?.filter((agencyId) =>
      canUseAgencyRole(auth, agencyId, ["owner", "admin", "operator"])
    );
    if (auth.isFounderMode) {
      const { data: agencies, error } = await supabase
        .from("transport_agencies")
        .select("id");
      if (error) throw error;
      agencyIds = (agencies || []).map((agency: any) => agency.id);
    }

    if (!agencyIds?.length) {
      return NextResponse.json({ orders: [], stores: [] });
    }
    if (requestedAgencyId) {
      if (!agencyIds.includes(requestedAgencyId)) {
        return NextResponse.json({ error: "No tienes permiso para esta empresa delivery." }, { status: 403 });
      }
      agencyIds = [requestedAgencyId];
    }

    const buildOrdersQuery = (selectClause: string) => {
      let query = supabase
        .from("transport_orders")
        .select(selectClause, { count: "exact" })
        .in("agency_id", agencyIds)
        .order("created_at", { ascending: false });

      const filteredStatuses = statusesForFilter(status);
      if (filteredStatuses.length) query = query.in("status", filteredStatuses);
      if (storeId) query = query.eq("store_id", storeId);

      if (period === "today") {
        const now = new Date();
        const start = new Date(now);
        start.setUTCHours(4, 0, 0, 0);
        if (start.getTime() > now.getTime()) start.setUTCDate(start.getUTCDate() - 1);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1);
        query = query.gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
      } else if (period === "week") {
        const week = getCurrentWeekRange();
        query = query.gte("created_at", week.start).lt("created_at", week.end);
      }

      return query.range(from, to);
    };

    let result = await buildOrdersQuery(transportOrdersSummarySelect);
    if (result.error && isPremiumDispatchSchemaMissing(result.error)) {
      result = await buildOrdersQuery(transportOrdersSummarySelectWithoutDrivers);
    }

    const { data, error, count } = result;
    if (error) throw error;

    const storeMap = new Map<string, any>();
    for (const order of (data || []) as any[]) {
      if (order.stores?.id) storeMap.set(order.stores.id, order.stores);
    }

    return NextResponse.json({
      orders: data || [],
      stores: Array.from(storeMap.values()).sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      ),
      pagination: {
        page,
        limit,
        total: count || 0,
        hasMore: from + (data?.length || 0) < (count || 0),
      },
    });
  } catch (error) {
    return transportErrorResponse(error, "Error cargando pedidos de empresa delivery.");
  }
}
