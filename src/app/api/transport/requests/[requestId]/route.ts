import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertAgencyManager,
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";
import {
  cleanTransportText,
  getTransportAgencyConfigIssues,
  getTransportAgencyRateFromRelation,
} from "@/lib/transport";
import { isTransportConnectionEnded } from "@/lib/transport/disengagement";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await context.params;
    const auth = await requireTransportAgencyAuth(request);
    const body = await request.json();
    const action = cleanTransportText(body.action);
    const relationshipMode = cleanTransportText(body.relationshipMode);
    const supabase = createSupabaseAdminClient();

    if (relationshipMode && !["exclusive", "mixed"].includes(relationshipMode)) {
      return badRequest("Modalidad de afiliacion invalida.");
    }

    const { data: transportRequest, error: loadError } = await supabase
      .from("store_transport_agency_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (loadError) throw loadError;
    if (!transportRequest) return badRequest("Solicitud no encontrada.");
    assertAgencyManager(auth, transportRequest.agency_id, "Tu rol no permite revisar solicitudes.");

    if (!["approve", "reject"].includes(action)) return badRequest("Accion invalida.");

    const nextStatus = action === "approve" ? "approved" : "rejected";
    let agency: any = null;

    if (action === "approve") {
      const { data: agencyData, error: agencyError } = await supabase
        .from("transport_agencies")
        .select(
          `
          *,
          transport_agency_rates (*),
          transport_agency_zones (*),
          transport_agency_distance_rates (*)
        `
        )
        .eq("id", transportRequest.agency_id)
        .maybeSingle();
      if (agencyError) throw agencyError;
      agency = agencyData;
      const issues = getTransportAgencyConfigIssues({
        agency,
        rate: getTransportAgencyRateFromRelation(agency?.transport_agency_rates),
        zones: agency?.transport_agency_zones || [],
        distanceRates: agency?.transport_agency_distance_rates || [],
      });
      if (issues.length) {
        return badRequest(`Completa la configuracion antes de aprobar: ${issues.join(", ")}.`);
      }

      const { data: existingConnections, error: existingConnectionsError } = await supabase
        .from("store_transport_agency_connections")
        .select("id, agency_id, status, is_exclusive, disengagement_requested_at, disengagement_confirmed_at, disengagement_effective_at")
        .eq("store_id", transportRequest.store_id)
        .eq("status", "active");
      if (existingConnectionsError) throw existingConnectionsError;

      const activeConnections = (existingConnections || []).filter(
        (connection: any) => !isTransportConnectionEnded(connection)
      );
      const wantsExclusive =
        relationshipMode === "exclusive" ||
        (!relationshipMode && agency?.modality === "exclusive");
      const hasOtherExclusiveConnection = activeConnections.some(
        (connection: any) =>
          connection.is_exclusive && connection.agency_id !== transportRequest.agency_id
      );
      const hasOtherActiveConnection = activeConnections.some(
        (connection: any) => connection.agency_id !== transportRequest.agency_id
      );

      if (hasOtherExclusiveConnection) {
        return badRequest(
          "Este comercio ya tiene una empresa delivery exclusiva activa. Para aprobar otra, primero debe desactivar la relacion actual."
        );
      }

      if (wantsExclusive && hasOtherActiveConnection) {
        return badRequest(
          "Para aprobar esta afiliacion como exclusiva, primero deben finalizar las otras relaciones activas del comercio."
        );
      }
    }

    const { error: updateError } = await supabase
      .from("store_transport_agency_requests")
      .update({
        status: nextStatus,
        response_notes: cleanTransportText(body.responseNotes, 300) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    if (updateError) throw updateError;

    if (action === "approve") {
      const { data: existingDefault } = await supabase
        .from("store_transport_agency_connections")
        .select("id, disengagement_requested_at, disengagement_confirmed_at, disengagement_effective_at")
        .eq("store_id", transportRequest.store_id)
        .eq("status", "active")
        .eq("is_default", true)
        .maybeSingle();

      const { error: connectionError } = await supabase
        .from("store_transport_agency_connections")
        .upsert(
          {
            store_id: transportRequest.store_id,
            agency_id: transportRequest.agency_id,
            request_id: requestId,
            status: "active",
            is_default: !existingDefault || isTransportConnectionEnded(existingDefault),
            is_exclusive:
              relationshipMode === "exclusive" ||
              (!relationshipMode && agency?.modality === "exclusive"),
            disengagement_requested_at: null,
            disengagement_confirmed_at: null,
            disengagement_effective_at: null,
            disengagement_requested_by: null,
            disengagement_confirmed_by: null,
            disengagement_notes: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "store_id,agency_id" }
        );
      if (connectionError) throw connectionError;
    }

    return NextResponse.json({
      ok: true,
      status: nextStatus,
      message: action === "approve" ? "Solicitud aprobada." : "Solicitud rechazada.",
    });
  } catch (error) {
    return transportErrorResponse(error, "Error revisando solicitud.");
  }
}
