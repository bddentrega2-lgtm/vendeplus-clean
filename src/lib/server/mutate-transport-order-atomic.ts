type SupabaseRpcClient = {
  rpc: (name: string, params: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

export async function mutateTransportOrderAtomic(
  supabase: SupabaseRpcClient,
  params: {
    transportOrderId: string;
    transportPayload: Record<string, unknown>;
    eventPayload: Record<string, unknown>;
    orderDeliveryStatus?: string | null;
    integrationStatus?: string | null;
  }
) {
  const { data, error } = await supabase.rpc("mutate_transport_order_atomic", {
    p_transport_order_id: params.transportOrderId,
    p_transport_payload: params.transportPayload,
    p_event_payload: params.eventPayload,
    p_order_delivery_status: params.orderDeliveryStatus || null,
    p_integration_status: params.integrationStatus || null,
  });

  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("La operación delivery no devolvió el servicio actualizado.");
  }
  return data as Record<string, unknown>;
}
