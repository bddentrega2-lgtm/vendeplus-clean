"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const PANEL_TOKEN_KEY = "vendeplus_panel_token";
const PANEL_PIN_KEY = "vendeplus_panel_pin";

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

  const accessToken = await getPanelAccessToken();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
