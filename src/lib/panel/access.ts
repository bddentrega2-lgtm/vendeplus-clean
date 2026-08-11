import { NextRequest, NextResponse } from "next/server";
import { getPanelAuthContext, type PanelAuthContext } from "@/lib/panel/auth";

export type PanelRole = "owner" | "admin" | "operator";

const VALID_PANEL_ROLES = new Set<PanelRole>(["owner", "admin", "operator"]);

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

export function getStoreRole(
  auth: PanelAuthContext,
  storeId?: string | null
): PanelRole | null {
  if (auth.isFounderMode) {
    return storeId && auth.storeIds?.includes(storeId) ? "owner" : null;
  }

  const role =
    (storeId && auth.storeRoles?.[storeId]) ||
    (storeId && auth.storeIds?.includes(storeId) ? auth.role : undefined);

  return VALID_PANEL_ROLES.has(role as PanelRole) ? (role as PanelRole) : null;
}

export function canUseStoreRole(
  auth: PanelAuthContext,
  storeId: string | null | undefined,
  allowedRoles: PanelRole[]
) {
  const role = getStoreRole(auth, storeId);
  return Boolean(role && allowedRoles.includes(role));
}

export function assertStoreRole(
  auth: PanelAuthContext,
  storeId: string | null | undefined,
  allowedRoles: PanelRole[],
  message = "Tu rol no permite realizar esta accion."
) {
  assertStoreAccess(auth, storeId);

  if (!canUseStoreRole(auth, storeId, allowedRoles)) {
    throw new PanelAccessError(message, 403);
  }
}

export function assertStoreManager(
  auth: PanelAuthContext,
  storeId?: string | null,
  message = "Solo owner o admin pueden realizar esta accion."
) {
  assertStoreRole(auth, storeId, ["owner", "admin"], message);
}

export function unauthorized(message = "No autorizado.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "No tienes permiso para esta accion.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message = "Solicitud invalida.") {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function panelErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof PanelAccessError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
