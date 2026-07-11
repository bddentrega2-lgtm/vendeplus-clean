import { NextRequest, NextResponse } from "next/server";
import {
  assertStoreManager,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadTransportAgencyDeliverySettings } from "@/lib/transport";
import {
  isTransportConnectionEnded,
  isTransportDisengagementPending,
} from "@/lib/transport/disengagement";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await context.params;
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();

    const { data: connection, error: connectionError } = await supabase
      .from("store_transport_agency_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("status", "active")
      .maybeSingle();

    if (connectionError) throw connectionError;
    if (!connection) return badRequest("Conexion no encontrada.");
    assertStoreManager(auth, connection.store_id, "No tienes permiso para este comercio.");
    if (isTransportConnectionEnded(connection)) {
      return badRequest("Esta afiliacion ya finalizo. Solicita afiliacion nuevamente.");
    }
    if (isTransportDisengagementPending(connection)) {
      return badRequest("Esta empresa delivery esta en proceso de desafiliacion.");
    }

    const { data: activeConnections, error: activeConnectionsError } = await supabase
      .from("store_transport_agency_connections")
      .select("id, agency_id, status, is_exclusive, disengagement_requested_at, disengagement_confirmed_at, disengagement_effective_at")
      .eq("store_id", connection.store_id)
      .eq("status", "active");
    if (activeConnectionsError) throw activeConnectionsError;

    const otherActiveConnections = (activeConnections || []).filter(
      (entry: any) => entry.id !== connectionId && !isTransportConnectionEnded(entry)
    );
    const hasOtherExclusiveConnection = otherActiveConnections.some(
      (entry: any) => entry.is_exclusive
    );

    if (hasOtherExclusiveConnection) {
      return badRequest(
        "Este comercio ya tiene una empresa delivery exclusiva activa. Para trabajar con otra, primero debes desactivar la relacion actual."
      );
    }

    if (connection.is_exclusive && otherActiveConnections.length) {
      return badRequest(
        "Esta afiliacion esta marcada como exclusiva. Para activarla, primero debes finalizar otras relaciones activas."
      );
    }

    await supabase
      .from("store_transport_agency_connections")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("store_id", connection.store_id)
      .neq("id", connectionId);

    const { error: activateError } = await supabase
      .from("store_transport_agency_connections")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", connectionId);
    if (activateError) throw activateError;

    const transport = await loadTransportAgencyDeliverySettings(
      supabase,
      connection.store_id,
      true
    );

    if (!transport) return badRequest("La empresa delivery no tiene tarifas activas.");

    const settings = transport.settings;
    const { error: settingsError } = await supabase
      .from("store_delivery_settings")
      .upsert(
        {
          store_id: connection.store_id,
          delivery_enabled: true,
          pickup_enabled: settings.pickupEnabled,
          delivery_provider: "transport_agency",
          pricing_type: settings.pricingType,
          fixed_fee_usd: settings.fixedFeeUsd,
          free_delivery_min_usd: null,
          max_distance_km: settings.maxDistanceKm,
          distance_factor: null,
          manual_quote_message: settings.manualQuoteMessage,
          transport_agency_connection_id: connectionId,
          transport_agency_id: connection.agency_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id" }
      );

    if (settingsError) throw settingsError;

    const { error: storeError } = await supabase
      .from("stores")
      .update({ accepts_delivery: true })
      .eq("id", connection.store_id);
    if (storeError) throw storeError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return panelErrorResponse(error, "Error activando empresa delivery.");
  }
}
