import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertStoreAccess, panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const auth = await requirePanelAuth(request);
    const { orderId } = await params;
    const supabase = createSupabaseAdminClient();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, store_id")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    assertStoreAccess(auth, order.store_id, "No tienes acceso a este comprobante.");

    const { data: receipt, error } = await supabase
      .from("order_payment_receipts")
      .select("storage_path")
      .eq("order_id", order.id)
      .eq("store_id", order.store_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!receipt?.storage_path) {
      return NextResponse.json({ error: "El comprobante ya no está disponible." }, { status: 404 });
    }
    const signed = await supabase.storage.from("payment-receipts").createSignedUrl(receipt.storage_path, 300);
    if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error("No signed URL");
    return NextResponse.json({ url: signed.data.signedUrl, expiresIn: 300 });
  } catch (error) {
    return panelErrorResponse(error, "No se pudo abrir el comprobante.");
  }
}
