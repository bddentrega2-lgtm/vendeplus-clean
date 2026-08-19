import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStoreIdByTableOrderToken } from "@/lib/server/table-order-tokens";

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("orderId") || "";
  const storeToken = request.nextUrl.searchParams.get("token") || "";
  if (!orderId || !storeToken) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const storeId = await getStoreIdByTableOrderToken(supabase, storeToken);
  if (!storeId) return NextResponse.json({ error: "Acceso no disponible." }, { status: 404 });

  const { data: order } = await supabase
    .from("orders")
    .select("public_code, status, payment_status, table_name_snapshot, table_zone_snapshot, table_fulfillment_snapshot")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .eq("delivery_type", "table")
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

  return NextResponse.json({ order });
}
