import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:3103";
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
const email = `qa-transport-${randomUUID()}@invalid.local`;
const password = `Qa!${randomUUID()}aA1`;
let userId = null;

async function measure(label, query, token) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/transport/me?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.text();
  assert.equal(response.status, 200, body);
  assert.match(
    response.headers.get("content-type") || "",
    /application\/json/i,
    `La respuesta de ${label} no es JSON; puede existir proteccion SSO delante de la Preview.`,
  );
  const payload = JSON.parse(body);
  assert.ok(Array.isArray(payload.agencies), `Respuesta invalida para ${label}.`);
  return {
    label,
    bytes: Buffer.byteLength(body),
    latencyMs: Math.round(performance.now() - startedAt),
    endpointMs: Number(response.headers.get("x-endpoint-duration-ms") || 0),
  };
}

try {
  const { data: recentOrders, error: agencyError } = await admin
    .from("transport_orders")
    .select("agency_id")
    .order("created_at", { ascending: false })
    .limit(1);
  if (agencyError) throw agencyError;
  const agencyId = recentOrders?.[0]?.agency_id;
  assert.ok(agencyId, "No hay empresa delivery con servicios para QA.");

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  userId = created.user.id;

  const { error: membershipError } = await admin.from("transport_agency_users").insert({
    agency_id: agencyId,
    email,
    role: "owner",
    user_id: userId,
  });
  if (membershipError) throw membershipError;

  const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signedIn.session) throw signInError || new Error("Sin sesion QA.");
  const token = signedIn.session.access_token;

  const results = [];
  results.push(await measure(
    "pedidos-anterior",
    "includeBilling=false&includeRelations=false&includeConfiguration=true",
    token,
  ));
  results.push(await measure(
    "pedidos-optimizado",
    "includeBilling=false&includeRelations=false&includeConfiguration=false",
    token,
  ));
  results.push(await measure(
    "resumen-anterior",
    "includeBilling=true&billingDetail=true&includeRelations=true&includeConfiguration=true",
    token,
  ));
  results.push(await measure(
    "resumen-optimizado",
    "includeBilling=true&billingDetail=false&includeRelations=true&includeConfiguration=true",
    token,
  ));

  console.log(JSON.stringify({ ok: true, agencyId, results }, null, 2));
  await anon.auth.signOut();
} finally {
  if (userId) {
    await admin.from("transport_agency_users").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    const { count, error } = await admin
      .from("transport_agency_users")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw error;
    assert.equal(count, 0, "La membresia QA no fue eliminada.");
  }
}
