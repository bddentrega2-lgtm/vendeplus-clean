import type { SavedOrder, Store } from "@/types";
import { getInitialPaymentStatus, getSuggestedPaymentCurrency } from "@/lib/payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";

function createUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function isUuid(value?: string) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}

export async function saveOrderToSupabase(order: SavedOrder, store: Store) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return {
      ok: false,
      error: "El servicio de pedidos no está disponible en este momento.",
    };
  }

  const orderDbId = createUuid();
  const paymentReference = String(order.form.paymentReference || "").trim();
  const initialPaymentStatus = getInitialPaymentStatus(order.form.paymentMethod);

  const orderPayload = {
    id: orderDbId,
    public_code: order.id,
    store_id: store.id,

    customer_name: order.form.customerName,
    customer_phone: order.form.customerPhone,

    delivery_type: order.form.deliveryType,
    payment_method: order.form.paymentMethod,
    payment_status:
      paymentReference && initialPaymentStatus !== "cash_on_delivery"
        ? "review"
        : initialPaymentStatus,
    payment_reference: paymentReference || null,
    payment_currency: getSuggestedPaymentCurrency(order.form.paymentMethod) || null,

    subtotal_usd: order.totals.subtotalUsd,
    delivery_usd: order.totals.deliveryUsd,
    total_usd: order.totals.totalUsd,
    total_bs: order.totals.totalBs,

    distance_km:
      order.form.deliveryType === "delivery" && order.quote.distanceKm !== null
        ? order.quote.distanceKm
        : null,

    delivery_lat:
      order.form.deliveryType === "delivery" && order.location
        ? order.location.latitude
        : null,

    delivery_lng:
      order.form.deliveryType === "delivery" && order.location
        ? order.location.longitude
        : null,

    delivery_reference: order.form.deliveryReference || null,
    order_details: order.form.orderDetails || null,
    notes: order.form.notes || null,

    status: "received",
    whatsapp_message: order.whatsappMessage,
  };

  let { error: orderError } = await supabase.from("orders").insert(orderPayload);

  if (orderError && isMissingColumnError(orderError, ["payment_"])) {
    const {
      payment_status: _paymentStatus,
      payment_reference: _paymentReference,
      payment_currency: _paymentCurrency,
      ...baseOrderPayload
    } = orderPayload;

    const fallbackResult = await supabase.from("orders").insert(baseOrderPayload);
    orderError = fallbackResult.error;
  }

  if (orderError) {
    return {
      ok: false,
      error: orderError.message,
    };
  }

  const itemsPayload = order.items.map((item) => ({
    order_id: orderDbId,
    product_id: isUuid(item.productId) ? item.productId : null,
    product_name: item.productName,
    variant_name: item.variantName || null,
    quantity: item.quantity,
    unit_price_usd: item.unitPriceUsd,
    total_usd: item.unitPriceUsd * item.quantity,
    notes: item.notes || null,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemsPayload);

  if (itemsError) {
    return {
      ok: false,
      error: itemsError.message,
    };
  }

  return {
    ok: true,
    orderId: orderDbId,
  };
}
