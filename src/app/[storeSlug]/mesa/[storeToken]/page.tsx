import { notFound } from "next/navigation";
import { TableEntryClient } from "@/components/public/TableEntryClient";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicStoreBySlug } from "@/lib/supabase/catalog";
import {
  isPrepaidTablePaymentMethod,
} from "@/lib/table-orders";
import { methodsForChannel } from "@/lib/payment-availability";
import { getStoreIdByTableOrderToken } from "@/lib/server/table-order-tokens";

export const dynamic = "force-dynamic";

export default async function TableOrderPage({
  params,
}: {
  params: Promise<{ storeSlug: string; storeToken: string }>;
}) {
  const { storeSlug, storeToken } = await params;

  const supabase = createSupabaseAdminClient();
  const tableStoreId = await getStoreIdByTableOrderToken(supabase, storeToken);
  if (!tableStoreId) notFound();

  const [{ data: tableStore }, store] = await Promise.all([
    supabase
      .from("stores")
      .select("id, table_orders_access_enabled, table_orders_enabled, table_order_fulfillment_mode, payment_methods, payment_details, table_payment_methods, table_waiter_calls_enabled, table_waiter_call_label")
      .eq("id", tableStoreId)
      .eq("slug", storeSlug)
      .eq("is_active", true)
      .maybeSingle(),
    getPublicStoreBySlug(storeSlug),
  ]);

  if (!tableStore || !store) notFound();

  const { data: tables, error } = await supabase
    .from("store_tables")
    .select("id, name, zone")
    .eq("store_id", tableStore.id)
    .eq("is_enabled", true)
    .order("zone", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) throw error;

  const paymentMethods = methodsForChannel(tableStore.payment_methods, tableStore.payment_details,
    tableStore.table_order_fulfillment_mode === "counter_pickup" ? "bar" : "table", tableStore.table_payment_methods)
    .filter(isPrepaidTablePaymentMethod);

  return (
    <TableEntryClient
      store={store}
      storeToken={storeToken}
      tables={tables || []}
      enabled={tableStore.table_orders_access_enabled === true && tableStore.table_orders_enabled === true}
      paymentMethods={paymentMethods}
      waiterCallsEnabled={tableStore.table_waiter_calls_enabled === true}
      waiterCallLabel={tableStore.table_waiter_call_label}
      fulfillmentMode={tableStore.table_order_fulfillment_mode === "counter_pickup" ? "counter_pickup" : "table_service"}
    />
  );
}
