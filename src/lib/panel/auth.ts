import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PanelAuthContext = {
  isAuthorized: boolean;
  mode: "pin" | "user" | "none";
  method: "pin" | "auth" | "none";
  isFounderMode: boolean;
  userId?: string;
  email?: string;
  storeIds: string[] | null;
  role?: string;
  error?: string;
};

function getFounderEmails() {
  return (process.env.FOUNDER_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isFounderEmail(email?: string | null) {
  if (!email) return false;
  return getFounderEmails().includes(email.trim().toLowerCase());
}

export async function getPanelAuthContext(
  request: NextRequest
): Promise<PanelAuthContext> {
  const expectedPin = process.env.PANEL_ACCESS_PIN;
  const receivedPin = request.headers.get("x-panel-pin");
  const isProduction = process.env.NODE_ENV === "production";
  const isPanelPinAllowed =
    !isProduction || process.env.ALLOW_PANEL_PIN_IN_PRODUCTION !== "false";

  /*
   * Founder PIN is a temporary operational fallback, not a customer auth model.
   * It grants global access through storeIds: null and must be replaced by real
   * owner/admin roles before selling Vende+ at scale. Set
   * ALLOW_PANEL_PIN_IN_PRODUCTION=false to disable it in production.
   */
  if (isPanelPinAllowed && expectedPin && receivedPin && receivedPin === expectedPin) {
    return {
      isAuthorized: true,
      mode: "pin",
      method: "pin",
      isFounderMode: true,
      storeIds: null,
      role: "owner",
    };
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.replace("Bearer ", "").trim();

  if (!token) {
    return {
      isAuthorized: false,
      mode: "none",
      method: "none",
      isFounderMode: false,
      storeIds: [],
      error: "No autorizado.",
    };
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data: userResult, error: userError } =
      await supabase.auth.getUser(token);

    if (userError || !userResult.user) {
      return {
        isAuthorized: false,
        mode: "none",
        method: "none",
        isFounderMode: false,
        storeIds: [],
        error: "Sesión inválida.",
      };
    }

    const userEmail = userResult.user.email || "";

    if (isFounderEmail(userEmail)) {
      return {
        isAuthorized: true,
        mode: "user",
        method: "auth",
        isFounderMode: true,
        userId: userResult.user.id,
        email: userEmail,
        storeIds: null,
        role: "owner",
      };
    }

    const { data: storeUsers, error: storeUsersError } = await supabase
      .from("store_users")
      .select("store_id, role")
      .eq("user_id", userResult.user.id);

    if (storeUsersError) throw storeUsersError;

    if (!storeUsers?.length) {
      return {
        isAuthorized: false,
        mode: "user",
        method: "auth",
        isFounderMode: false,
        userId: userResult.user.id,
        email: userEmail,
        storeIds: [],
        error: "Usuario sin comercio asignado.",
      };
    }

    return {
      isAuthorized: true,
      mode: "user",
      method: "auth",
      isFounderMode: false,
      userId: userResult.user.id,
      email: userEmail,
      storeIds: storeUsers.map((row) => row.store_id),
      role: storeUsers[0]?.role || "operator",
    };
  } catch (error: any) {
    return {
      isAuthorized: false,
      mode: "none",
      method: "none",
      isFounderMode: false,
      storeIds: [],
      error: error.message || "Error validando sesión.",
    };
  }
}

export function filterByAuthorizedStores<T extends { store_id?: string }>(
  rows: T[],
  storeIds: string[] | null
) {
  if (storeIds === null) return rows;

  return rows.filter((row) => row.store_id && storeIds.includes(row.store_id));
}
