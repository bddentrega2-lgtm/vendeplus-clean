import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";
import { getTransportBillingRange } from "@/lib/transport";
import { isPremiumDispatchSchemaMissing } from "@/lib/transport/driver-dispatch";

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
  premium_dispatch_enabled,
  driver_whatsapp_dispatch_enabled,
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
const agencySelectWithoutPremium = agencySelect
  .replace("premium_dispatch_enabled,", "")
  .replace("driver_whatsapp_dispatch_enabled,", "");
const agencySelectWithoutBannerAndPremium = agencySelectWithoutBanner.replace(
  "premium_dispatch_enabled,",
  ""
).replace("driver_whatsapp_dispatch_enabled,", "");

const compactAgencySelect = `
  id,
  name,
  slug,
  status,
  is_active,
  modality,
  logo_url,
  billing_currency,
  premium_dispatch_enabled,
  driver_whatsapp_dispatch_enabled,
  created_at
`;

const compactAgencySelectWithoutPremium = compactAgencySelect
  .replace("premium_dispatch_enabled,", "")
  .replace("driver_whatsapp_dispatch_enabled,", "");

const billingSummarySelect = `
  id,
  status,
  delivery_fee_usd,
  orders(
    delivery_usd,
    status
  )
`;

const billingOrdersSelect = `
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
  driver_id,
  driver_name_snapshot,
  driver_commission_percent,
  driver_payout_usd,
  driver_assigned_at,
  created_at,
  stores(name),
  orders(
    public_code,
    total_usd,
    delivery_usd,
    delivery_zone_name,
    delivery_distance_km,
    distance_km,
    status,
    created_at
  )
`;

const billingOrdersSelectWithoutDrivers = `
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
    status,
    created_at
  )
`;

function isCancelledBillingStatus(value: unknown) {
  return ["cancelled", "canceled", "cancelado", "agency_rejected", "delivery_failed"].includes(
    String(value || "").toLowerCase()
  );
}

function getBillingAmount(order: any) {
  const parsed = Number(order?.delivery_fee_usd ?? order?.orders?.delivery_usd ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getDriverPayoutAmount(order: any) {
  const parsed = Number(order?.driver_payout_usd || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function aggregateDriverPayouts(orders: any[]) {
  const map = new Map<
    string,
    {
      driverId: string | null;
      driverName: string;
      ordersCount: number;
      deliveryTotalUsd: number;
      payoutUsd: number;
    }
  >();

  for (const order of orders) {
    const driverId = order.driver_id || "unassigned";
    const current = map.get(driverId) || {
      driverId: order.driver_id || null,
      driverName: order.driver_name_snapshot || "Sin repartidor asignado",
      ordersCount: 0,
      deliveryTotalUsd: 0,
      payoutUsd: 0,
    };

    current.ordersCount += 1;
    current.deliveryTotalUsd += getBillingAmount(order);
    current.payoutUsd += getDriverPayoutAmount(order);
    map.set(driverId, current);
  }

  return Array.from(map.values()).sort((a, b) => b.payoutUsd - a.payoutUsd);
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  try {
    const auth = await requireTransportAgencyAuth(request);
    const supabase = createSupabaseAdminClient();
    const includeBilling = request.nextUrl.searchParams.get("includeBilling") !== "false";
    const includeRelations = request.nextUrl.searchParams.get("includeRelations") !== "false";
    const includeConfiguration = request.nextUrl.searchParams.get("includeConfiguration") !== "false";
    const includeBillingDetail = request.nextUrl.searchParams.get("billingDetail") !== "false";

    const buildAgencyQuery = (selectClause: string) => {
      let query = supabase
        .from("transport_agencies")
        .select(selectClause)
        .order("created_at", { ascending: false });

      if (auth.agencyIds !== null) query = query.in("id", auth.agencyIds);
      return query;
    };

    const requestedAgencySelect = includeConfiguration ? agencySelect : compactAgencySelect;
    let { data: agencies, error: agenciesError } = await buildAgencyQuery(requestedAgencySelect);

    if (
      agenciesError &&
      (/banner_image_url/i.test(agenciesError.message || "") ||
        isPremiumDispatchSchemaMissing(agenciesError))
    ) {
      const fallbackSelect = includeConfiguration
        ? /banner_image_url/i.test(agenciesError.message || "")
          ? isPremiumDispatchSchemaMissing(agenciesError)
            ? agencySelectWithoutBannerAndPremium
            : agencySelectWithoutBanner
          : agencySelectWithoutPremium
        : compactAgencySelectWithoutPremium;
      const fallback = await buildAgencyQuery(fallbackSelect);
      agencies = (fallback.data || []).map((agency: any) => ({
        ...agency,
        banner_image_url: agency.banner_image_url || null,
        premium_dispatch_enabled: Boolean(agency.premium_dispatch_enabled),
      }));
      agenciesError = fallback.error;
    }

    if (agenciesError) throw agenciesError;

    const agencyIds = (agencies || []).map((agency: any) => agency.id);
    const billingRange = getTransportBillingRange(request.nextUrl.searchParams);

    let requestsResult: any;
    let connectionsResult: any;
    let ordersResult: any;
    [requestsResult, connectionsResult, ordersResult] =
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
                  .select(includeBillingDetail ? billingOrdersSelect : billingSummarySelect)
                  .in("agency_id", agencyIds)
                  .gte("created_at", billingRange.start)
                  .lt("created_at", billingRange.end)
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
    if (includeBillingDetail && ordersResult.error && isPremiumDispatchSchemaMissing(ordersResult.error)) {
      ordersResult = includeBilling
        ? await supabase
            .from("transport_orders")
            .select(billingOrdersSelectWithoutDrivers)
            .in("agency_id", agencyIds)
            .gte("created_at", billingRange.start)
            .lt("created_at", billingRange.end)
            .order("created_at", { ascending: false })
            .limit(200)
        : { data: [], error: null };
    }
    if (ordersResult.error) throw ordersResult.error;
    const billableOrders = (ordersResult.data || []).filter(
      (order: any) =>
        !isCancelledBillingStatus(order.status) &&
        !isCancelledBillingStatus(order.orders?.status)
    );

    const response = NextResponse.json({
      agencies: agencies || [],
      requests: requestsResult.data || [],
      connections: connectionsResult.data || [],
      configurationLoaded: includeConfiguration,
      relationsLoaded: includeRelations,
      billing: includeBilling ? {
        range: billingRange,
        week: billingRange,
        orders: billableOrders,
        totalUsd: billableOrders.reduce(
          (sum: number, order: any) => sum + getBillingAmount(order),
          0
        ),
        driverPayouts: includeBillingDetail ? aggregateDriverPayouts(billableOrders) : [],
      } : null,
      billingDetailLoaded: includeBilling && includeBillingDetail,
    });
    const durationMs = (performance.now() - startedAt).toFixed(1);
    response.headers.set("Server-Timing", `transport-me;dur=${durationMs}`);
    response.headers.set("X-Endpoint-Duration-Ms", durationMs);
    return response;
  } catch (error) {
    return transportErrorResponse(error, "Error cargando panel de empresa delivery.");
  }
}
