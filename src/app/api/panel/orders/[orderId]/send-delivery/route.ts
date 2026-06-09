import { NextRequest, NextResponse } from "next/server";
import {
  getEntrega2ExternalOrderId,
  getEntrega2Provider,
  sendEntrega2Order,
} from "@/lib/integrations/entrega2";
import {
  assertStoreAccess,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function optionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Error desconocido enviando a Entrega2.";
}

function buildEntrega2Payload(order: any) {
  const externalOrderId = getEntrega2ExternalOrderId(order.id);

  return {
    externalOrderId,
    orderId: order.id,
    publicCode: order.public_code,
    source: "vendeplus",
    store: {
      id: order.store_id,
      name: order.stores?.name || "Comercio",
      phone: order.stores?.whatsapp || null,
      address: order.stores?.address || null,
      latitude: optionalNumber(order.stores?.latitude),
      longitude: optionalNumber(order.stores?.longitude),
    },
    customer: {
      name: order.customer_name,
      phone: order.customer_phone,
    },
    delivery: {
      reference: order.delivery_reference,
      notes: order.order_details || order.notes || null,
      latitude: optionalNumber(order.delivery_lat),
      longitude: optionalNumber(order.delivery_lng),
      distanceKm: optionalNumber(order.distance_km),
    },
    payment: {
      method: order.payment_method,
      subtotalUsd: optionalNumber(order.subtotal_usd) || 0,
      deliveryUsd: optionalNumber(order.delivery_usd) || 0,
      totalUsd: optionalNumber(order.total_usd) || 0,
      totalBs: optionalNumber(order.total_bs) || 0,
    },
    items: (order.order_items || []).map((item: any) => ({
      name: item.product_name,
      variant: item.variant_name || null,
      quantity: optionalNumber(item.quantity) || 1,
      unitPriceUsd: optionalNumber(item.unit_price_usd) || 0,
      totalUsd: optionalNumber(item.total_usd) || 0,
      notes: item.notes || null,
    })),
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const auth = await requirePanelAuth(request);
    const { orderId } = await context.params;

    if (!orderId) {
      return badRequest("Falta el ID del pedido.");
    }

    const supabase = createSupabaseAdminClient();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        id,
        public_code,
        store_id,
        customer_name,
        customer_phone,
        delivery_type,
        payment_method,
        subtotal_usd,
        delivery_usd,
        total_usd,
        total_bs,
        distance_km,
        delivery_lat,
        delivery_lng,
        delivery_reference,
        order_details,
        notes,
        status,
        stores (
          id,
          name,
          whatsapp,
          address,
          latitude,
          longitude
        ),
        order_items (
          product_name,
          variant_name,
          quantity,
          unit_price_usd,
          total_usd,
          notes
        )
      `
      )
      .eq("id", orderId)
      .single();

    if (orderError) throw orderError;

    assertStoreAccess(
      auth,
      order.store_id,
      "No tienes permiso para enviar este pedido."
    );

    if (order.delivery_type !== "delivery") {
      return badRequest("Solo los pedidos delivery se pueden enviar a Entrega2.");
    }

    if (!cleanText(order.customer_name) || !cleanText(order.customer_phone)) {
      return badRequest("El pedido necesita nombre y telefono del cliente.");
    }

    if (
      !cleanText(order.delivery_reference) &&
      (optionalNumber(order.delivery_lat) === null ||
        optionalNumber(order.delivery_lng) === null)
    ) {
      return badRequest(
        "El pedido necesita referencia o coordenadas de entrega antes de enviarlo."
      );
    }

    const provider = getEntrega2Provider();
    const externalOrderId = getEntrega2ExternalOrderId(order.id);
    const { data: existingIntegration, error: existingError } = await supabase
      .from("order_integrations")
      .select("id, status")
      .eq("order_id", order.id)
      .eq("provider", provider)
      .maybeSingle();

    if (existingError) throw existingError;

    if (
      existingIntegration &&
      !["error", "failed"].includes(existingIntegration.status)
    ) {
      return NextResponse.json(
        { error: "Este pedido ya fue enviado a Entrega2." },
        { status: 409 }
      );
    }

    const requestPayload = buildEntrega2Payload(order);

    const { error: pendingIntegrationError } = await supabase
      .from("order_integrations")
      .upsert(
        {
          order_id: order.id,
          provider,
          external_id: externalOrderId,
          status: "sending",
          request_payload: requestPayload,
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id,provider" }
      );

    if (pendingIntegrationError) throw pendingIntegrationError;

    try {
      const entrega2Response = await sendEntrega2Order(requestPayload);

      const { data: integration, error: integrationError } = await supabase
        .from("order_integrations")
        .upsert(
          {
            order_id: order.id,
            provider,
            external_id: externalOrderId,
            status: "sent",
            request_payload: requestPayload,
            last_payload: entrega2Response.payload,
            last_error: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "order_id,provider" }
        )
        .select()
        .single();

      if (integrationError) throw integrationError;

      return NextResponse.json({
        ok: true,
        integration,
        entrega2: entrega2Response.payload,
      });
    } catch (error) {
      await supabase.from("order_integrations").upsert(
        {
          order_id: order.id,
          provider,
          external_id: externalOrderId,
          status: "error",
          request_payload: requestPayload,
          last_payload:
            error && typeof error === "object" && "payload" in error
              ? (error as { payload: unknown }).payload
              : null,
          last_error: serializeError(error),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id,provider" }
      );

      throw error;
    }
  } catch (error: any) {
    return panelErrorResponse(error, "Error enviando pedido a Entrega2.");
  }
}
