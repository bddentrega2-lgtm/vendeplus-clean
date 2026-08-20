import "server-only";

type SupabaseAdminClient = ReturnType<
  typeof import("@/lib/supabase/admin").createSupabaseAdminClient
>;

type AtomicOrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price_usd: number;
  total_usd: number;
  notes: string | null;
  options: Array<{
    option_group_name: string;
    option_name: string;
    price_delta_usd: number;
    quantity: number;
  }>;
};

export async function createOrderAtomic({
  supabase,
  order,
  items,
}: {
  supabase: SupabaseAdminClient;
  order: Record<string, unknown>;
  items: AtomicOrderItem[];
}) {
  const { data, error } = await supabase.rpc("create_order_atomic", {
    p_order: order,
    p_items: items,
  });

  if (error) throw error;

  const result = data && typeof data === "object" ? data as Record<string, any> : {};
  if (!result.order?.id) {
    throw new Error("La transacción no devolvió el pedido creado.");
  }

  return {
    order: result.order as Record<string, any>,
    idempotentReplay: result.idempotent_replay === true,
  };
}
