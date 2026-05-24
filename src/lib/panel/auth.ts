import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PanelAuthContext = {
  isAuthorized: boolean;
  mode: "pin" | "user" | "none";
  userId?: string;
  email?: string;
  storeIds: string[] | null;
  role?: string;
  error?: string;
};

export async function getPanelAuthContext(
  request: NextRequest
): Promise<PanelAuthContext> {
  const expectedPin = process.env.PANEL_ACCESS_PIN;
  const receivedPin = request.headers.get("x-panel-pin");

  if (expectedPin && receivedPin && receivedPin === expectedPin) {
    return {
      isAuthorized: true,
      mode: "pin",
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
        storeIds: [],
        error: "Sesión inválida.",
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
        userId: userResult.user.id,
        email: userResult.user.email || "",
        storeIds: [],
        error: "Usuario sin comercio asignado.",
      };
    }

    return {
      isAuthorized: true,
      mode: "user",
      userId: userResult.user.id,
      email: userResult.user.email || "",
      storeIds: storeUsers.map((row) => row.store_id),
      role: storeUsers[0]?.role || "operator",
    };
  } catch (error: any) {
    return {
      isAuthorized: false,
      mode: "none",
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
