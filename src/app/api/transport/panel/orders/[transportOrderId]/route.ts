import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertAgencyRole,
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";
import { isPremiumDispatchSchemaMissing } from "@/lib/transport/driver-dispatch";

const transportOrderDetailSelect = `
  id,
  order_id,
  store_id,
  agency_id,
  connection_id,
  status,
  store_name_snapshot,
  store_whatsapp_snapshot,
  customer_name_snapshot,
  customer_phone_snapshot,
  delivery_address,
  delivery_reference,
  delivery_zone_name,
  delivery_fee_usd,
  driver_id,
  driver_name_snapshot,
  driver_commission_percent,
  driver_payout_usd,
  driver_assigned_at,
  commerce_note,
  agency_status_note,
  rejection_reason,
  created_at,
  stores (id, name, slug, whatsapp),
  orders (
    id,
    public_code,
    total_usd,
    payment_method,
    payment_status,
    status,
    created_at,
    delivery_lat,
    delivery_lng,
    delivery_reference,
    delivery_notes,
    order_details,
    notes,
    order_items (
      id,
      product_name,
      variant_name,
      quantity,
      unit_price_usd,
      notes
    )
  ),
  transport_order_events (
    id,
    event_type,
    status_from,
    status_to,
    note,
    actor_type,
    actor_name,
    created_at
  )
`;

const transportOrderDetailSelectWithoutDrivers = transportOrderDetailSelect
  .replace("driver_id,", "")
  .replace("driver_name_snapshot,", "")
  .replace("driver_commission_percent,", "")
  .replace("driver_payout_usd,", "")
  .replace("driver_assigned_at,", "");

function notFound() {
  return NextResponse.json(
    { error: "Pedido de empresa delivery no encontrado." },
    { status: 404 }
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ transportOrderId: string }> }
) {
  try {
    const { transportOrderId } = await context.params;
    const auth = await requireTransportAgencyAuth(request);
    const supabase = createSupabaseAdminClient();

    const buildQuery = (selectClause: string) =>
      supabase
        .from("transport_orders")
        .select(selectClause)
        .eq("id", transportOrderId)
        .order("created_at", {
          foreignTable: "transport_order_events",
          ascending: false,
        })
        .maybeSingle();

    let result = await buildQuery(transportOrderDetailSelect);
    if (result.error && isPremiumDispatchSchemaMissing(result.error)) {
      result = await buildQuery(transportOrderDetailSelectWithoutDrivers);
    }

    const { data, error } = result;
    if (error) throw error;
    if (!data) return notFound();

    assertAgencyRole(
      auth,
      (data as any).agency_id,
      ["owner", "admin", "operator"],
      "Tu rol no permite ver este pedido."
    );

    return NextResponse.json({
      order: { ...(data as Record<string, any>), __detailsLoaded: true },
    });
  } catch (error) {
    return transportErrorResponse(error, "Error cargando detalle del pedido delivery.");
  }
}
