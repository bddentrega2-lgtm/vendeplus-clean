import { NextRequest } from "next/server";
import { PanelAccessError } from "@/lib/panel/access";
import type { PanelAuthContext } from "@/lib/panel/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getActiveAdminMfaSession } from "@/lib/admin/mfa-session-store";
import { readAdminMfaCookieFromStore } from "@/lib/admin/mfa-session-cookie";

export function isAdminMfaEnforced() {
  return process.env.ADMIN_MFA_ENFORCEMENT === "true";
}

export async function assertAdminMfa(request: NextRequest, auth: PanelAuthContext) {
  if (!isAdminMfaEnforced()) return;
  const cookie = readAdminMfaCookieFromStore(request.cookies);
  if (!cookie || !auth.userId || !auth.email) throw new PanelAccessError("Confirma tu autenticador para continuar.", 403);
  const session = await getActiveAdminMfaSession(createSupabaseAdminClient(), cookie);
  if (!session || session.userId !== auth.userId || session.email !== auth.email.toLowerCase()) {
    throw new PanelAccessError("Confirma tu autenticador para continuar.", 403);
  }
}
