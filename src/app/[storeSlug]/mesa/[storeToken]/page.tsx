import { notFound } from "next/navigation";
import { TableEntryClient } from "@/components/public/TableEntryClient";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicStoreBySlug } from "@/lib/supabase/catalog";
import {
  isPrepaidTablePaymentMethod,
} from "@/lib/table-orders";
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
      .select("id, table_orders_access_enabled, table_orders_enabled, table_order_fulfillment_mode, payment_methods, table_payment_methods")
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

  const storeMethods = Array.isArray(tableStore.payment_methods)
    ? tableStore.payment_methods
    : [];
  const selectedMethods = Array.isArray(tableStore.table_payment_methods)
    ? tableStore.table_payment_methods
    : [];
  const paymentMethods = selectedMethods.filter(
    (method: string) => storeMethods.includes(method) && isPrepaidTablePaymentMethod(method)
  );

  return (
    <TableEntryClient
      store={store}
      storeToken={storeToken}
      tables={tables || []}
      enabled={tableStore.table_orders_access_enabled === true && tableStore.table_orders_enabled === true}
      paymentMethods={paymentMethods}
      fulfillmentMode={tableStore.table_order_fulfillment_mode === "counter_pickup" ? "counter_pickup" : "table_service"}
    />
  );
}
