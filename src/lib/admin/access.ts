import { NextRequest, NextResponse } from "next/server";
import { PanelAccessError, requirePanelAuth } from "@/lib/panel/access";
import type { PanelAuthContext } from "@/lib/panel/auth";
import { assertAdminMfa } from "@/lib/admin/mfa";

export async function requireAdminAuth(
  request: NextRequest
): Promise<PanelAuthContext> {
  const auth = await requirePanelAuth(request);

  if (!auth.isFounderMode) {
    throw new PanelAccessError("Solo el fundador puede acceder al admin.", 403);
  }

  // The MFA-session endpoint is the narrow bootstrap path that creates/checks
  // the second-factor session. It still requires the authenticated founder.
  if (request.nextUrl.pathname !== "/api/admin/mfa-session") {
    await assertAdminMfa(request, auth);
  }

  return auth;
}

export function adminErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof PanelAccessError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
