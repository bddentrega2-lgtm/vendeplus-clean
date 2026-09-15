import { NextResponse, type NextRequest } from "next/server";
import { PANEL_SESSION_COOKIE, readPanelSessionCookie } from "@/lib/server/panel-session-cookie";

const PUBLIC_PANEL_PATHS = new Set([
  "/panel/login",
  "/panel/update-password",
]);

function redirectToLogin(request: NextRequest, loginPath: string) {
  const url = request.nextUrl.clone();
  url.pathname = loginPath;
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/transporte/panel")) {
    return NextResponse.next();
  }

  if (PUBLIC_PANEL_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const session = readPanelSessionCookie(request.cookies.get(PANEL_SESSION_COOKIE)?.value);

  if (!session) {
    return redirectToLogin(request, "/panel/login");
  }

  if (pathname.startsWith("/admin") && !session.founder) {
    return NextResponse.redirect(new URL("/panel", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/panel/:path*", "/transporte/panel/:path*"],
};
