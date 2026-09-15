import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertAgencyRole,
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ transportOrderId: string }> }
) {
  try {
    const { transportOrderId } = await context.params;
    const auth = await requireTransportAgencyAuth(request);
    const supabase = createSupabaseAdminClient();
    const { data: order, error: orderError } = await supabase
      .from("transport_orders")
      .select("id, agency_id, particular_request_id")
      .eq("id", transportOrderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order?.particular_request_id) {
      return NextResponse.json({ error: "Este servicio no tiene comprobante particular." }, { status: 404 });
    }

    assertAgencyRole(
      auth,
      order.agency_id,
      ["owner", "admin", "operator"],
      "Tu rol no permite ver este comprobante."
    );

    const { data: receipt, error: receiptError } = await supabase
      .from("transport_particular_payment_receipts")
      .select("storage_path")
      .eq("agency_id", order.agency_id)
      .eq("particular_request_id", order.particular_request_id)
      .not("storage_path", "is", null)
      .is("deleted_at", null)
      .maybeSingle();

    if (receiptError) throw receiptError;
    if (!receipt?.storage_path) {
      return NextResponse.json({ error: "El comprobante ya no esta disponible." }, { status: 404 });
    }

    const signed = await supabase.storage.from("payment-receipts").createSignedUrl(receipt.storage_path, 300);
    if (signed.error) throw signed.error;

    return NextResponse.json({ url: signed.data.signedUrl });
  } catch (error) {
    return transportErrorResponse(error, "No se pudo abrir el comprobante.");
  }
}
