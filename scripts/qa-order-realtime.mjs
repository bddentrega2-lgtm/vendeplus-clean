import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

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
const userClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sender = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `qa-order-realtime-${randomUUID()}@invalid.local`;
const password = `Qa!${randomUUID()}aA1`;
let userId = null;
let receiverChannel = null;
let senderChannel = null;

function waitForSubscription(channel, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Realtime no completo la suscripcion.")), timeoutMs);
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        resolve(status);
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        clearTimeout(timeout);
        reject(error || new Error(`Realtime termino con ${status}.`));
      }
    });
  });
}

try {
  const { data: latestOrders, error: latestOrderError } = await admin
    .from("orders")
    .select("store_id")
    .order("created_at", { ascending: false })
    .limit(1);
  if (latestOrderError) throw latestOrderError;
  const storeId = latestOrders?.[0]?.store_id;
  assert.ok(storeId, "No hay comercio para validar Realtime.");

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

  const { data: signedIn, error: signInError } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signedIn.session) throw signInError || new Error("No se creo la sesion QA.");

  await userClient.realtime.setAuth(signedIn.session.access_token);
  await sender.realtime.setAuth(serviceRoleKey);
  const topic = `store:${storeId}:orders`;
  let received = null;
  receiverChannel = userClient
    .channel(topic, { config: { private: true } })
    .on("broadcast", { event: "order_changed" }, (message) => {
      received = message;
    });
  senderChannel = sender.channel(topic, { config: { private: true } });

  const startedAt = performance.now();
  await Promise.all([
    waitForSubscription(receiverChannel),
    waitForSubscription(senderChannel),
  ]);
  const sendStatus = await senderChannel.send({
    type: "broadcast",
    event: "order_changed",
    payload: { order_id: randomUUID(), store_id: storeId, operation: "QA" },
  });
  assert.equal(sendStatus, "ok");

  const deadline = Date.now() + 10_000;
  while (!received && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(received, "El usuario autorizado no recibio el broadcast privado.");

  console.log(JSON.stringify({
    ok: true,
    topic: "store:{storeId}:orders",
    latencyMs: Math.round(performance.now() - startedAt),
  }));
} finally {
  if (receiverChannel) await userClient.removeChannel(receiverChannel);
  if (senderChannel) await sender.removeChannel(senderChannel);
  userClient.realtime.disconnect();
  sender.realtime.disconnect();
  await userClient.auth.signOut();
  if (userId) {
    await admin.from("store_users").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
}
