"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { requestTimeoutSignal } from "@/lib/client/request-timeout";
import { bindMobileAccount, clearMobilePrivateState, isNativeApp, readMobile, writeMobile } from "@/lib/mobile/state";
import { clearPanelReadCache } from "@/lib/panel/client-fetch-cache";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getPanelAuthHeaders,
  getSavedPanelToken,
  getSelectedPanelStoreId,
  primePanelAuthSession,
  saveSelectedPanelStoreId,
} from "@/lib/panel/client-auth";

export type PanelStoreOption = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_image_url: string | null;
  subscription_status?: string | null;
  subscription_ends_at?: string | null;
  next_payment_due_at?: string | null;
  trial_ends_at?: string | null;
  table_orders_access_enabled?: boolean;
};

type PanelAchievement = {
  feature: string;
  title: string;
  unlocked: boolean;
};

type PanelAuthContextValue = {
  hasSession: boolean;
  isBootstrapping: boolean;
  isRevalidating: boolean;
  contextError: string;
  accountId: string;
  refreshSession: () => Promise<void>;
  revalidateSession: () => Promise<void>;
  clearSession: () => void;
  isFounderMode: boolean;
  stores: PanelStoreOption[];
  selectedStoreId: string;
  selectedStore: PanelStoreOption | null;
  achievementFeatures: Record<string, boolean>;
  achievements: PanelAchievement[];
  selectStore: (storeId: string) => void;
};

const PanelAuthContext = createContext<PanelAuthContextValue | null>(null);

function getContextErrorMessage(error: unknown, fallback: string) {
  if (error instanceof TypeError || (error instanceof Error && /AbortSignal|timeout/i.test(error.message))) {
    return fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export function PanelAuthProvider({ children }: { children: React.ReactNode }) {
  const [hasSession, setHasSession] = useState(() => Boolean(getSavedPanelToken()));
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isFounderMode, setIsFounderMode] = useState(false);
  const [stores, setStores] = useState<PanelStoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState(() => getSelectedPanelStoreId());
  const [achievementFeatures, setAchievementFeatures] = useState<Record<string, boolean>>({});
  const [achievements, setAchievements] = useState<PanelAchievement[]>([]);
  const [contextError, setContextError] = useState("");
  const [accountId, setAccountId] = useState("");
  const requestVersion = useRef(0);
  const accountRef = useRef("");

  function resetContext() {
    setStores([]); setSelectedStoreId(""); setIsFounderMode(false);
    setAchievementFeatures({}); setAchievements([]); setAccountId("");
    accountRef.current = "";
    clearPanelReadCache();
  }

  async function loadPanelContext() {
    const version = ++requestVersion.current;
    const response = await fetch("/api/panel/context", {
      headers: await getPanelAuthHeaders(),
      cache: "no-store",
      signal: requestTimeoutSignal(12_000),
    });
    if (version !== requestVersion.current) return;
    if (!response.ok) {
      if ([401, 403].includes(response.status)) { resetContext(); setHasSession(false); clearMobilePrivateState(); saveSelectedPanelStoreId(""); }
      throw new Error(response.status === 401 ? "Inicia sesion para continuar." : "No pudimos comprobar tu acceso. Reintenta.");
    }
    let data = await response.json();
    if (version !== requestVersion.current) return;
    const userId = String(data.userId || "");
    bindMobileAccount(userId);
    if (accountRef.current && accountRef.current !== userId) { resetContext(); saveSelectedPanelStoreId(""); }
    const availableStores = Array.isArray(data.stores) ? data.stores : [];
    const savedStoreId = getSelectedPanelStoreId() || readMobile("private_store", "");
    const nextStoreId = availableStores.some((store: PanelStoreOption) => store.id === savedStoreId)
      ? savedStoreId
      : availableStores[0]?.id || "";

    saveSelectedPanelStoreId(nextStoreId);
    if (isNativeApp() && nextStoreId && nextStoreId !== data.selectedStoreId) {
      const selectedResponse = await fetch("/api/panel/context", { headers: await getPanelAuthHeaders(), cache: "no-store", signal: requestTimeoutSignal(12_000) });
      if (!selectedResponse.ok) throw new Error("No pudimos comprobar el comercio elegido.");
      data = await selectedResponse.json();
      if (data.userId !== userId) throw new Error("La sesion cambio. Vuelve a ingresar.");
    }
    if (version !== requestVersion.current) return;
    accountRef.current = userId;
    setHasSession(true);
    setAccountId(userId);
    writeMobile("private_store", nextStoreId);
    writeMobile("space", "business");
    setSelectedStoreId(nextStoreId);
    setStores(availableStores);
    setIsFounderMode(Boolean(data.isFounderMode));
    setAchievementFeatures(data.achievementFeatures || {});
    setAchievements(Array.isArray(data.achievements) ? data.achievements : []);
    setContextError("");
  }

  async function refreshSession() {
    setIsBootstrapping(true);
    setContextError("");
    try {
      await primePanelAuthSession();
      setHasSession(Boolean(getSavedPanelToken()));
      await loadPanelContext();
    } catch (error) {
      resetContext();
      setContextError(getContextErrorMessage(error, "No pudimos cargar el panel. Revisa tu conexion y reintenta."));
    } finally { setIsBootstrapping(false); }
  }

  function clearSession() {
    requestVersion.current += 1;
    resetContext();
    clearMobilePrivateState();
    setHasSession(false);
    setContextError("Inicia sesion para continuar.");
    setIsBootstrapping(false);
  }

  async function revalidateSession() {
    if (!isNativeApp() || !accountRef.current) return;
    setIsRevalidating(true);
    try { await loadPanelContext(); }
    catch (error) { setContextError(getContextErrorMessage(error, "No pudimos comprobar tu acceso. Reintenta.")); }
    finally { setIsRevalidating(false); }
  }

  function selectStore(storeId: string) {
    if (!stores.some((store) => store.id === storeId)) return;
    saveSelectedPanelStoreId(storeId);
    clearPanelReadCache();
    void refreshSession();
  }

  useEffect(() => {
    void refreshSession();
    const resume = () => { void revalidateSession(); };
    window.addEventListener("somos:resume", resume);
    const client = createSupabaseBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      if (!isNativeApp()) return;
      if (event === "SIGNED_OUT") { clearSession(); return; }
      if (event === "SIGNED_IN" && accountRef.current && session?.user.id !== accountRef.current) {
        clearSession();
        timer = setTimeout(() => void refreshSession(), 0);
      }
    }).data.subscription;
    return () => {
      requestVersion.current += 1;
      window.removeEventListener("somos:resume", resume);
      subscription?.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const value = {
    hasSession,
    isBootstrapping,
    isRevalidating,
    contextError,
    accountId,
    refreshSession,
    revalidateSession,
    clearSession,
    isFounderMode,
    stores,
    selectedStoreId,
    selectedStore: stores.find((store) => store.id === selectedStoreId) || stores[0] || null,
    achievementFeatures,
    achievements,
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
      isRevalidating: false,
      contextError: "",
      accountId: "",
      refreshSession: primePanelAuthSession,
      revalidateSession: primePanelAuthSession,
      clearSession: () => {},
      isFounderMode: false,
      stores: [],
      selectedStoreId: getSelectedPanelStoreId(),
      selectedStore: null,
      achievementFeatures: {},
      achievements: [],
      selectStore: () => {},
    };
  }

  return context;
}
