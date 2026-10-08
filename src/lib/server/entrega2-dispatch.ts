import "server-only";
import { canAdvanceEntrega2OrderStatus, normalizeEntrega2OrderStatus } from "@/lib/integrations/entrega2";

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
    const { data: current, error: currentError } = await supabase
      .from("order_integrations")
      .select()
      .eq("id", integrationId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (current && normalizeEntrega2OrderStatus(current.status)) return current;
    throw new Error("El envio cambio de estado antes de poder confirmarse.");
  }

  return data;
}

export async function advanceEntrega2OrderDeliveryStatus(
  supabase: any,
  orderId: string,
  nextStatus: string
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: current, error: readError } = await supabase
      .from("orders")
      .select("delivery_status")
      .eq("id", orderId)
      .maybeSingle();
    if (readError) throw readError;
    if (!current || normalizeEntrega2OrderStatus(current.delivery_status) === nextStatus) return;
    if (!canAdvanceEntrega2OrderStatus(current.delivery_status, nextStatus)) return;

    let update = supabase.from("orders").update({ delivery_status: nextStatus }).eq("id", orderId);
    update = current.delivery_status === null
      ? update.is("delivery_status", null)
      : update.eq("delivery_status", current.delivery_status);
    const { data: updated, error: updateError } = await update.select("id").maybeSingle();
    if (updateError) throw updateError;
    if (updated) return;
  }
  throw new Error("No se pudo conciliar el estado de Entrega2 tras cambios simultaneos.");
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
