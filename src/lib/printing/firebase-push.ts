import "server-only";
import { GoogleAuth } from "google-auth-library";

type SupabaseAdminClient = ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>;
type PushDevice = { id: string; fcm_token: string | null };
type ServiceAccount = { type: string; project_id: string; client_email: string; private_key: string };

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
  fetchImpl = fetch,
  credentials = readCredentials(),
}: {
  supabase: SupabaseAdminClient;
  storeId: string;
  orderId: string;
  fetchImpl?: typeof fetch;
  credentials?: ReturnType<typeof readCredentials>;
}) {
  if (!credentials) return { configured: false, attempted: 0, sent: 0, invalidated: 0 };

  const { data: settings, error: settingsError } = await supabase
    .from("store_print_settings")
    .select("is_enabled")
    .eq("store_id", storeId)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (!settings?.is_enabled) return { configured: true, attempted: 0, sent: 0, invalidated: 0 };

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
      body: JSON.stringify({ message: { token: device.fcm_token, data: { type: "print_jobs", orderId }, android: { priority: "high" } } }),
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

export async function safeSendPrintWakePush(input: { supabase: SupabaseAdminClient; storeId: string; orderId: string }) {
  try { return await sendPrintWakePush(input); }
  catch { return { configured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON), attempted: 0, sent: 0, invalidated: 0 }; }
}
