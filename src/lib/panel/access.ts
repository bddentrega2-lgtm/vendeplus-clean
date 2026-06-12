import { NextRequest, NextResponse } from "next/server";
import { getPanelAuthContext, type PanelAuthContext } from "@/lib/panel/auth";

export class PanelAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PanelAccessError";
    this.status = status;
  }
}

export async function requirePanelAuth(
  request: NextRequest
): Promise<PanelAuthContext> {
  const auth = await getPanelAuthContext(request);

  if (!auth.isAuthorized) {
    throw new PanelAccessError(auth.error || "No autorizado.", 401);
  }

  return auth;
}

export function canAccessStore(
  auth: PanelAuthContext,
  storeId?: string | null
) {
  if (auth.isFounderMode) return true;
  return Boolean(storeId && auth.storeIds?.includes(storeId));
}

export function assertStoreAccess(
  auth: PanelAuthContext,
  storeId?: string | null,
  message = "No tienes permiso para acceder a este comercio."
) {
  if (!canAccessStore(auth, storeId)) {
    throw new PanelAccessError(message, 403);
  }
}

export function unauthorized(message = "No autorizado.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "No tienes permiso para esta acción.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message = "Solicitud inválida.") {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function panelErrorResponse(error: unknown, fallbackMessage: string) {
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
