import { NextRequest, NextResponse } from "next/server";
import { PanelAccessError, requirePanelAuth } from "@/lib/panel/access";
import type { PanelAuthContext } from "@/lib/panel/auth";

export async function requireAdminAuth(
  request: NextRequest
): Promise<PanelAuthContext> {
  const auth = await requirePanelAuth(request);

  if (!auth.isFounderMode) {
    throw new PanelAccessError("Solo el fundador puede acceder al admin.", 403);
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

  const message =
    error instanceof Error ? error.message || fallbackMessage : fallbackMessage;

  return NextResponse.json({ error: message }, { status: 500 });
}
