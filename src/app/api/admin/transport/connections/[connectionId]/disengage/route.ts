import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanTransportText } from "@/lib/transport";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await context.params;
    await requireAdminAuth(request);
    const body = await request.json().catch(() => ({}));
    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();

    const { data: connection, error: connectionError } = await supabase
      .from("store_transport_agency_connections")
      .select("id, store_id, agency_id, status, is_default, disengagement_requested_at")
      .eq("id", connectionId)
      .maybeSingle();

    if (connectionError) throw connectionError;
    if (!connection) return badRequest("Conexion no encontrada.");

    const notes =
      cleanTransportText(body.notes, 300) ||
      "Desafiliacion inmediata ejecutada por super admin.";
    const disengagementPayload: Record<string, any> = {
      status: "cancelled",
      is_default: false,
      disengagement_requested_at: connection.disengagement_requested_at || now,
      disengagement_confirmed_at: now,
      disengagement_effective_at: now,
      disengagement_confirmed_by: "admin",
      disengagement_notes: notes,
      updated_at: now,
    };
    if (!connection.disengagement_requested_at) {
      disengagementPayload.disengagement_requested_by = "admin";
    }

    const { data: updated, error: updateError } = await supabase
      .from("store_transport_agency_connections")
      .update(disengagementPayload)
      .eq("id", connectionId)
      .select("*")
      .maybeSingle();

    if (updateError) throw updateError;

    const { data: currentSettings, error: settingsLoadError } = await supabase
      .from("store_delivery_settings")
      .select("store_id, delivery_provider, transport_agency_connection_id, transport_agency_id, pickup_enabled")
      .eq("store_id", connection.store_id)
      .maybeSingle();

    if (settingsLoadError) throw settingsLoadError;

    const settingsUsesConnection =
      currentSettings?.delivery_provider === "transport_agency" &&
      (currentSettings.transport_agency_connection_id === connection.id ||
        currentSettings.transport_agency_id === connection.agency_id);

    if (settingsUsesConnection) {
      const { error: settingsError } = await supabase
        .from("store_delivery_settings")
        .upsert(
          {
            store_id: connection.store_id,
            delivery_enabled: false,
            pickup_enabled: currentSettings?.pickup_enabled !== false,
            delivery_provider: "disabled",
            pricing_type: "manual",
            fixed_fee_usd: 0,
            free_delivery_min_usd: null,
            max_distance_km: null,
            distance_factor: null,
            manual_quote_message: "Delivery no disponible en este momento.",
            transport_agency_connection_id: null,
            transport_agency_id: null,
            updated_at: now,
          },
          { onConflict: "store_id" }
        );

      if (settingsError) throw settingsError;

      const { error: storeError } = await supabase
        .from("stores")
        .update({ accepts_delivery: false })
        .eq("id", connection.store_id);
      if (storeError) throw storeError;
    }

    return NextResponse.json({
      ok: true,
      connection: updated,
      checkoutDeliveryDisabled: settingsUsesConnection,
    });
  } catch (error) {
    return adminErrorResponse(error, "Error desafiliando empresa delivery.");
  }
}
