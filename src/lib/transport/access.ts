import { NextRequest, NextResponse } from "next/server";
import { readPanelSessionCookieFromStore } from "@/lib/server/panel-session-cookie";
import { getActivePanelServerSession } from "@/lib/server/panel-session-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getSupabaseUserEmail,
  isFounderEmail,
  normalizeAuthEmail,
} from "@/lib/panel/auth";

export type TransportRole = "owner" | "admin" | "operator" | "billing";

const VALID_TRANSPORT_ROLES = new Set<TransportRole>([
  "owner",
  "admin",
  "operator",
  "billing",
]);

export class TransportAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TransportAccessError";
    this.status = status;
  }
}

export type TransportAuthContext = {
  isFounderMode: boolean;
  userId: string;
  email: string;
  agencyIds: string[] | null;
  agencyRoles?: Record<string, string>;
  role?: string;
};

export async function requireTransportAgencyAuth(
  request: NextRequest
): Promise<TransportAuthContext> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace("Bearer ", "").trim();
  const cookieSession = token
    ? null
    : readPanelSessionCookieFromStore(request.cookies);

  if (!token && !cookieSession) throw new TransportAccessError("No autorizado.", 401);

  const supabase = createSupabaseAdminClient();
  let userId = cookieSession?.sub || "";
  let email = normalizeAuthEmail(cookieSession?.email || "");

  if (token) {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) throw new TransportAccessError("Sesion invalida.", 401);

    userId = data.user.id;
    email = getSupabaseUserEmail(data.user);
  } else if (cookieSession) {
    const serverSession = await getActivePanelServerSession(
      supabase,
      cookieSession
    );

    if (!serverSession) throw new TransportAccessError("Sesion invalida.", 401);

    userId = serverSession.userId;
    email = serverSession.email;
  }

  if (!userId || !email) throw new TransportAccessError("Sesion invalida.", 401);

  if (isFounderEmail(email)) {
    return {
      isFounderMode: true,
      userId,
      email,
      agencyIds: null,
      role: "owner",
    };
  }

  const normalizedEmail = normalizeAuthEmail(email);
  const [
    { data: userRows, error: userRowsError },
    { data: emailRows, error: emailRowsError },
  ] = await Promise.all([
    supabase
      .from("transport_agency_users")
      .select("agency_id, role")
      .eq("user_id", userId),
    normalizedEmail
      ? supabase
          .from("transport_agency_users")
          .select("agency_id, role")
          .eq("email", normalizedEmail)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (userRowsError) throw userRowsError;

  if (emailRowsError) throw emailRowsError;

  const rowsByAgency = new Map<string, any>();
  for (const row of [...(userRows || []), ...(emailRows || [])]) {
    if (row?.agency_id) rowsByAgency.set(row.agency_id, row);
  }
  const rows = Array.from(rowsByAgency.values());

  if (!rows?.length) {
    throw new TransportAccessError("Tu usuario aun no tiene una empresa delivery vinculada.", 403);
  }

  const agencyRoles = Object.fromEntries(
    rows
      .filter((row: any) => row.agency_id)
      .map((row: any) => [row.agency_id, row.role || "operator"])
  );

  return {
    isFounderMode: false,
    userId,
    email: normalizedEmail,
    agencyIds: rows.map((row: any) => row.agency_id).filter(Boolean),
    agencyRoles,
    role: rows[0]?.role || "operator",
  };
}

export function assertAgencyAccess(auth: TransportAuthContext, agencyId?: string | null) {
  if (auth.isFounderMode) return;
  if (!agencyId || !auth.agencyIds?.includes(agencyId)) {
    throw new TransportAccessError("No tienes permiso para esta empresa delivery.", 403);
  }
}

export function getAgencyRole(
  auth: TransportAuthContext,
  agencyId?: string | null
): TransportRole | null {
  if (auth.isFounderMode) return "owner";

  const role =
    (agencyId && auth.agencyRoles?.[agencyId]) ||
    (agencyId && auth.agencyIds?.includes(agencyId) ? auth.role : undefined);

  return VALID_TRANSPORT_ROLES.has(role as TransportRole)
    ? (role as TransportRole)
    : null;
}

export function canUseAgencyRole(
  auth: TransportAuthContext,
  agencyId: string | null | undefined,
  allowedRoles: TransportRole[]
) {
  const role = getAgencyRole(auth, agencyId);
  return Boolean(role && allowedRoles.includes(role));
}

export function assertAgencyRole(
  auth: TransportAuthContext,
  agencyId: string | null | undefined,
  allowedRoles: TransportRole[],
  message = "Tu rol no permite realizar esta accion."
) {
  assertAgencyAccess(auth, agencyId);

  if (!canUseAgencyRole(auth, agencyId, allowedRoles)) {
    throw new TransportAccessError(message, 403);
  }
}

export function assertAgencyManager(
  auth: TransportAuthContext,
  agencyId?: string | null,
  message = "Solo owner o admin pueden realizar esta accion."
) {
  assertAgencyRole(auth, agencyId, ["owner", "admin"], message);
}

export function transportErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof TransportAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
