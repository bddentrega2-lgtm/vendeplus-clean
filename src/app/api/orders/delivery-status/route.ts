import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId")?.trim() || "";
  const storeSlug = searchParams.get("storeSlug")?.trim() || "";
  const publicCode = searchParams.get("code")?.trim() || "";
  if (!UUID.test(orderId) || !SLUG.test(storeSlug) || !publicCode || publicCode.length > 50) {
    return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
  }

  try {
    const db = createSupabaseAdminClient();
    const { data: store, error: storeError } = await db.from("stores")
      .select("id").eq("slug", storeSlug).maybeSingle();
    if (storeError) throw storeError;
    if (!store) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

    const { data: order, error: orderError } = await db.from("orders")
      .select("id,status,delivery_type,delivery_provider,delivery_status,transport_agency_id,selected_transport_agency:transport_agencies!orders_transport_agency_id_fkey(slug)")
      .eq("id", orderId).eq("store_id", store.id).eq("public_code", publicCode).maybeSingle();
    if (orderError) throw orderError;
    if (!order || !["delivery", "pickup"].includes(order.delivery_type)) {
      return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    const agency = Array.isArray(order.selected_transport_agency)
      ? order.selected_transport_agency[0] : order.selected_transport_agency;
    const currentEntrega2 = order.delivery_type === "delivery" && (
      order.delivery_provider === "entrega2" ||
      (order.delivery_provider === "transport_agency" && agency?.slug === "entrega2")
    );
    let integration: { status: string; created_at: string; updated_at: string } | null = null;
    let agencyStatus: string | null = null;
    if (currentEntrega2) {
      const result = await db.from("order_integrations")
        .select("status,created_at,updated_at")
        .eq("order_id", order.id).eq("provider", "entrega2").maybeSingle();
      if (result.error) throw result.error;
      integration = result.data;
    } else if (order.delivery_type === "delivery" && order.delivery_provider === "transport_agency" && order.transport_agency_id) {
      const result = await db.from("transport_orders")
        .select("status").eq("order_id", order.id)
        .eq("agency_id", order.transport_agency_id).maybeSingle();
      if (result.error) throw result.error;
      agencyStatus = result.data?.status || null;
    }

    return NextResponse.json({
      orderStatus: order.status,
      deliveryType: order.delivery_type,
      deliveryStatus: order.delivery_status,
      agencyStatus,
      entrega2Status: integration?.status || null,
      entrega2CreatedAt: integration?.created_at || null,
      updatedAt: integration?.updated_at || null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar el seguimiento." }, { status: 500 });
  }
}
