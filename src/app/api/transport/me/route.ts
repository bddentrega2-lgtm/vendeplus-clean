import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";
import { getCurrentWeekRange } from "@/lib/transport";

const agencySelect = `
  id,
  name,
  slug,
  status,
  is_active,
  pricing_type,
  modality,
  rates_visibility,
  logo_url,
  banner_image_url,
  legal_name,
  rif,
  contact_name,
  contact_email,
  contact_phone,
  whatsapp_phone,
  city,
  state,
  coverage_notes,
  capacity_dimensions_cm,
  capacity_weight_kg,
  max_wait_time_minutes,
  charges_cash_return,
  cash_return_fee_usd,
  billing_currency,
  billing_rate_bs,
  payment_terms,
  credit_terms,
  additional_conditions,
  created_at,
  transport_agency_rates (
    agency_id,
    flat_fee_usd,
    max_distance_km,
    distance_factor_usd,
    minimum_order_usd,
    manual_quote_message,
    is_active
  ),
  transport_agency_zones (
    id,
    agency_id,
    name,
    description,
    fee_usd,
    is_active,
    sort_order
  ),
  transport_agency_distance_rates (
    id,
    agency_id,
    min_km,
    max_km,
    fee_usd,
    is_active,
    sort_order
  )
`;

const agencySelectWithoutBanner = agencySelect.replace("banner_image_url,", "");

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  try {
    const auth = await requireTransportAgencyAuth(request);
    const supabase = createSupabaseAdminClient();
    const includeBilling = request.nextUrl.searchParams.get("includeBilling") !== "false";
    const includeRelations = request.nextUrl.searchParams.get("includeRelations") !== "false";

    const buildAgencyQuery = (selectClause: string) => {
      let query = supabase
        .from("transport_agencies")
        .select(selectClause)
        .order("created_at", { ascending: false });

      if (auth.agencyIds !== null) query = query.in("id", auth.agencyIds);
      return query;
    };

    let { data: agencies, error: agenciesError } = await buildAgencyQuery(agencySelect);

    if (agenciesError && /banner_image_url/i.test(agenciesError.message || "")) {
      const fallback = await buildAgencyQuery(agencySelectWithoutBanner);
      agencies = (fallback.data || []).map((agency: any) => ({ ...agency, banner_image_url: null }));
      agenciesError = fallback.error;
    }

    if (agenciesError) throw agenciesError;

    const agencyIds = (agencies || []).map((agency: any) => agency.id);
    const week = getCurrentWeekRange();

    const [requestsResult, connectionsResult, ordersResult] =
      agencyIds.length
        ? await Promise.all([
            includeRelations ? supabase
              .from("store_transport_agency_requests")
              .select(
                `
                id,
                store_id,
                agency_id,
                status,
                contact_name,
                contact_phone,
                message,
                response_notes,
                store_name_snapshot,
                store_phone_snapshot,
                store_contact_name_snapshot,
                store_address_snapshot,
                store_schedule_snapshot,
                store_description_snapshot,
                created_at,
                updated_at,
                stores(id, name, slug, whatsapp)
              `
              )
              .in("agency_id", agencyIds)
              .order("created_at", { ascending: false })
              .limit(200) : Promise.resolve({ data: [], error: null }),
            includeRelations ? supabase
              .from("store_transport_agency_connections")
              .select(
                `
                id,
                store_id,
                agency_id,
                status,
                is_default,
                is_exclusive,
                connected_at,
                paused_at,
                disengagement_requested_at,
                disengagement_requested_by,
                disengagement_confirmed_at,
                disengagement_confirmed_by,
                disengagement_effective_at,
                disengagement_notes,
                stores(id, name, slug, whatsapp)
              `
              )
              .in("agency_id", agencyIds)
              .order("connected_at", { ascending: false })
              .limit(200) : Promise.resolve({ data: [], error: null }),
            includeBilling
              ? supabase
                  .from("transport_orders")
                  .select(
                    `
                    id,
                    order_id,
                    store_id,
                    agency_id,
                    status,
                    store_name_snapshot,
                    customer_name_snapshot,
                    customer_phone_snapshot,
                    delivery_zone_name,
                    delivery_fee_usd,
                    created_at,
                    stores(name),
                    orders(
                      public_code,
                      total_usd,
                      delivery_usd,
                      delivery_zone_name,
                      delivery_distance_km,
                      distance_km,
                      created_at
                    )
                  `
                  )
                  .in("agency_id", agencyIds)
                  .gte("created_at", week.start)
                  .lt("created_at", week.end)
                  .order("created_at", { ascending: false })
                  .limit(200)
              : Promise.resolve({ data: [], error: null }),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
          ];

    if (requestsResult.error) throw requestsResult.error;
    if (connectionsResult.error) throw connectionsResult.error;
    if (ordersResult.error) throw ordersResult.error;

    const response = NextResponse.json({
      agencies: agencies || [],
      requests: requestsResult.data || [],
      connections: connectionsResult.data || [],
      relationsLoaded: includeRelations,
      billing: includeBilling ? {
        week,
        orders: ordersResult.data || [],
        totalUsd: (ordersResult.data || []).reduce(
          (sum: number, order: any) =>
            order.status === "delivered"
              ? sum + Number(order.delivery_fee_usd ?? order.orders?.delivery_usd ?? 0)
              : sum,
          0
        ),
      } : null,
    });
    const durationMs = (performance.now() - startedAt).toFixed(1);
    response.headers.set("Server-Timing", `transport-me;dur=${durationMs}`);
    response.headers.set("X-Endpoint-Duration-Ms", durationMs);
    return response;
  } catch (error) {
    return transportErrorResponse(error, "Error cargando panel de empresa delivery.");
  }
}
