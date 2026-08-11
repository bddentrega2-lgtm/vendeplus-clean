import type { PanelAuthContext } from "./auth";

export type PanelRole = "owner" | "admin" | "operator";

const VALID_PANEL_ROLES = new Set<PanelRole>(["owner", "admin", "operator"]);

export function canAccessStore(auth: PanelAuthContext, storeId?: string | null) {
  return Boolean(storeId && auth.storeIds?.includes(storeId));
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
