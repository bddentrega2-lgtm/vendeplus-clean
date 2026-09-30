import "server-only";

import { createHash, randomBytes } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const hashPrintAgentSecret = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

export function createPairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  const raw = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

export function createDeviceToken() {
  return `sdp_${randomBytes(32).toString("base64url")}`;
}

export function normalizePairingCode(value: unknown) {
  const raw = String(value || "").toUpperCase().replace(/[^A-Z2-9]/g, "");
  return raw.length === 12 ? `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}` : "";
}

export async function requirePrintAgent(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!/^sdp_[A-Za-z0-9_-]{40,}$/.test(token)) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("print_agent_devices")
    .select("id, store_id, name, platform, revoked_at, last_seen_at")
    .eq("token_hash", hashPrintAgentSecret(token))
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;
  if (!data.last_seen_at || Date.now() - new Date(data.last_seen_at).getTime() > 60_000) {
    await supabase
      .from("print_agent_devices")
      .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", data.id);
  }
  return data;
}
