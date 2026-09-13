import { NextRequest, NextResponse } from "next/server";
import { createPanelSessionCookie, getPanelSessionCookieMaxAge, PANEL_SESSION_COOKIE } from "@/lib/server/panel-session-cookie";
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
  const cookieValue = createPanelSessionCookie({
    sub: data.user.id,
    email,
    exp,
    founder: isFounderEmail(email),
  });
  const maxAge = getPanelSessionCookieMaxAge(exp);

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

export async function DELETE() {
  return clearSessionResponse();
}
