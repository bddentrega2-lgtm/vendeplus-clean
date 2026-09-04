import { NextRequest, NextResponse } from "next/server";
import {
  assertStoreAccess,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentWeekRange,
  getTransportAgencyConfigIssues,
  getTransportAgencyRateFromRelation,
} from "@/lib/transport";
import { isTransportConnectionEnded } from "@/lib/transport/disengagement";

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const selectedStoreId = searchParams.get("storeId");

    if (selectedStoreId) {
      assertStoreAccess(auth, selectedStoreId, "No tienes permiso para ver este comercio.");
    }

    let storesQuery = supabase
      .from("stores")
      .select("id, name, slug, whatsapp, city_id, service_cities(name, state_name)")
      .order("name", { ascending: true });
    if (auth.storeIds !== null) storesQuery = storesQuery.in("id", auth.storeIds);
    if (selectedStoreId) storesQuery = storesQuery.eq("id", selectedStoreId);

    const storesResult = await storesQuery;
    if (storesResult.error) throw storesResult.error;

    const storeIds = (storesResult.data || []).map((store: any) => store.id);
    const week = getCurrentWeekRange();

    const [
      agenciesResult,
      requestsResult,
      connectionsResult,
      ordersResult,
      deliverySettingsResult,
    ] = await Promise.all([
      supabase
        .from("transport_agencies")
        .select(
          `
          id,
          name,
          slug,
          status,
          is_active,
          pricing_type,
          modality,
          rates_visibility,
          logo_url,
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
          transport_agency_city_coverage (
            city_id,
            is_base_city,
            is_active,
            service_cities (name, state_name, slug)
          ),
          transport_agency_rates (
            agency_id,
            flat_fee_usd,
            max_distance_km,
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
        `
        )
        .eq("status", "active")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(100),
      storeIds.length
        ? supabase
            .from("store_transport_agency_requests")
            .select("id, store_id, agency_id, status, created_at, updated_at")
            .in("store_id", storeIds)
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
      storeIds.length
        ? supabase
            .from("store_transport_agency_connections")
            .select(
              "id, store_id, agency_id, status, is_default, is_exclusive, connected_at, disengagement_requested_at, disengagement_requested_by, disengagement_confirmed_at, disengagement_confirmed_by, disengagement_effective_at"
            )
            .in("store_id", storeIds)
            .order("connected_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
      storeIds.length
        ? supabase
            .from("orders")
            .select("store_id, transport_agency_id, delivery_usd, transport_agency_fee_usd, created_at")
            .in("store_id", storeIds)
            .not("transport_agency_id", "is", null)
            .in("transport_agency_status", [
              "sent_to_agency",
              "accepted",
              "assigned",
              "delivering",
              "delivered",
              "completed",
            ])
            .gte("created_at", week.start)
            .lt("created_at", week.end)
        : Promise.resolve({ data: [], error: null }),
      storeIds.length
        ? supabase
            .from("store_delivery_settings")
            .select("store_id, delivery_provider")
            .in("store_id", storeIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (agenciesResult.error) throw agenciesResult.error;
    if (requestsResult.error) throw requestsResult.error;
    if (connectionsResult.error) throw connectionsResult.error;
    if (ordersResult.error) throw ordersResult.error;
    if (deliverySettingsResult.error) throw deliverySettingsResult.error;

    const entrega2StoreIds = new Set(
      (deliverySettingsResult.data || [])
        .filter((settings: any) => settings.delivery_provider === "entrega2")
        .map((settings: any) => settings.store_id)
    );
    const isEntrega2AppLocked =
      (selectedStoreId && entrega2StoreIds.has(selectedStoreId)) ||
      (!selectedStoreId && storeIds.length === 1 && entrega2StoreIds.has(storeIds[0]));

    if (isEntrega2AppLocked) {
      const response = NextResponse.json({
        stores: storesResult.data || [],
        agencies: [],
        requests: [],
        connections: [],
        deliveryAppLocked: true,
        message:
          "Este comercio está conectado a Entrega2 App. Las afiliaciones a otras empresas delivery están bloqueadas.",
        billing: {
          week,
          ordersCount: 0,
          totalUsd: 0,
        },
      });
      const durationMs = (performance.now() - startedAt).toFixed(1);
      response.headers.set("Server-Timing", `panel-transport-agencies;dur=${durationMs}`);
      response.headers.set("X-Endpoint-Duration-Ms", durationMs);
      return response;
    }

    const activeAgencies = (agenciesResult.data || []).map((agency: any) => {
      const configIssues = getTransportAgencyConfigIssues({
        agency,
        rate: getTransportAgencyRateFromRelation(agency.transport_agency_rates),
        zones: agency.transport_agency_zones || [],
        distanceRates: agency.transport_agency_distance_rates || [],
      });

      return {
        ...agency,
        config_issues: configIssues,
        is_ready: configIssues.length === 0,
      };
    });

    const activeConnections = (connectionsResult.data || []).filter(
      (connection: any) => connection.status === "active" && !isTransportConnectionEnded(connection)
    );
    const activeConnectionAgencyIds = new Set(activeConnections.map((connection: any) => connection.agency_id));
    const scopedStore = (storesResult.data || []).find(
      (store: any) => store.id === (selectedStoreId || (storeIds.length === 1 ? storeIds[0] : null))
    );
    const cityEligibleAgencies = scopedStore?.city_id
      ? activeAgencies.filter((agency: any) =>
          activeConnectionAgencyIds.has(agency.id) ||
          (agency.transport_agency_city_coverage || []).some(
            (coverage: any) => coverage.is_active !== false && coverage.city_id === scopedStore.city_id
          )
        )
      : activeAgencies.filter((agency: any) => activeConnectionAgencyIds.has(agency.id));
    const scopedExclusiveConnection =
      (selectedStoreId || storeIds.length === 1)
        ? activeConnections.find(
            (connection: any) =>
              connection.is_exclusive &&
              connection.store_id === (selectedStoreId || storeIds[0])
          )
        : null;
    const visibleActiveAgencies = scopedExclusiveConnection?.agency_id
      ? cityEligibleAgencies.filter((agency: any) => agency.id === scopedExclusiveConnection.agency_id)
      : cityEligibleAgencies;

    const agencies = visibleActiveAgencies.map((agency: any) => {
      if (agency.rates_visibility !== "private" || activeConnectionAgencyIds.has(agency.id)) {
        return agency;
      }

      return {
        ...agency,
        transport_agency_rates: [],
        transport_agency_zones: [],
        transport_agency_distance_rates: [],
        rates_hidden_until_approved: true,
      };
    });

    const response = NextResponse.json({
      stores: storesResult.data || [],
      agencies,
      requests: requestsResult.data || [],
      connections: connectionsResult.data || [],
      cityRequired: Boolean(scopedStore && !scopedStore.city_id),
      billing: {
        week,
        ordersCount: ordersResult.data?.length || 0,
        totalUsd: (ordersResult.data || []).reduce(
          (sum: number, order: any) =>
            sum + Number(order.transport_agency_fee_usd ?? order.delivery_usd ?? 0),
          0
        ),
      },
    });
    const durationMs = (performance.now() - startedAt).toFixed(1);
    response.headers.set("Server-Timing", `panel-transport-agencies;dur=${durationMs}`);
    response.headers.set("X-Endpoint-Duration-Ms", durationMs);
    return response;
  } catch (error) {
    return panelErrorResponse(error, "Error cargando empresas delivery.");
  }
}
