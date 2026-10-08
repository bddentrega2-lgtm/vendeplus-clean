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
      .select("id,status,delivery_type,delivery_status")
      .eq("id", orderId).eq("store_id", store.id).eq("public_code", publicCode).maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.delivery_type !== "delivery") {
      return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    const { data: integration, error: integrationError } = await db.from("order_integrations")
      .select("status,created_at,updated_at")
      .eq("order_id", order.id).eq("provider", "entrega2").maybeSingle();
    if (integrationError) throw integrationError;

    return NextResponse.json({
      orderStatus: order.status,
      deliveryStatus: order.delivery_status,
      entrega2Status: integration?.status || null,
      entrega2CreatedAt: integration?.created_at || null,
      updatedAt: integration?.updated_at || null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar el seguimiento." }, { status: 500 });
  }
}
