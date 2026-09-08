import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanTransportText } from "@/lib/transport";
import {
  assertAgencyManager,
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await context.params;
    const auth = await requireTransportAgencyAuth(request);
    const body = await request.json().catch(() => ({}));
    const deliveryBillingMode =
      cleanTransportText(body.deliveryBillingMode) === "cash" ? "cash" : "credit";

    if (!storeId) return badRequest("Falta el comercio.");

    const supabase = createSupabaseAdminClient();
    const { data: agency, error: agencyError } = await supabase
      .from("transport_agencies")
      .select("id, name, slug")
      .eq("slug", "entrega2")
      .eq("status", "active")
      .eq("is_active", true)
      .maybeSingle();

    if (agencyError) throw agencyError;
    if (!agency?.id) return badRequest("Entrega2 Somos no esta activa.");

    assertAgencyManager(
      auth,
      agency.id,
      "Tu rol no permite actualizar la conexion de este comercio con Entrega2."
    );

    const { data: settings, error: settingsError } = await supabase
      .from("store_delivery_settings")
      .select("store_id, delivery_provider, transport_agency_id, transport_agency_connection_id")
      .eq("store_id", storeId)
      .maybeSingle();

    if (settingsError) throw settingsError;
    if (!settings || settings.delivery_provider !== "entrega2") {
      return badRequest("Este comercio ya no necesita actualizar su conexion con Entrega2.");
    }

    const { error: unsetDefaultError } = await supabase
      .from("store_transport_agency_connections")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("store_id", storeId)
      .eq("status", "active")
      .neq("agency_id", agency.id)
      .eq("is_default", true);

    if (unsetDefaultError) throw unsetDefaultError;

    const { data: connection, error: connectionError } = await supabase
      .from("store_transport_agency_connections")
      .upsert(
        {
          store_id: storeId,
          agency_id: agency.id,
          status: "active",
          is_default: true,
          is_exclusive: true,
          delivery_billing_mode: deliveryBillingMode,
          disengagement_requested_at: null,
          disengagement_confirmed_at: null,
          disengagement_effective_at: null,
          disengagement_requested_by: null,
          disengagement_confirmed_by: null,
          disengagement_notes: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id,agency_id" }
      )
      .select(
        `
        id,
        store_id,
        agency_id,
        status,
        is_default,
        is_exclusive,
        delivery_billing_mode,
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
      .single();

    if (connectionError) throw connectionError;

    const { error: updateSettingsError } = await supabase
      .from("store_delivery_settings")
      .update({
        delivery_provider: "transport_agency",
        transport_agency_id: agency.id,
        transport_agency_connection_id: connection.id,
        updated_at: new Date().toISOString(),
      })
      .eq("store_id", storeId);

    if (updateSettingsError) throw updateSettingsError;

    return NextResponse.json({
      ok: true,
      connection,
      message:
        deliveryBillingMode === "credit"
          ? "Comercio conectado a Entrega2 Somos como credito."
          : "Comercio conectado a Entrega2 Somos como contado.",
    });
  } catch (error) {
    return transportErrorResponse(error, "Error conectando comercio Entrega2.");
  }
}
