import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/customers/normalize-phone";

type OrderForCustomer = {
  id: string;
  store_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_type?: string | null;
  payment_method?: string | null;
  delivery_reference?: string | null;
  total_usd?: number | string | null;
  created_at?: string | null;
};

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mostFrequent(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();

  values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function summarizeFavoriteProducts(orders: any[]) {
  const products = new Map<string, { name: string; quantity: number; orders: number }>();

  for (const order of orders) {
    for (const item of order.order_items || []) {
      const name = item.variant_name
        ? `${item.product_name} (${item.variant_name})`
        : item.product_name;
      const current = products.get(name) || { name, quantity: 0, orders: 0 };

      current.quantity += toNumber(item.quantity);
      current.orders += 1;
      products.set(name, current);
    }
  }

  return Array.from(products.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
}

async function recalculateCustomer(
  supabase: SupabaseClient<any, any, any>,
  customerId: string,
  storeId: string,
  phoneNormalized: string,
  fallbackOrder: OrderForCustomer
) {
  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      customer_name,
      customer_phone,
      delivery_type,
      payment_method,
      delivery_reference,
      total_usd,
      created_at,
      order_items (
        product_name,
        variant_name,
        quantity
      )
    `
    )
    .eq("store_id", storeId)
    .eq("customer_phone_normalized", phoneNormalized)
    .order("created_at", { ascending: false });

  let customerOrders: any[] = orders || [];

  if (error) {
    const fallbackResult = await supabase
      .from("orders")
      .select(
        `
        id,
        customer_name,
        customer_phone,
        delivery_type,
        payment_method,
        delivery_reference,
        total_usd,
        created_at,
        order_items (
          product_name,
          variant_name,
          quantity
        )
      `
      )
      .eq("store_id", storeId)
      .eq("customer_phone", fallbackOrder.customer_phone)
      .order("created_at", { ascending: false });

    customerOrders = fallbackResult.data || [];
  }

  if (!customerOrders.length) {
    customerOrders = [fallbackOrder];
  }

  const ordersCount = customerOrders.length;
  const totalSpentUsd = customerOrders.reduce(
    (sum: number, order: any) => sum + toNumber(order.total_usd),
    0
  );
  const lastOrder = customerOrders[0] || fallbackOrder;

  const { error: updateError } = await supabase
    .from("customers")
    .update({
      name: lastOrder.customer_name || fallbackOrder.customer_name || "Cliente",
      phone: lastOrder.customer_phone || fallbackOrder.customer_phone,
      orders_count: ordersCount,
      total_spent_usd: totalSpentUsd,
      average_ticket_usd: ordersCount ? totalSpentUsd / ordersCount : 0,
      last_order_id: lastOrder.id || fallbackOrder.id,
      last_order_at: lastOrder.created_at || fallbackOrder.created_at || new Date().toISOString(),
      favorite_products: summarizeFavoriteProducts(customerOrders),
      frequent_address: mostFrequent(customerOrders.map((order: any) => order.delivery_reference)),
      preferred_payment_method: mostFrequent(
        customerOrders.map((order: any) => order.payment_method)
      ),
      preferred_fulfillment: mostFrequent(customerOrders.map((order: any) => order.delivery_type)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);

  if (updateError) throw updateError;
}

export async function upsertCustomerFromOrder(
  supabase: SupabaseClient<any, any, any>,
  order: OrderForCustomer
) {
  const phoneNormalized = normalizePhone(order.customer_phone);

  if (!order.store_id || !phoneNormalized) return null;

  const basePayload = {
    store_id: order.store_id,
    name: order.customer_name || "Cliente",
    phone: order.customer_phone,
    phone_normalized: phoneNormalized,
    last_order_id: order.id,
    last_order_at: order.created_at || new Date().toISOString(),
    preferred_payment_method: order.payment_method || null,
    preferred_fulfillment: order.delivery_type || null,
    frequent_address: order.delivery_reference || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existingCustomer, error: existingError } = await supabase
    .from("customers")
    .select("id")
    .eq("store_id", order.store_id)
    .eq("phone_normalized", phoneNormalized)
    .maybeSingle();

  if (existingError) throw existingError;

  let customerId = existingCustomer?.id as string | undefined;

  if (!customerId) {
    const { data: createdCustomer, error: createError } = await supabase
      .from("customers")
      .insert(basePayload)
      .select("id")
      .single();

    if (createError) throw createError;
    customerId = createdCustomer.id;
  } else {
    const { error: updateError } = await supabase
      .from("customers")
      .update(basePayload)
      .eq("id", customerId);

    if (updateError) throw updateError;
  }

  if (!customerId) return null;

  await supabase
    .from("orders")
    .update({
      customer_id: customerId,
      customer_phone_normalized: phoneNormalized,
    })
    .eq("id", order.id);
  await recalculateCustomer(supabase, customerId, order.store_id, phoneNormalized, order);

  return customerId;
}

export async function safeUpsertCustomerFromOrder(
  supabase: SupabaseClient<any, any, any>,
  order: OrderForCustomer
) {
  try {
    return await upsertCustomerFromOrder(supabase, order);
  } catch (error) {
    console.warn("No se pudo actualizar el cliente del pedido:", error);
    return null;
  }
}
