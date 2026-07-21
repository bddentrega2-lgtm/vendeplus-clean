import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  cleanTransportText,
  getTransportAgencyConfigIssues,
  normalizeAgencyStatus,
  getCurrentWeekRange,
  getTransportAgencyRateFromRelation,
} from "@/lib/transport";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  try {
    await requireAdminAuth(request);
    const supabase = createSupabaseAdminClient();
    const week = getCurrentWeekRange();
    const { searchParams } = new URL(request.url);
    const ordersPage = Math.max(1, Number(searchParams.get("ordersPage") || 1));
    const ordersLimit = Math.min(100, Math.max(20, Number(searchParams.get("ordersLimit") || 50)));
    const ordersFrom = (ordersPage - 1) * ordersLimit;
    const ordersTo = ordersFrom + ordersLimit - 1;

    const [agenciesResult, requestsResult, connectionsResult, ordersResult] =
      await Promise.all([
        supabase
          .from("transport_agencies")
          .select(
            `
            *,
            transport_agency_rates (*),
            transport_agency_zones (*),
            transport_agency_distance_rates (*)
          `
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("store_transport_agency_requests")
          .select("*, stores(id, name, slug)")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("store_transport_agency_connections")
          .select("*, stores(id, name, slug), transport_agencies(id, name)")
          .order("connected_at", { ascending: false })
          .limit(200),
        supabase
          .from("transport_orders")
          .select("id, order_id, store_id, agency_id, status, delivery_fee_usd, created_at, stores(name), transport_agencies(name), orders(public_code, delivery_usd)", { count: "exact" })
          .gte("created_at", week.start)
          .lt("created_at", week.end)
          .order("created_at", { ascending: false })
          .range(ordersFrom, ordersTo),
      ]);

    if (agenciesResult.error) throw agenciesResult.error;
    if (requestsResult.error) throw requestsResult.error;
    if (connectionsResult.error) throw connectionsResult.error;
    if (ordersResult.error) throw ordersResult.error;

    const response = NextResponse.json({
      agencies: agenciesResult.data || [],
      requests: requestsResult.data || [],
      connections: connectionsResult.data || [],
      transportOrders: ordersResult.data || [],
      pagination: {
        transportOrders: {
          page: ordersPage,
          limit: ordersLimit,
          total: ordersResult.count || 0,
          hasMore: ordersTo + 1 < (ordersResult.count || 0),
        },
      },
      summary: {
        activeAgencies: (agenciesResult.data || []).filter((agency: any) => agency.status === "active").length,
        pendingAgencies: (agenciesResult.data || []).filter((agency: any) => agency.status === "pending").length,
        pendingRequests: (requestsResult.data || []).filter((entry: any) => entry.status === "pending").length,
        week,
        ordersCount: ordersResult.data?.length || 0,
        deliveryUsd: (ordersResult.data || []).reduce(
          (sum: number, order: any) =>
            order.status === "delivered"
              ? sum + Number(order.delivery_fee_usd ?? order.orders?.delivery_usd ?? 0)
              : sum,
          0
        ),
      },
    });
    const durationMs = (performance.now() - startedAt).toFixed(1);
    response.headers.set("Server-Timing", `admin-transport-agencies;dur=${durationMs}`);
    response.headers.set("X-Endpoint-Duration-Ms", durationMs);
    return response;
  } catch (error) {
    return adminErrorResponse(error, "Error cargando red de transporte.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const body = await request.json();
    const agencyId = cleanTransportText(body.agencyId);
    const status = normalizeAgencyStatus(body.status);

    if (!agencyId) return badRequest("Falta la empresa delivery.");

    const supabase = createSupabaseAdminClient();
    let shouldPublish = false;

    if (status === "active") {
      const { data: currentAgency, error: readinessError } = await supabase
        .from("transport_agencies")
        .select(
          `
          *,
          transport_agency_rates (*),
          transport_agency_zones (*),
          transport_agency_distance_rates (*)
        `
        )
        .eq("id", agencyId)
        .maybeSingle();
      if (readinessError) throw readinessError;
      if (!currentAgency) return badRequest("Empresa delivery no encontrada.");

      const issues = getTransportAgencyConfigIssues({
        agency: { ...currentAgency, status: "active", is_active: true },
        rate: getTransportAgencyRateFromRelation(currentAgency.transport_agency_rates),
        zones: currentAgency.transport_agency_zones || [],
        distanceRates: currentAgency.transport_agency_distance_rates || [],
      });

      shouldPublish = issues.length === 0;
    }

    const { data: agency, error } = await supabase
      .from("transport_agencies")
      .update({
        status,
        is_active: status === "active" ? shouldPublish : false,
        admin_notes: cleanTransportText(body.adminNotes, 500) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agencyId)
      .select("id, name, status, is_active")
      .single();

    if (error) throw error;

    if (status === "active") {
      const { data: agencyUsers, error: agencyUsersError } = await supabase
        .from("transport_agency_users")
        .select("user_id")
        .eq("agency_id", agencyId);

      if (agencyUsersError) throw agencyUsersError;

      const confirmResults = await Promise.all(
        (agencyUsers || [])
          .map((entry: any) => String(entry.user_id || ""))
          .filter(Boolean)
          .map((userId: string) =>
            supabase.auth.admin.updateUserById(userId, { email_confirm: true })
          )
      );
      const confirmError = confirmResults.find((result) => result.error)?.error;
      if (confirmError) throw confirmError;
    }

    if (status !== "active") {
      await supabase
        .from("store_transport_agency_connections")
        .update({
          status: "paused",
          is_default: false,
          paused_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("agency_id", agencyId)
        .eq("status", "active");
    }

    return NextResponse.json({ agency });
  } catch (error) {
    return adminErrorResponse(error, "Error actualizando empresa delivery.");
  }
}
