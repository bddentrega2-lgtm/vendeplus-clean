"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { usePanelAuth } from "@/components/panel/PanelAuthProvider";
import { getPanelAccessToken, getPanelAuthHeaders, getSavedPanelPin } from "@/lib/panel/client-auth";

export type PanelContextStore = {
  id: string;
  name: string;
  slug: string;
  branch_name?: string | null;
  brand_id?: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  subscription_status?: string | null;
  subscription_ends_at?: string | null;
  next_payment_due_at?: string | null;
  trial_ends_at?: string | null;
  brands?: { id: string; name: string; slug: string; logo_url: string | null } | null;
};

type PanelStoreContextValue = {
  stores: PanelContextStore[];
  activeStore: PanelContextStore | null;
  activeStoreId: string;
  loading: boolean;
  selectStore: (storeId: string) => void;
};

const STORAGE_KEY = "somos_panel_active_store_id";
export const PANEL_STORE_CHANGE_EVENT = "somos:panel-store-change";
const PanelStoreContext = createContext<PanelStoreContextValue | null>(null);

function getSavedStoreId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEY) || "";
}

export function PanelStoreProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hasSession, isBootstrapping } = usePanelAuth();
  const [stores, setStores] = useState<PanelContextStore[]>([]);
  const [activeStoreId, setActiveStoreId] = useState(getSavedStoreId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      if (isBootstrapping) return;

      const pin = getSavedPanelPin();
      const token = await getPanelAccessToken();
      if (!hasSession && !pin && !token) {
        if (active) setStores([]);
        if (active) setLoading(false);
        return;
      }

      if (active) setLoading(true);

      try {
        const response = await fetch("/api/panel/context", {
          headers: await getPanelAuthHeaders(pin),
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "No pudimos cargar tus sedes.");
        if (!active) return;

        const nextStores = Array.isArray(payload.stores) ? payload.stores : [];
        setStores(nextStores);
        setActiveStoreId((current) =>
          nextStores.some((store: PanelContextStore) => store.id === current)
            ? current
            : nextStores[0]?.id || ""
        );
      } catch {
        if (active) setStores([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [hasSession, isBootstrapping, pathname]);

  function selectStore(storeId: string) {
    if (!stores.some((store) => store.id === storeId)) return;
    window.localStorage.setItem(STORAGE_KEY, storeId);
    setActiveStoreId(storeId);
    window.dispatchEvent(new CustomEvent(PANEL_STORE_CHANGE_EVENT, { detail: { storeId } }));
  }

  useEffect(() => {
    if (activeStoreId) window.localStorage.setItem(STORAGE_KEY, activeStoreId);
  }, [activeStoreId]);

  const value = useMemo(
    () => ({
      stores,
      activeStoreId,
      activeStore: stores.find((store) => store.id === activeStoreId) || stores[0] || null,
      loading,
      selectStore,
    }),
    [stores, activeStoreId, loading]
  );

  return <PanelStoreContext.Provider value={value}>{children}</PanelStoreContext.Provider>;
}

export function usePanelStore() {
  const context = useContext(PanelStoreContext);
  if (!context) throw new Error("usePanelStore debe usarse dentro de PanelStoreProvider.");
  return context;
}
