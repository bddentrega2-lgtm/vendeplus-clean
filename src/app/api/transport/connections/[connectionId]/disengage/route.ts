import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanTransportText } from "@/lib/transport";
import {
  assertAgencyManager,
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";
import {
  getTransportDisengagementEffectiveAt,
  isTransportConnectionEnded,
} from "@/lib/transport/disengagement";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await context.params;
    const auth = await requireTransportAgencyAuth(request);
    const body = await request.json().catch(() => ({}));
    const action = cleanTransportText(body.action);
    const supabase = createSupabaseAdminClient();

    if (!["request", "confirm"].includes(action)) {
      return badRequest("Accion invalida.");
    }

    const { data: connection, error: connectionError } = await supabase
      .from("store_transport_agency_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("status", "active")
      .maybeSingle();

    if (connectionError) throw connectionError;
    if (!connection) return badRequest("Conexion no encontrada.");
    assertAgencyManager(auth, connection.agency_id, "Tu rol no permite gestionar desafiliaciones.");

    if (isTransportConnectionEnded(connection)) {
      return badRequest("Esta afiliacion ya finalizo.");
    }

    if (connection.disengagement_confirmed_at && connection.disengagement_effective_at) {
      return NextResponse.json({
        ok: true,
        connection,
        effectiveAt: connection.disengagement_effective_at,
        message: "La desafiliacion ya fue confirmada.",
      });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const effectiveAt = getTransportDisengagementEffectiveAt(now);

    if (
      action === "confirm" &&
      connection.disengagement_requested_at &&
      connection.disengagement_requested_by === "agency"
    ) {
      return badRequest("La empresa delivery ya solicito la desafiliacion. Ahora debe confirmarla el comercio.");
    }

    if (
      action === "confirm" &&
      connection.disengagement_requested_at &&
      connection.disengagement_requested_by &&
      connection.disengagement_requested_by !== "commerce"
    ) {
      return badRequest("Solo puedes confirmar una desafiliacion solicitada por el comercio.");
    }

    if (action === "confirm" && !connection.disengagement_requested_at) {
      return badRequest("Primero el comercio debe solicitar la desafiliacion.");
    }

    if (
      action === "request" &&
      connection.disengagement_requested_at &&
      !connection.disengagement_confirmed_at
    ) {
      return NextResponse.json({
        ok: true,
        connection,
        status: "pending_confirmation",
        message:
          connection.disengagement_requested_by === "agency"
            ? "La solicitud ya fue enviada. Espera la confirmacion del comercio."
            : "El comercio ya solicito la desafiliacion. Puedes confirmarla desde este panel.",
      });
    }

    const notes =
      cleanTransportText(body.notes, 300) ||
      (action === "confirm"
        ? "Desafiliacion confirmada por la empresa delivery."
        : "Desafiliacion iniciada por la empresa delivery.");

    const payload =
      action === "confirm"
        ? {
            disengagement_requested_at:
              connection.disengagement_requested_at || nowIso,
            disengagement_confirmed_at: nowIso,
            disengagement_effective_at: effectiveAt,
            disengagement_confirmed_by: "agency",
            disengagement_notes: notes,
            updated_at: nowIso,
          }
        : {
            disengagement_requested_at: nowIso,
            disengagement_confirmed_at: null,
            disengagement_effective_at: null,
            disengagement_requested_by: "agency",
            disengagement_confirmed_by: null,
            disengagement_notes: notes,
            updated_at: nowIso,
          };

    const { data: updated, error: updateError } = await supabase
      .from("store_transport_agency_connections")
      .update(payload)
      .eq("id", connectionId)
      .select("*")
      .maybeSingle();

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      connection: updated,
      effectiveAt: action === "confirm" ? effectiveAt : null,
      message:
        action === "confirm"
          ? "Desafiliacion confirmada y ejecutada."
          : "Solicitud enviada. El comercio debe confirmar la salida.",
    });
  } catch (error) {
    return transportErrorResponse(error, "Error gestionando desafiliacion.");
  }
}
