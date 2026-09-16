import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PanelSessionCookiePayload } from "@/lib/server/panel-session-cookie";

type CreatePanelSessionOptions = {
  userId: string;
  email: string;
  founder: boolean;
  aal?: string | null;
  expiresAt: Date;
  userAgent?: string | null;
  ip?: string | null;
};

export type ActivePanelServerSession = {
  userId: string;
  email: string;
  founder: boolean;
  aal: "aal1" | "aal2";
  expiresAt: Date;
};

function hashPanelSessionSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function normalizeAal(value?: string | null): "aal1" | "aal2" {
  return value === "aal2" ? "aal2" : "aal1";
}

export async function createPanelServerSession(
  supabase: SupabaseClient,
  options: CreatePanelSessionOptions
): Promise<Pick<PanelSessionCookiePayload, "sid" | "secret">> {
  const secret = randomBytes(32).toString("base64url");
  const { data, error } = await supabase.rpc("create_panel_session", {
    p_user_id: options.userId,
    p_email: options.email,
    p_secret_hash: hashPanelSessionSecret(secret),
    p_expires_at: options.expiresAt.toISOString(),
    p_founder: options.founder,
    p_user_agent: options.userAgent || null,
    p_ip: options.ip || null,
  });

  if (error || !data) {
    throw error || new Error("No se pudo crear la sesion del panel.");
  }

  const sid = String(data);
  const aal = normalizeAal(options.aal);

  await supabase
    .schema("private")
    .from("panel_sessions")
    .update({ aal })
    .eq("id", sid)
    .then(({ error }) => {
      if (error && !String(error.message || "").includes("aal")) throw error;
    });

  return { sid, secret };
}

export async function getActivePanelServerSession(
  supabase: SupabaseClient,
  cookieSession: PanelSessionCookiePayload
): Promise<ActivePanelServerSession | null> {
  const { data, error } = await supabase.rpc("get_panel_session", {
    p_session_id: cookieSession.sid,
    p_secret_hash: hashPanelSessionSecret(cookieSession.secret),
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.user_id || !row?.email || !row?.expires_at) return null;

  const expiresAt = new Date(row.expires_at);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const { data: sessionRow } = await supabase
    .schema("private")
    .from("panel_sessions")
    .select("aal")
    .eq("id", cookieSession.sid)
    .maybeSingle();

  return {
    userId: String(row.user_id),
    email: String(row.email).toLowerCase(),
    founder: Boolean(row.founder),
    aal: normalizeAal((sessionRow as { aal?: string } | null)?.aal),
    expiresAt,
  };
}

export async function revokePanelServerSession(
  supabase: SupabaseClient,
  cookieSession: PanelSessionCookiePayload | null
) {
  if (!cookieSession?.sid || !cookieSession?.secret) return;

  const { error } = await supabase.rpc("revoke_panel_session", {
    p_session_id: cookieSession.sid,
    p_secret_hash: hashPanelSessionSecret(cookieSession.secret),
  });

  if (error) throw error;
}
