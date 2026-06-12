import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PanelAuthContext = {
  isAuthorized: boolean;
  mode: "user" | "none";
  method: "auth" | "none";
  isFounderMode: boolean;
  userId?: string;
  email?: string;
  storeIds: string[] | null;
  role?: string;
  error?: string;
};

export function normalizeAuthEmail(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/^[A-Za-z_][A-Za-z0-9_]*\s*=\s*/, "")
    .replace(/^["']+|["']+$/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase();
}

export function getFounderEmails() {
  return (process.env.FOUNDER_EMAILS || "")
    .split(",")
    .map((email) => normalizeAuthEmail(email))
    .filter(Boolean);
}

export function isFounderEmail(email?: string | null) {
  const normalizedEmail = normalizeAuthEmail(email);

  if (!normalizedEmail) return false;

  return getFounderEmails().includes(normalizedEmail);
}

export function getSupabaseUserEmail(user: any) {
  const directEmail = normalizeAuthEmail(user?.email);

  if (directEmail) return directEmail;

  const identityEmail = user?.identities
    ?.map((identity: any) => identity?.identity_data?.email)
    .find(Boolean);

  return normalizeAuthEmail(identityEmail);
}

export async function getPanelAuthContext(
  request: NextRequest
): Promise<PanelAuthContext> {
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

    const userEmail = getSupabaseUserEmail(userResult.user);

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
        error: "Tu usuario aún no tiene un negocio vinculado.",
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
