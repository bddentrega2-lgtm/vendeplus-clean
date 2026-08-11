"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  getPanelAuthHeaders,
  getSavedPanelToken,
  getSelectedPanelStoreId,
  primePanelAuthSession,
  saveSelectedPanelStoreId,
} from "@/lib/panel/client-auth";

type PanelStoreOption = { id: string; name: string; slug: string };

type PanelAuthContextValue = {
  hasSession: boolean;
  isBootstrapping: boolean;
  refreshSession: () => Promise<void>;
  clearSession: () => void;
  isFounderMode: boolean;
  stores: PanelStoreOption[];
  selectedStoreId: string;
  selectStore: (storeId: string) => void;
};

const PanelAuthContext = createContext<PanelAuthContextValue | null>(null);

export function PanelAuthProvider({ children }: { children: React.ReactNode }) {
  const [hasSession, setHasSession] = useState(() => Boolean(getSavedPanelToken()));
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isFounderMode, setIsFounderMode] = useState(false);
  const [stores, setStores] = useState<PanelStoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState(() => getSelectedPanelStoreId());

  async function loadPanelContext() {
    const response = await fetch("/api/panel/context", {
      headers: await getPanelAuthHeaders(),
    });
    if (!response.ok) return;
    const data = await response.json();
    const availableStores = Array.isArray(data.stores) ? data.stores : [];
    const savedStoreId = getSelectedPanelStoreId();
    const nextStoreId = availableStores.some((store: PanelStoreOption) => store.id === savedStoreId)
      ? savedStoreId
      : availableStores[0]?.id || "";

    saveSelectedPanelStoreId(nextStoreId);
    setSelectedStoreId(nextStoreId);
    setStores(availableStores);
    setIsFounderMode(Boolean(data.isFounderMode));
  }

  async function refreshSession() {
    setIsBootstrapping(true);
    await primePanelAuthSession();
    setHasSession(Boolean(getSavedPanelToken()));
    if (getSavedPanelToken()) await loadPanelContext();
    setIsBootstrapping(false);
  }

  function clearSession() {
    setHasSession(false);
    setIsBootstrapping(false);
  }

  function selectStore(storeId: string) {
    if (!stores.some((store) => store.id === storeId)) return;
    saveSelectedPanelStoreId(storeId);
    setSelectedStoreId(storeId);
    window.location.reload();
  }

  useEffect(() => {
    let active = true;

    async function boot() {
      await primePanelAuthSession();
      if (!active) return;
      setHasSession(Boolean(getSavedPanelToken()));
      if (getSavedPanelToken()) await loadPanelContext();
      if (!active) return;
      setIsBootstrapping(false);
    }

    boot();

    return () => {
      active = false;
    };
  }, []);

  const value = {
    hasSession,
    isBootstrapping,
    refreshSession,
    clearSession,
    isFounderMode,
    stores,
    selectedStoreId,
    selectStore,
  };

  return (
    <PanelAuthContext.Provider value={value}>
      {children}
    </PanelAuthContext.Provider>
  );
}

export function usePanelAuth() {
  const context = useContext(PanelAuthContext);

  if (!context) {
    return {
      hasSession: Boolean(getSavedPanelToken()),
      isBootstrapping: false,
      refreshSession: primePanelAuthSession,
      clearSession: () => {},
      isFounderMode: false,
      stores: [],
      selectedStoreId: getSelectedPanelStoreId(),
      selectStore: () => {},
    };
  }

  return context;
}
