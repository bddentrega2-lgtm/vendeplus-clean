import "server-only";

type SupabaseAdminClient = ReturnType<
  typeof import("@/lib/supabase/admin").createSupabaseAdminClient
>;

function isMissingPrivateTokenStore(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return ["42883", "PGRST202"].includes(error.code || "") ||
    /table_order_token_(for_store|store_id)/i.test(error.message || "");
}

export async function getTableOrderTokenForStore(
  supabase: SupabaseAdminClient,
  storeId: string
) {
  const privateResult = await supabase.rpc("table_order_token_for_store", {
    p_store_id: storeId,
  });

  if (!privateResult.error) return String(privateResult.data || "");
  if (!isMissingPrivateTokenStore(privateResult.error)) throw privateResult.error;

  const legacyResult = await supabase
    .from("stores")
    .select("table_order_token")
    .eq("id", storeId)
    .maybeSingle();
  if (legacyResult.error) throw legacyResult.error;

  return String(legacyResult.data?.table_order_token || "");
}

export async function getStoreIdByTableOrderToken(
  supabase: SupabaseAdminClient,
  token: string
) {
  const privateResult = await supabase.rpc("table_order_store_id_for_token", {
    p_token: token,
  });

  if (!privateResult.error) return String(privateResult.data || "");
  if (!isMissingPrivateTokenStore(privateResult.error)) throw privateResult.error;

  const legacyResult = await supabase
    .from("stores")
    .select("id")
    .eq("table_order_token", token)
    .maybeSingle();
  if (legacyResult.error) throw legacyResult.error;

  return String(legacyResult.data?.id || "");
}

export async function isValidTableOrderTokenForStore(
  supabase: SupabaseAdminClient,
  storeId: string,
  token: string
) {
  if (!storeId || !token) return false;
  return (await getStoreIdByTableOrderToken(supabase, token)) === storeId;
}
