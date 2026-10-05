import "server-only";
import { GoogleAuth } from "google-auth-library";

type SupabaseAdminClient = ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>;
type PushDevice = { id: string; fcm_token: string | null };
type ServiceAccount = { type: string; project_id: string; client_email: string; private_key: string };
type PrintWakeEvent = "received" | "paid" | "manual";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const INVALID_TOKEN_CODES = new Set(["UNREGISTERED", "INVALID_ARGUMENT", "SENDER_ID_MISMATCH"]);
let cachedCredentials: { raw: string; account: ServiceAccount; auth: GoogleAuth } | null = null;

function readCredentials() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) return null;
  if (cachedCredentials?.raw === raw) return cachedCredentials;
  const account = JSON.parse(raw) as ServiceAccount;
  if (account.type !== "service_account" || !account.project_id || !account.client_email || !account.private_key?.includes("BEGIN PRIVATE KEY")) {
    throw new Error("Firebase service account configuration is invalid.");
  }
  cachedCredentials = { raw, account, auth: new GoogleAuth({ credentials: account, scopes: [FCM_SCOPE] }) };
  return cachedCredentials;
}

function firebaseErrorCode(payload: unknown) {
  const details = (payload as { error?: { details?: Array<{ errorCode?: string }> } })?.error?.details;
  return String(details?.find(detail => detail?.errorCode)?.errorCode || "");
}

export async function sendPrintWakePush({
  supabase,
  storeId,
  orderId,
  eventType = "received",
  fetchImpl = fetch,
  credentials = readCredentials(),
}: {
  supabase: SupabaseAdminClient;
  storeId: string;
  orderId: string;
  eventType?: PrintWakeEvent;
  fetchImpl?: typeof fetch;
  credentials?: ReturnType<typeof readCredentials>;
}) {
  if (!credentials) return { configured: false, attempted: 0, sent: 0, invalidated: 0 };

  const { data: settings, error: settingsError } = await supabase
    .from("store_print_settings")
    .select("is_enabled, trigger_mode")
    .eq("store_id", storeId)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (eventType !== "manual") {
    if (!settings?.is_enabled) return { configured: true, attempted: 0, sent: 0, invalidated: 0 };
    const triggerMode = ["received", "paid", "both"].includes(settings.trigger_mode)
      ? settings.trigger_mode
      : "received";
    if (triggerMode !== "both" && triggerMode !== eventType) {
      return { configured: true, attempted: 0, sent: 0, invalidated: 0 };
    }
  }

  const { data, error } = await supabase
    .from("print_agent_devices")
    .select("id, fcm_token")
    .eq("store_id", storeId)
    .eq("platform", "android")
    .is("revoked_at", null)
    .not("fcm_token", "is", null)
    .limit(20);
  if (error) throw error;

  const devices = (data || []).filter((device: PushDevice) => Boolean(device.fcm_token));
  if (!devices.length) return { configured: true, attempted: 0, sent: 0, invalidated: 0 };
  const accessToken = await credentials.auth.getAccessToken();
  if (!accessToken) throw new Error("Firebase access token was unavailable.");

  let sent = 0;
  const invalidIds: string[] = [];
  for (const device of devices) {
    const response = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(credentials.account.project_id)}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { token: device.fcm_token, data: { type: "print_jobs", orderId, storeId }, android: { priority: "high" } } }),
    });
    if (response.ok) { sent += 1; continue; }
    const payload = await response.json().catch(() => ({}));
    if (INVALID_TOKEN_CODES.has(firebaseErrorCode(payload))) invalidIds.push(device.id);
  }

  if (invalidIds.length) {
    const { error: clearError } = await supabase
      .from("print_agent_devices")
      .update({ fcm_token: null, fcm_token_updated_at: null, updated_at: new Date().toISOString() })
      .eq("store_id", storeId)
      .in("id", invalidIds);
    if (clearError) throw clearError;
  }
  return { configured: true, attempted: devices.length, sent, invalidated: invalidIds.length };
}

export async function safeSendPrintWakePush(input: { supabase: SupabaseAdminClient; storeId: string; orderId: string; eventType?: PrintWakeEvent }) {
  try { return await sendPrintWakePush(input); }
  catch { return { configured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON), attempted: 0, sent: 0, invalidated: 0 }; }
}

export async function sendTableAssistancePush({
  supabase, storeId, tableId, requestedAt, tableName, fetchImpl = fetch, credentials = readCredentials(),
}: {
  supabase: SupabaseAdminClient;
  storeId: string;
  tableId: string;
  requestedAt: string;
  tableName: string;
  fetchImpl?: typeof fetch;
  credentials?: ReturnType<typeof readCredentials>;
}) {
  if (!credentials) return { configured: false, attempted: 0, sent: 0 };
  const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60_000).toISOString();
  const { data: devices, error: deviceError } = await supabase.from("panel_push_devices")
    .select("fcm_token,user_id").eq("store_id", storeId).gte("updated_at", cutoff).limit(100);
  if (deviceError) throw deviceError;
  if (!devices?.length) return { configured: true, attempted: 0, sent: 0 };

  const userIds = [...new Set(devices.map((device) => device.user_id))];
  const { data: members, error: memberError } = await supabase.from("store_users")
    .select("user_id").eq("store_id", storeId).in("user_id", userIds);
  if (memberError) throw memberError;
  const authorized = new Set((members || []).map((member) => member.user_id));
  const targets = devices.filter((device) => authorized.has(device.user_id));
  if (!targets.length) return { configured: true, attempted: 0, sent: 0 };
  const accessToken = await credentials.auth.getAccessToken();
  if (!accessToken) throw new Error("Firebase access token was unavailable.");

  const results = await Promise.all(targets.map(async (device) => {
    try {
      const response = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(credentials.account.project_id)}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: {
          token: device.fcm_token,
          data: { type: "table_assistance", storeId, tableId, requestedAt, tableName: tableName.slice(0, 60) },
          android: { priority: "high" },
        } }),
        signal: AbortSignal.timeout(8_000),
      });
      if (response.ok) return { sent: true, invalid: false, token: device.fcm_token };
      const payload = await response.json().catch(() => ({}));
      return { sent: false, invalid: INVALID_TOKEN_CODES.has(firebaseErrorCode(payload)), token: device.fcm_token };
    } catch { return { sent: false, invalid: false, token: device.fcm_token }; }
  }));
  const invalidTokens = results.filter((result) => result.invalid).map((result) => result.token);
  if (invalidTokens.length) {
    const { error } = await supabase.from("panel_push_devices").delete()
      .eq("store_id", storeId).in("fcm_token", invalidTokens);
    if (error) throw error;
  }
  return { configured: true, attempted: targets.length, sent: results.filter((result) => result.sent).length };
}

export async function safeSendTableAssistancePush(input: {
  supabase: SupabaseAdminClient; storeId: string; tableId: string; requestedAt: string; tableName: string;
}) {
  try { return await sendTableAssistancePush(input); }
  catch { return { configured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON), attempted: 0, sent: 0 }; }
}
