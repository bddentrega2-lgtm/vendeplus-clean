import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { normalizePhone } from "@/lib/customers/normalize-phone";
import { safeUpsertCustomerFromOrder } from "@/lib/customers/upsert-customer-from-order";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json().catch(() => ({}));
    const requestedStoreId = cleanText(body.storeId);
    const supabase = createSupabaseAdminClient();

    if (requestedStoreId) {
      assertStoreAccess(
        auth,
        requestedStoreId,
        "No tienes permiso para reconstruir clientes de este comercio."
      );
    }

    let ordersQuery = supabase
      .from("orders")
      .select(
        `
        id,
        store_id,
        customer_name,
        customer_phone,
        delivery_type,
        payment_method,
        delivery_reference,
        total_usd,
        created_at
      `
      )
      .not("customer_phone", "is", null)
      .order("created_at", { ascending: true })
      .limit(1000);

    if (auth.storeIds !== null) {
      ordersQuery = ordersQuery.in("store_id", auth.storeIds);
    }

    if (requestedStoreId) {
      ordersQuery = ordersQuery.eq("store_id", requestedStoreId);
    }

    const { data: orders, error } = await ordersQuery;

    if (error) throw error;

    let processed = 0;
    let skipped = 0;

    for (const order of orders || []) {
      const phoneNormalized = normalizePhone((order as any).customer_phone);

      if (!phoneNormalized) {
        skipped += 1;
        continue;
      }

      await supabase
        .from("orders")
        .update({ customer_phone_normalized: phoneNormalized })
        .eq("id", (order as any).id);

      const customerId = await safeUpsertCustomerFromOrder(supabase, {
        id: (order as any).id,
        store_id: (order as any).store_id,
        customer_name: (order as any).customer_name || "Cliente",
        customer_phone: (order as any).customer_phone,
        delivery_type: (order as any).delivery_type,
        payment_method: (order as any).payment_method,
        delivery_reference: (order as any).delivery_reference,
        total_usd: (order as any).total_usd,
        created_at: (order as any).created_at,
      });

      if (customerId) processed += 1;
      else skipped += 1;
    }

    return NextResponse.json({
      ok: true,
      processed,
      skipped,
      totalOrders: orders?.length || 0,
    });
  } catch (error: any) {
    return panelErrorResponse(error, "Error reconstruyendo clientes.");
  }
}
