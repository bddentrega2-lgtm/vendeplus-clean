import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import {
  buildRepeatLastOrderMessage,
  buildWhatsappUrl,
} from "@/lib/customers/customer-messages";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = await requirePanelAuth(request);
    const { customerId } = await context.params;

    if (!customerId) return badRequest("Falta el cliente.");

    const supabase = createSupabaseAdminClient();
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, store_id, name, phone, stores(name)")
      .eq("id", customerId)
      .single();

    if (customerError) throw customerError;

    assertStoreAccess(
      auth,
      customer.store_id,
      "No tienes permiso para ver este cliente."
    );

    const { data: lastOrder, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        id,
        created_at,
        order_items (
          product_name,
          variant_name,
          quantity
        )
      `
      )
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) throw orderError;

    const message = buildRepeatLastOrderMessage({
      customerName: customer.name,
      storeName: (customer.stores as any)?.name || "tu comercio",
      items: lastOrder?.order_items || [],
    });

    return NextResponse.json({
      message,
      whatsappUrl: buildWhatsappUrl(customer.phone, message),
      lastOrderId: lastOrder?.id || null,
    });
  } catch (error: any) {
    return panelErrorResponse(error, "Error generando mensaje de recompra.");
  }
}
