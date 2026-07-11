import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanTransportText } from "@/lib/transport";
import {
  assertAgencyManager,
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";
import {
  isTransportConnectionEnded,
  isTransportDisengagementPending,
} from "@/lib/transport/disengagement";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await context.params;
    const auth = await requireTransportAgencyAuth(request);
    const body = await request.json().catch(() => ({}));
    const relationshipMode = cleanTransportText(body.relationshipMode);
    const isExclusive =
      relationshipMode === "exclusive"
        ? true
        : relationshipMode === "mixed"
          ? false
          : null;

    if (isExclusive === null) {
      return badRequest("Modalidad invalida.");
    }

    const supabase = createSupabaseAdminClient();

    const { data: connection, error: connectionError } = await supabase
      .from("store_transport_agency_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("status", "active")
      .maybeSingle();

    if (connectionError) throw connectionError;
    if (!connection) return badRequest("Conexion no encontrada.");
    assertAgencyManager(auth, connection.agency_id, "Tu rol no permite cambiar esta afiliacion.");

    if (isTransportConnectionEnded(connection)) {
      return badRequest("Esta afiliacion ya finalizo.");
    }
    if (isTransportDisengagementPending(connection)) {
      return badRequest("Esta afiliacion esta en proceso de desafiliacion.");
    }

    if (isExclusive) {
      const { data: activeConnections, error: activeConnectionsError } = await supabase
        .from("store_transport_agency_connections")
        .select(
          "id, agency_id, status, is_exclusive, disengagement_requested_at, disengagement_confirmed_at, disengagement_effective_at"
        )
        .eq("store_id", connection.store_id)
        .eq("status", "active");

      if (activeConnectionsError) throw activeConnectionsError;

      const otherActiveConnections = (activeConnections || []).filter(
        (entry: any) => entry.id !== connection.id && !isTransportConnectionEnded(entry)
      );

      if (otherActiveConnections.length) {
        return badRequest(
          "Para marcar esta afiliacion como exclusiva, primero deben finalizar las demas afiliaciones activas del comercio."
        );
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("store_transport_agency_connections")
      .update({
        is_exclusive: isExclusive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id)
      .select("*")
      .maybeSingle();

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      connection: updated,
      message: isExclusive
        ? "Afiliacion marcada como exclusiva."
        : "Afiliacion marcada como mixta.",
    });
  } catch (error) {
    return transportErrorResponse(error, "Error actualizando modalidad de afiliacion.");
  }
}
