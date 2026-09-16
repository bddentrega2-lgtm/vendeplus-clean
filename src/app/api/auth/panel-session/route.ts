import { NextRequest, NextResponse } from "next/server";
import {
  createPanelSessionCookie,
  getPanelSessionCookieMaxAge,
  PANEL_SESSION_COOKIE,
  readPanelSessionCookieFromStore,
} from "@/lib/server/panel-session-cookie";
import { createPanelServerSession, revokePanelServerSession } from "@/lib/server/panel-session-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseUserEmail, isFounderEmail, normalizeAuthEmail } from "@/lib/panel/auth";

function clearSessionResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PANEL_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function getJwtExpiry(token: string) {
  try {
    const encodedPayload = token.split(".")[1] || "";
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    return Number(payload.exp || 0);
  } catch {
    return 0;
  }
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return (forwardedFor?.split(",")[0]?.trim() || realIp || "")
    .replace(/[^a-zA-Z0-9:._-]/g, "")
    .slice(0, 80);
}

export async function POST(request: NextRequest) {
  const { accessToken } = await request.json().catch(() => ({ accessToken: "" }));
  const token = String(accessToken || "").trim();

  if (!token) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return NextResponse.json({ error: "Sesion invalida." }, { status: 401 });
  }

  const email = normalizeAuthEmail(getSupabaseUserEmail(data.user));
  const exp = getJwtExpiry(token);
  const maxAge = getPanelSessionCookieMaxAge(exp);

  if (!email || maxAge <= 0) {
    return NextResponse.json({ error: "Sesion invalida." }, { status: 401 });
  }

  const serverSession = await createPanelServerSession(supabase, {
    userId: data.user.id,
    email,
    founder: isFounderEmail(email),
    expiresAt: new Date(Date.now() + maxAge * 1000),
    userAgent: request.headers.get("user-agent"),
    ip: getClientIp(request),
  });
  const cookieValue = createPanelSessionCookie({
    sid: serverSession.sid,
    secret: serverSession.secret,
    sub: data.user.id,
    email,
    exp,
    founder: isFounderEmail(email),
  });

  if (!cookieValue || maxAge <= 0) {
    return NextResponse.json({ error: "Sesion invalida." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(PANEL_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  const cookieSession = readPanelSessionCookieFromStore(request.cookies);

  if (cookieSession) {
    try {
      await revokePanelServerSession(createSupabaseAdminClient(), cookieSession);
    } catch {
      // Igual limpiamos la cookie del navegador aunque Supabase no responda.
    }
  }

  return clearSessionResponse();
}
