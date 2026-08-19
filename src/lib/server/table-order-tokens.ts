import "server-only";

type SupabaseAdminClient = ReturnType<
  typeof import("@/lib/supabase/admin").createSupabaseAdminClient
>;

export async function getTableOrderTokenForStore(
  supabase: SupabaseAdminClient,
  storeId: string
) {
  const privateResult = await supabase.rpc("table_order_token_for_store", {
    p_store_id: storeId,
  });

  if (privateResult.error) throw privateResult.error;
  return String(privateResult.data || "");
}

export async function getStoreIdByTableOrderToken(
  supabase: SupabaseAdminClient,
  token: string
) {
  const privateResult = await supabase.rpc("table_order_store_id_for_token", {
    p_token: token,
  });

  if (privateResult.error) throw privateResult.error;
  return String(privateResult.data || "");
}

export async function isValidTableOrderTokenForStore(
  supabase: SupabaseAdminClient,
  storeId: string,
  token: string
) {
  if (!storeId || !token) return false;
  return (await getStoreIdByTableOrderToken(supabase, token)) === storeId;
}
