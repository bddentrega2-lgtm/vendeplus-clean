import { NextRequest, NextResponse } from "next/server";
import {
  assertStoreManager,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  cleanTransportText,
  getTransportAgencyConfigIssues,
  getTransportAgencyRateFromRelation,
} from "@/lib/transport";
import { isTransportConnectionEnded } from "@/lib/transport/disengagement";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ agencyId: string }> }
) {
  try {
    const { agencyId } = await context.params;
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const storeId = cleanTransportText(body.storeId);

    if (!storeId) return badRequest("Falta el comercio.");
    assertStoreManager(auth, storeId, "No tienes permiso para este comercio.");

    const supabase = createSupabaseAdminClient();
    const { data: agency, error: agencyError } = await supabase
      .from("transport_agencies")
      .select(
        `
        id,
        status,
        is_active,
        modality,
        name,
        contact_name,
        contact_email,
        contact_phone,
        whatsapp_phone,
        city,
        pricing_type,
        transport_agency_rates (*),
        transport_agency_zones (*),
        transport_agency_distance_rates (*)
      `
      )
      .eq("id", agencyId)
      .maybeSingle();

    if (agencyError) throw agencyError;
    if (!agency || agency.status !== "active" || agency.is_active === false) {
      return badRequest("La empresa delivery no esta disponible.");
    }
    const configIssues = getTransportAgencyConfigIssues({
      agency,
      rate: getTransportAgencyRateFromRelation(agency.transport_agency_rates),
      zones: agency.transport_agency_zones || [],
      distanceRates: agency.transport_agency_distance_rates || [],
    });
    if (configIssues.length) {
      return badRequest(
        `La empresa delivery todavia no completo su configuracion: ${configIssues.join(", ")}.`
      );
    }

    const { data: existingConnections, error: existingConnectionsError } = await supabase
      .from("store_transport_agency_connections")
      .select("id, agency_id, status, is_exclusive, disengagement_requested_at, disengagement_confirmed_at, disengagement_effective_at")
      .eq("store_id", storeId)
      .eq("status", "active");

    if (existingConnectionsError) throw existingConnectionsError;

    const activeConnections = (existingConnections || []).filter(
      (connection: any) => !isTransportConnectionEnded(connection)
    );
    const hasSameActiveConnection = activeConnections.some(
      (connection: any) => connection.agency_id === agencyId
    );
    const hasOtherExclusiveConnection = activeConnections.some(
      (connection: any) => connection.is_exclusive && connection.agency_id !== agencyId
    );
    if (hasOtherExclusiveConnection) {
      return badRequest(
        "Este comercio ya tiene una empresa delivery exclusiva activa. Para trabajar con otra, primero debes desactivar la relacion actual."
      );
    }

    if (hasSameActiveConnection) {
      return badRequest("Este comercio ya esta afiliado a esta empresa delivery.");
    }

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, whatsapp, address, latitude, longitude, opening_hours, description")
      .eq("id", storeId)
      .maybeSingle();

    if (storeError) throw storeError;
    if (!store) return badRequest("Comercio no encontrado.");

    const { data: existingRequest, error: existingRequestError } = await supabase
      .from("store_transport_agency_requests")
      .select("*")
      .eq("store_id", storeId)
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (existingRequestError) throw existingRequestError;
    if (existingRequest?.status === "pending") {
      return NextResponse.json({
        request: existingRequest,
        message: "Ya existe una solicitud pendiente para esta empresa delivery.",
      });
    }

    const contactName = cleanTransportText(body.contactName, 120) || store.name || null;
    const contactPhone = cleanTransportText(body.contactPhone, 40) || store.whatsapp || null;

    const { data, error } = await supabase
      .from("store_transport_agency_requests")
      .upsert(
        {
          store_id: storeId,
          agency_id: agencyId,
          requested_by: auth.userId || null,
          contact_name: contactName,
          contact_phone: contactPhone,
          message: cleanTransportText(body.message, 400) || null,
          response_notes: null,
          store_name_snapshot: store.name || null,
          store_phone_snapshot: store.whatsapp || null,
          store_contact_name_snapshot: contactName,
          store_address_snapshot: store.address || null,
          store_latitude_snapshot: store.latitude ?? null,
          store_longitude_snapshot: store.longitude ?? null,
          store_schedule_snapshot: store.opening_hours || null,
          store_description_snapshot: store.description || null,
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id,agency_id" }
      )
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      request: data,
      message:
        existingRequest?.status === "rejected" || existingRequest?.status === "cancelled"
          ? "Solicitud enviada nuevamente a la empresa delivery."
          : "Solicitud enviada a la empresa delivery.",
    });
  } catch (error) {
    return panelErrorResponse(error, "Error enviando solicitud a la empresa delivery.");
  }
}
