import type { SavedOrder, Store } from "@/types";

export async function saveOrderToSupabase(order: SavedOrder, store: Store) {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order, storeId: store.id }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      error: data.error || "No se pudo guardar el pedido.",
    };
  }

  return {
    ok: true,
    orderId: data.orderId as string,
    order: data.order as SavedOrder,
  };
}
