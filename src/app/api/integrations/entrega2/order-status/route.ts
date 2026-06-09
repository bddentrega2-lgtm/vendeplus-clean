import { NextRequest, NextResponse } from "next/server";
import {
  getEntrega2Provider,
  isValidEntrega2Webhook,
  normalizeEntrega2OrderStatus,
} from "@/lib/integrations/entrega2";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function getPayloadStatus(payload: any) {
  return (
    cleanText(payload.status) ||
    cleanText(payload.estado) ||
    cleanText(payload.deliveryStatus) ||
    cleanText(payload.orderStatus)
  );
}

function getPayloadExternalId(payload: any) {
  return (
    cleanText(payload.externalOrderId) ||
    cleanText(payload.external_id) ||
    cleanText(payload.orderId) ||
    cleanText(payload.order_id) ||
    cleanText(payload.id)
  );
}

async function findIntegration(supabase: any, externalId: string) {
  const provider = getEntrega2Provider();
  const { data: byExternalId, error: externalError } = await supabase
    .from("order_integrations")
    .select("id, order_id")
    .eq("provider", provider)
    .eq("external_id", externalId)
    .maybeSingle();

  if (externalError) throw externalError;
  if (byExternalId) return byExternalId;

  const orderId = externalId.replace(/^vendeplus_/, "");
  const { data: byOrderId, error: orderError } = await supabase
    .from("order_integrations")
    .select("id, order_id")
    .eq("provider", provider)
    .eq("order_id", orderId)
    .maybeSingle();

  if (orderError) throw orderError;

  return byOrderId;
}

export async function POST(request: NextRequest) {
  if (!isValidEntrega2Webhook(request.headers)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const externalId = getPayloadExternalId(payload);
    const integrationStatus = getPayloadStatus(payload);

    if (!externalId) {
      return NextResponse.json(
        { error: "Falta el identificador del pedido." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const integration = await findIntegration(supabase, externalId);

    if (!integration) {
      return NextResponse.json(
        { error: "No se encontró la integración del pedido." },
        { status: 404 }
      );
    }

    const vendeplusStatus = normalizeEntrega2OrderStatus(integrationStatus);

    const { error: updateError } = await supabase
      .from("order_integrations")
      .update({
        status: integrationStatus || "updated",
        last_payload: payload,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    if (updateError) throw updateError;

    if (vendeplusStatus) {
      const { error: orderError } = await supabase
        .from("orders")
        .update({ status: vendeplusStatus })
        .eq("id", integration.order_id);

      if (orderError) throw orderError;
    }

    return NextResponse.json({
      ok: true,
      orderId: integration.order_id,
      mappedStatus: vendeplusStatus,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error procesando webhook de Entrega2." },
      { status: 500 }
    );
  }
}
