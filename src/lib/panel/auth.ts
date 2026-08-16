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
  storeRoles?: Record<string, string>;
  role?: string;
  error?: string;
};

type StoreMembership = { store_id: string; role: string | null };

const MEMBERSHIP_CACHE_TTL_MS = 10_000;
const membershipCache = new Map<
  string,
  { expiresAt: number; rows: StoreMembership[] }
>();

function getCachedMemberships(userId: string) {
  const cached = membershipCache.get(userId);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    membershipCache.delete(userId);
    return null;
  }
  return cached.rows;
}

function cacheMemberships(userId: string, rows: StoreMembership[]) {
  if (membershipCache.size >= 500) {
    const oldestKey = membershipCache.keys().next().value;
    if (oldestKey) membershipCache.delete(oldestKey);
  }
  membershipCache.set(userId, {
    expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS,
    rows,
  });
}

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

    const { data: claimsResult, error: claimsError } =
      await supabase.auth.getClaims(token);
    const claims = claimsResult?.claims;

    if (claimsError || !claims?.sub) {
      return {
        isAuthorized: false,
        mode: "none",
        method: "none",
        isFounderMode: false,
        storeIds: [],
        error: "Sesión inválida.",
      };
    }

    const userId = String(claims.sub);
    const userEmail = normalizeAuthEmail(
      typeof claims.email === "string" ? claims.email : ""
    );

    if (isFounderEmail(userEmail)) {
      const selectedStoreId = String(
        request.headers.get("x-panel-store-id") || ""
      ).trim();
      return {
        isAuthorized: true,
        mode: "user",
        method: "auth",
        isFounderMode: true,
        userId,
        email: userEmail,
        storeIds: selectedStoreId ? [selectedStoreId] : [],
        role: "owner",
      };
    }

    let storeUsers = getCachedMemberships(userId);
    if (!storeUsers) {
      const { data, error: storeUsersError } = await supabase
        .from("store_users")
        .select("store_id, role")
        .eq("user_id", userId);

      if (storeUsersError) throw storeUsersError;
      storeUsers = (data || []) as StoreMembership[];
      if (storeUsers.length) cacheMemberships(userId, storeUsers);
    }

    if (!storeUsers?.length) {
      return {
        isAuthorized: false,
        mode: "user",
        method: "auth",
        isFounderMode: false,
        userId,
        email: userEmail,
        storeIds: [],
        error: "Tu usuario aún no tiene un negocio vinculado.",
      };
    }

    const storeRoles = Object.fromEntries(
      storeUsers
        .filter((row) => row.store_id)
        .map((row) => [row.store_id, row.role || "operator"])
    );

    return {
      isAuthorized: true,
      mode: "user",
      method: "auth",
      isFounderMode: false,
      userId,
      email: userEmail,
      storeIds: storeUsers.map((row) => row.store_id),
      storeRoles,
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
