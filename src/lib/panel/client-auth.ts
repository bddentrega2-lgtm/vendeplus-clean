"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeInternalPanelPath } from "@/lib/panel/safe-redirect";

const PANEL_TOKEN_KEY = "vendeplus_panel_token";
const PANEL_PIN_KEY = "vendeplus_panel_pin";
const PANEL_STORE_KEY = "vendeplus_panel_store_id";
const PANEL_OAUTH_REDIRECT_KEY = "vendeplus_panel_oauth_redirect";

let memoryPanelToken = "";
let panelSessionBootstrapped = false;
let panelTokenPromise: Promise<string> | null = null;

function isTokenStillUsable(token: string) {
  try {
    const encodedPayload = token.split(".")[1] || "";
    const base64Payload = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const payload = JSON.parse(atob(base64Payload));
    const expiresAtMs = Number(payload.exp || 0) * 1000;
    return expiresAtMs > Date.now() + 60_000;
  } catch {
    return false;
  }
}

export function getSavedPanelToken() {
  if (memoryPanelToken) return memoryPanelToken;
  if (typeof window === "undefined") return "";

  const savedToken = sessionStorage.getItem(PANEL_TOKEN_KEY) || "";
  memoryPanelToken = savedToken;
  return savedToken;
}

export function getSavedPanelPin() {
  return "";
}

export function hasSavedPanelAuth() {
  return Boolean(getSavedPanelToken());
}

export function savePanelToken(accessToken: string) {
  if (typeof window === "undefined") return;
  memoryPanelToken = accessToken;
  sessionStorage.setItem(PANEL_TOKEN_KEY, accessToken);
  sessionStorage.removeItem(PANEL_PIN_KEY);
}

export async function syncPanelServerSession(accessToken: string) {
  if (!accessToken) return;

  const response = await fetch("/api/auth/panel-session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "No se pudo abrir la sesion del panel.");
  }
}

export async function signInPanelWithGoogle(redirectPath: string) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase || typeof window === "undefined") {
    throw new Error("El inicio con Google no esta disponible en este momento.");
  }

  const redirectTo = new URL(redirectPath, window.location.origin);
  const next = new URLSearchParams(window.location.search).get("next");

  if (next) {
    redirectTo.searchParams.set("next", safeInternalPanelPath(next));
  }

  sessionStorage.setItem(PANEL_OAUTH_REDIRECT_KEY, `${redirectTo.pathname}${redirectTo.search}`);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) throw error;

  if (data?.url) {
    window.location.assign(data.url);
  }
}

export function getPendingPanelOAuthRedirect() {
  if (typeof window === "undefined") return "";
  const redirectPath = sessionStorage.getItem(PANEL_OAUTH_REDIRECT_KEY) || "";
  return safeInternalPanelPath(redirectPath, "");
}

export function clearPendingPanelOAuthRedirect() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PANEL_OAUTH_REDIRECT_KEY);
}

export function hasPanelOAuthReturn() {
  if (typeof window === "undefined") return false;

  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  return (
    url.searchParams.has("code") ||
    url.searchParams.has("error") ||
    hashParams.has("access_token") ||
    hashParams.has("error")
  );
}

export async function completePanelOAuthSession() {
  const supabase = createSupabaseBrowserClient();
  if (!supabase || typeof window === "undefined") return "";

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;

    url.searchParams.delete("code");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);

    const accessToken = data.session?.access_token || "";
    if (accessToken) {
      savePanelToken(accessToken);
      await syncPanelServerSession(accessToken);
      clearPendingPanelOAuthRedirect();
    }
    return accessToken;
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token || "";

  if (accessToken) {
    savePanelToken(accessToken);
    await syncPanelServerSession(accessToken);
    clearPendingPanelOAuthRedirect();
    if (url.hash) {
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
  }

  return accessToken;
}

export async function clearPanelServerSession() {
  await fetch("/api/auth/panel-session", {
    method: "DELETE",
    credentials: "same-origin",
  }).catch(() => {});
}

export function savePanelPin(pin: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PANEL_PIN_KEY);
}

export function clearPanelAuthStorage() {
  if (typeof window === "undefined") return;
  memoryPanelToken = "";
  panelSessionBootstrapped = false;
  panelTokenPromise = null;
  sessionStorage.removeItem(PANEL_TOKEN_KEY);
  sessionStorage.removeItem(PANEL_PIN_KEY);
  sessionStorage.removeItem(PANEL_STORE_KEY);
}

export function getSelectedPanelStoreId() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(PANEL_STORE_KEY) || "";
}

export function saveSelectedPanelStoreId(storeId: string) {
  if (typeof window === "undefined") return;
  if (storeId) sessionStorage.setItem(PANEL_STORE_KEY, storeId);
  else sessionStorage.removeItem(PANEL_STORE_KEY);
}

export function clearBrowserAuthStorage() {
  clearPanelAuthStorage();

  if (typeof window === "undefined") return;

  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keys = Array.from({ length: storage.length }, (_, index) =>
      storage.key(index)
    ).filter(Boolean) as string[];

    for (const key of keys) {
      if (
        key === PANEL_TOKEN_KEY ||
        key === PANEL_PIN_KEY ||
        key.startsWith("sb-") ||
        key.includes("supabase")
      ) {
        storage.removeItem(key);
      }
    }
  }
}

export function shouldShowPanelInitialAccessGate() {
  return !panelSessionBootstrapped && !hasSavedPanelAuth();
}

export async function getPanelAccessToken() {
  const savedToken = getSavedPanelToken();

  if (savedToken && isTokenStillUsable(savedToken)) {
    panelSessionBootstrapped = true;
    return savedToken;
  }

  if (panelTokenPromise) return panelTokenPromise;

  panelTokenPromise = (async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: null };
      const accessToken = data?.session?.access_token || "";

      if (accessToken) savePanelToken(accessToken);
      if (!accessToken && typeof window !== "undefined") {
        memoryPanelToken = "";
        sessionStorage.removeItem(PANEL_TOKEN_KEY);
      }

      return accessToken;
    } catch {
      return getSavedPanelToken();
    } finally {
      panelSessionBootstrapped = true;
      panelTokenPromise = null;
    }
  })();

  return panelTokenPromise;
}

export async function primePanelAuthSession() {
  await getPanelAccessToken();
}

export async function getPanelAuthHeaders(
  pin = getSavedPanelPin()
): Promise<Record<string, string>> {
  void pin;

  const selectedStoreId = getSelectedPanelStoreId();
  return selectedStoreId ? { "X-Panel-Store-Id": selectedStoreId } : {};
}
