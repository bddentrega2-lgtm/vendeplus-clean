import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:3102";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
})) {
  if (!value) throw new Error(`Falta ${name}.`);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `qa-panel-stats-${randomUUID()}@invalid.local`;
const password = `Qa!${randomUUID()}aA1`;
let userId = null;

try {
  const { data: latestOrders, error: latestOrderError } = await admin
    .from("orders")
    .select("store_id")
    .order("created_at", { ascending: false })
    .limit(1);
  if (latestOrderError) throw latestOrderError;

  const storeId = latestOrders?.[0]?.store_id;
  assert.ok(storeId, "No hay un comercio con pedidos para ejecutar QA.");

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  userId = created.user.id;

  const { error: membershipError } = await admin.from("store_users").insert({
    store_id: storeId,
    user_id: userId,
    role: "owner",
  });
  if (membershipError) throw membershipError;

  const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signedIn.session) {
    throw signInError || new Error("No se creo la sesion QA.");
  }

  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/panel/stats?mode=full&range=last_7_days`, {
    headers: {
      Authorization: `Bearer ${signedIn.session.access_token}`,
      "X-Panel-Store-Id": storeId,
    },
  });
  const payload = await response.json();
  assert.equal(response.status, 200, payload?.error || `HTTP ${response.status}`);
  assert.equal(payload.selectedStoreId, storeId);
  assert.equal(payload.range?.capped, false);
  assert.equal(payload.summary?.aggregationVersion, 2);
  assert.ok(Array.isArray(payload.recentOrders));
  assert.ok(payload.recentOrders.length <= 8);

  const { data: rpcRows, error: rpcError } = await admin.rpc("panel_store_stats", {
    p_store_ids: [storeId],
    p_store_id: storeId,
    p_start: payload.range.start,
    p_end: payload.range.end,
    p_recent_limit: 8,
  });
  if (rpcError) throw rpcError;
  const rpc = rpcRows?.[0];
  assert.equal(payload.summary.totalOrders, rpc?.summary?.totalOrders);
  assert.equal(payload.summary.totalRevenueUsd, rpc?.summary?.totalRevenueUsd);

  console.log(JSON.stringify({
    ok: true,
    status: response.status,
    latencyMs: Math.round(performance.now() - startedAt),
    aggregationVersion: payload.summary.aggregationVersion,
    capped: payload.range.capped,
    recentOrders: payload.recentOrders.length,
  }));

  await anon.auth.signOut();
} finally {
  if (userId) {
    await admin.from("store_users").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);

    const { count, error } = await admin
      .from("store_users")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw error;
    assert.equal(count, 0, "La membresia QA no fue eliminada.");
  }
}
