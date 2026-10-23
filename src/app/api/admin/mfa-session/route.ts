import { NextRequest, NextResponse } from "next/server";
import { PanelAccessError } from "@/lib/panel/access";
import { requireAdminAuth } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAdminMfaCookie, ADMIN_MFA_SESSION_COOKIE, getAdminMfaCookieMaxAge, readAdminMfaCookieFromStore } from "@/lib/admin/mfa-session-cookie";
import { createAdminMfaSession, getActiveAdminMfaSession, revokeAdminMfaSession } from "@/lib/admin/mfa-session-store";
import { isAdminMfaEnforced } from "@/lib/admin/mfa";

function responseWithClearedCookie(body: object, status = 200) {
  const response = NextResponse.json(body, { status });
  response.cookies.set(ADMIN_MFA_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}

function clientIp(request: NextRequest) {
  return String(request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "").split(",")[0].replace(/[^a-zA-Z0-9:._-]/g, "").slice(0, 80);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    if (!auth.userId || !auth.email) return responseWithClearedCookie({ required: isAdminMfaEnforced(), verified: false }, 401);
    const session = await getActiveAdminMfaSession(createSupabaseAdminClient(), readAdminMfaCookieFromStore(request.cookies));
    const verified = Boolean(session && session.userId === auth.userId && session.email === auth.email.toLowerCase());
    return NextResponse.json({ required: isAdminMfaEnforced(), verified });
  } catch { return responseWithClearedCookie({ required: isAdminMfaEnforced(), verified: false }, 401); }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    if (!auth.userId || !auth.email) throw new PanelAccessError("Solo el fundador puede confirmar este acceso.", 403);
    const { accessToken } = await request.json().catch(() => ({ accessToken: "" }));
    const token = String(accessToken || "").trim();
    if (!token) throw new PanelAccessError("Confirma tu autenticador para continuar.", 401);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.auth.getClaims(token);
    const claims = data?.claims as Record<string, unknown> | undefined;
    const email = typeof claims?.email === "string" ? claims.email.toLowerCase() : "";
    const expiresAt = Number(claims?.exp || 0);
    if (error || claims?.sub !== auth.userId || email !== auth.email.toLowerCase() || claims?.aal !== "aal2" || expiresAt <= Math.floor(Date.now() / 1000)) {
      throw new PanelAccessError("El código no se pudo confirmar. Vuelve a intentarlo.", 403);
    }
    const serverSession = await createAdminMfaSession(supabase, { userId: auth.userId, email: auth.email, expiresAt: new Date(expiresAt * 1000), userAgent: request.headers.get("user-agent"), ip: clientIp(request) });
    const maxAge = getAdminMfaCookieMaxAge(expiresAt);
    const value = createAdminMfaCookie({ ...serverSession, sub: auth.userId, email: auth.email, exp: expiresAt });
    if (!value || maxAge <= 0) throw new PanelAccessError("No se pudo confirmar el autenticador.", 401);
    const response = NextResponse.json({ verified: true });
    response.cookies.set(ADMIN_MFA_SESSION_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
    return response;
  } catch (error) {
    const status = error instanceof PanelAccessError ? error.status : 500;
    const message = error instanceof PanelAccessError ? error.message : "No se pudo confirmar el autenticador.";
    return responseWithClearedCookie({ error: message }, status);
  }
}

export async function DELETE(request: NextRequest) {
  try { await revokeAdminMfaSession(createSupabaseAdminClient(), readAdminMfaCookieFromStore(request.cookies)); } catch { /* Clear the browser cookie even if revocation is unavailable. */ }
  return responseWithClearedCookie({ ok: true });
}
