import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { getCustomerBadges } from "@/lib/customers/customer-segments";
import {
  buildContactAgainMessage,
  buildRepeatLastOrderMessage,
  buildWhatsappUrl,
} from "@/lib/customers/customer-messages";

function cleanText(value: unknown, maxLength = 1000) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((tag) => cleanText(tag, 40))
    .filter(Boolean)
    .slice(0, 8);
}

async function loadCustomer(supabase: any, customerId: string) {
  const { data, error } = await supabase
    .from("customers")
    .select(
      `
      id,
      store_id,
      name,
      phone,
      phone_normalized,
      notes,
      tags,
      orders_count,
      total_spent_usd,
      average_ticket_usd,
      last_order_id,
      last_order_at,
      favorite_products,
      frequent_address,
      preferred_payment_method,
      preferred_fulfillment,
      created_at,
      updated_at,
      stores (
        name,
        slug
      )
    `
    )
    .eq("id", customerId)
    .single();

  if (error) throw error;
  return data;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = await requirePanelAuth(request);
    const { customerId } = await context.params;

    if (!customerId) return badRequest("Falta el cliente.");

    const supabase = createSupabaseAdminClient();
    const customer = await loadCustomer(supabase, customerId);

    assertStoreAccess(
      auth,
      customer.store_id,
      "No tienes permiso para ver este cliente."
    );

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(
        `
        id,
        public_code,
        status,
        payment_status,
        payment_method,
        delivery_type,
        delivery_reference,
        total_usd,
        total_bs,
        created_at,
        order_items (
          id,
          product_name,
          variant_name,
          quantity,
          unit_price_usd,
          total_usd,
          notes
        )
      `
      )
      .eq("store_id", customer.store_id)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (ordersError) throw ordersError;

    const lastOrder = (orders || [])[0] || null;
    const storeName = customer.stores?.name || "tu comercio";
    const repeatMessage = buildRepeatLastOrderMessage({
      customerName: customer.name,
      storeName,
      items: lastOrder?.order_items || [],
    });
    const contactMessage = buildContactAgainMessage({
      customerName: customer.name,
      storeName,
    });

    return NextResponse.json({
      customer: {
        ...customer,
        badges: getCustomerBadges(customer),
        repeat_message: repeatMessage,
        repeat_whatsapp_url: buildWhatsappUrl(customer.phone, repeatMessage),
        contact_message: contactMessage,
        contact_whatsapp_url: buildWhatsappUrl(customer.phone, contactMessage),
      },
      orders: orders || [],
    });
  } catch (error: any) {
    return panelErrorResponse(error, "Error cargando cliente.");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = await requirePanelAuth(request);
    const { customerId } = await context.params;
    const body = await request.json();

    if (!customerId) return badRequest("Falta el cliente.");

    const supabase = createSupabaseAdminClient();
    const customer = await loadCustomer(supabase, customerId);

    assertStoreAccess(
      auth,
      customer.store_id,
      "No tienes permiso para editar este cliente."
    );

    const { data, error } = await supabase
      .from("customers")
      .update({
        notes: cleanText(body.notes, 1200) || null,
        tags: normalizeTags(body.tags),
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ customer: data });
  } catch (error: any) {
    return panelErrorResponse(error, "Error actualizando cliente.");
  }
}
