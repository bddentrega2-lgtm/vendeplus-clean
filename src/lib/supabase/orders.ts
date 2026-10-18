import type { SavedOrder, Store } from "@/types";
import type { CartReview } from "@/lib/cart-review";
import { buyerAuthHeaders } from "@/lib/buyer/client";

export async function saveOrderToSupabase(
  order: SavedOrder,
  store: Store,
  idempotencyKey: string
) {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...await buyerAuthHeaders() },
    body: JSON.stringify({ order, storeId: store.id, idempotencyKey }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      error: data.error || "No se pudo guardar el pedido.",
      cartReview: data.code === "CART_CHANGED" ? data.cartReview as CartReview : undefined,
    };
  }

  return {
    ok: true,
    orderId: data.orderId as string,
    order: data.order as SavedOrder,
  };
}
