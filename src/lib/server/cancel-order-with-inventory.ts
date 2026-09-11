import "server-only";

type SupabaseAdminClient = ReturnType<
  typeof import("@/lib/supabase/admin").createSupabaseAdminClient
>;

function isMissingInventoryFunction(error: any) {
  return error?.code === "PGRST202" || error?.code === "42883";
}

export async function cancelOrderWithInventory({
  supabase,
  orderId,
  storeId,
}: {
  supabase: SupabaseAdminClient;
  orderId: string;
  storeId: string;
}) {
  const { data, error } = await supabase.rpc("cancel_order_with_inventory", {
    p_order_id: orderId,
    p_store_id: storeId,
  });

  if (!error) return data;
  if (!isMissingInventoryFunction(error)) throw error;

  const fallback = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .eq("store_id", storeId)
    .select()
    .single();
  if (fallback.error) throw fallback.error;
  return fallback.data;
}
