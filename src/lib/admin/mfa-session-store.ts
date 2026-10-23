import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminMfaCookiePayload } from "@/lib/admin/mfa-session-cookie";

function hashSecret(secret: string) { return createHash("sha256").update(secret).digest("hex"); }

export async function createAdminMfaSession(supabase: SupabaseClient, input: { userId: string; email: string; expiresAt: Date; userAgent?: string | null; ip?: string | null }) {
  const secret = randomBytes(32).toString("base64url");
  const { data, error } = await supabase.rpc("create_panel_session_v2", {
    p_user_id: input.userId, p_email: input.email, p_secret_hash: hashSecret(secret),
    p_expires_at: input.expiresAt.toISOString(), p_founder: true, p_aal: "aal2",
    p_user_agent: input.userAgent || null, p_ip: input.ip || null,
  });
  if (error || !data) throw error || new Error("No se pudo validar el autenticador.");
  return { sid: String(data), secret };
}

export async function getActiveAdminMfaSession(supabase: SupabaseClient, session: AdminMfaCookiePayload | null) {
  if (!session) return null;
  const { data, error } = await supabase.rpc("get_panel_session_v2", { p_session_id: session.sid, p_secret_hash: hashSecret(session.secret) });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.user_id || !row?.email || row.aal !== "aal2" || !row.founder) return null;
  const expiresAt = new Date(row.expires_at);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) return null;
  return { userId: String(row.user_id), email: String(row.email).toLowerCase(), expiresAt };
}

export async function revokeAdminMfaSession(supabase: SupabaseClient, session: AdminMfaCookiePayload | null) {
  if (!session) return;
  await supabase.rpc("revoke_panel_session", { p_session_id: session.sid, p_secret_hash: hashSecret(session.secret) });
}
