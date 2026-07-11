import { NextRequest, NextResponse } from "next/server";
import {
  assertStoreManager,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanTransportText } from "@/lib/transport";
import {
  getTransportDisengagementEffectiveAt,
  isTransportConnectionEnded,
} from "@/lib/transport/disengagement";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await context.params;
    const auth = await requirePanelAuth(request);
    const body = await request.json().catch(() => ({}));
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
      return badRequest("Esta afiliacion ya finalizo.");
    }

    if (connection.disengagement_confirmed_at && connection.disengagement_effective_at) {
      return NextResponse.json({
        ok: true,
        status: "confirmed",
        effectiveAt: connection.disengagement_effective_at,
        message: "La desafiliacion ya fue confirmada.",
      });
    }

    if (connection.disengagement_requested_at && !connection.disengagement_confirmed_at) {
      if (connection.disengagement_requested_by === "agency") {
        const now = new Date();
        const effectiveAt = getTransportDisengagementEffectiveAt(now);
        const notes =
          cleanTransportText(body.notes, 300) ||
          connection.disengagement_notes ||
          "Desafiliacion confirmada por el comercio.";

        const { data: updated, error: confirmError } = await supabase
          .from("store_transport_agency_connections")
          .update({
            disengagement_confirmed_at: now.toISOString(),
            disengagement_effective_at: effectiveAt,
            disengagement_confirmed_by: "commerce",
            disengagement_notes: notes,
            updated_at: now.toISOString(),
          })
          .eq("id", connectionId)
          .select("*")
          .maybeSingle();

        if (confirmError) throw confirmError;

        return NextResponse.json({
          ok: true,
          status: "confirmed",
          connection: updated,
          effectiveAt,
          message: "Desafiliacion confirmada y ejecutada.",
        });
      }

      return NextResponse.json({
        ok: true,
        status: "pending_agency_confirmation",
        message: "La desafiliacion ya fue solicitada. Espera la confirmacion de la empresa delivery.",
      });
    }

    const notes =
      cleanTransportText(body.notes, 300) ||
      "Solicitud de desafiliacion enviada por el comercio.";
    const requestedAt = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("store_transport_agency_connections")
      .update({
        disengagement_requested_at: requestedAt,
        disengagement_confirmed_at: null,
        disengagement_effective_at: null,
        disengagement_requested_by: "commerce",
        disengagement_confirmed_by: null,
        disengagement_notes: notes,
        updated_at: requestedAt,
      })
      .eq("id", connectionId)
      .select("*")
      .maybeSingle();

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      status: "pending_agency_confirmation",
      connection: updated,
      message:
        "Solicitud enviada. La empresa delivery debe confirmar la salida.",
    });
  } catch (error) {
    return panelErrorResponse(error, "Error solicitando desafiliacion.");
  }
}
