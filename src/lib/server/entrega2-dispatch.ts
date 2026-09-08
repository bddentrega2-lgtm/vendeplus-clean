import "server-only";

type IntegrationUpdate = {
  external_id: string;
  status: string;
  last_payload: unknown;
  last_error: string | null;
  updated_at: string;
};

export async function completeEntrega2Dispatch(
  supabase: any,
  integrationId: string,
  update: IntegrationUpdate
) {
  const { data, error } = await supabase
    .from("order_integrations")
    .update(update)
    .eq("id", integrationId)
    .eq("status", "sending")
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("El envio cambio de estado antes de poder confirmarse.");
  }

  return data;
}

export async function markEntrega2DispatchForReconciliation(
  supabase: any,
  integrationId: string,
  params: {
    externalId: string;
    payload: unknown;
    errorMessage: string;
  }
) {
  const { error } = await supabase
    .from("order_integrations")
    .update({
      external_id: params.externalId,
      status: "reconcile_required",
      last_payload: params.payload,
      last_error: params.errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId)
    .eq("status", "sending");

  if (error) throw error;
}
