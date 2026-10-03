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
  cancellationReason,
}: {
  supabase: SupabaseAdminClient;
  orderId: string;
  storeId: string;
  cancellationReason?: string | null;
}) {
  if (cancellationReason) {
    const withReason = await supabase.rpc("cancel_order_with_reason", {
      p_order_id: orderId,
      p_store_id: storeId,
      p_reason: cancellationReason,
    });
    if (!withReason.error) return withReason.data;
    if (!isMissingInventoryFunction(withReason.error)) throw withReason.error;
  }

  const { data, error } = await supabase.rpc("cancel_order_with_inventory", {
    p_order_id: orderId,
    p_store_id: storeId,
  });

  if (!error) {
    if (!cancellationReason) return data;
    const savedReason = await supabase
      .from("orders")
      .update({ table_cancellation_reason: cancellationReason, table_cancelled_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("store_id", storeId)
      .select()
      .single();
    if (savedReason.error) throw savedReason.error;
    return savedReason.data;
  }
  if (!isMissingInventoryFunction(error)) throw error;

  const fallback = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      ...(cancellationReason ? {
        table_cancellation_reason: cancellationReason,
        table_cancelled_at: new Date().toISOString(),
      } : {}),
    })
    .eq("id", orderId)
    .eq("store_id", storeId)
    .select()
    .single();
  if (fallback.error) throw fallback.error;
  return fallback.data;
}
