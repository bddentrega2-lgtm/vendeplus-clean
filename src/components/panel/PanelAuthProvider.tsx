"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getSavedPanelToken,
  primePanelAuthSession,
} from "@/lib/panel/client-auth";

type PanelAuthContextValue = {
  hasSession: boolean;
  isBootstrapping: boolean;
  refreshSession: () => Promise<void>;
  clearSession: () => void;
};

const PanelAuthContext = createContext<PanelAuthContextValue | null>(null);

export function PanelAuthProvider({ children }: { children: React.ReactNode }) {
  const [hasSession, setHasSession] = useState(() => Boolean(getSavedPanelToken()));
  const [isBootstrapping, setIsBootstrapping] = useState(() => !getSavedPanelToken());

  async function refreshSession() {
    setIsBootstrapping(!getSavedPanelToken());
    await primePanelAuthSession();
    setHasSession(Boolean(getSavedPanelToken()));
    setIsBootstrapping(false);
  }

  function clearSession() {
    setHasSession(false);
    setIsBootstrapping(false);
  }

  useEffect(() => {
    let active = true;

    async function boot() {
      await primePanelAuthSession();
      if (!active) return;
      setHasSession(Boolean(getSavedPanelToken()));
      setIsBootstrapping(false);
    }

    boot();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      hasSession,
      isBootstrapping,
      refreshSession,
      clearSession,
    }),
    [hasSession, isBootstrapping]
  );

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
    };
  }

  return context;
}
