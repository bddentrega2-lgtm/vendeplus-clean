"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const PANEL_TOKEN_KEY = "vendeplus_panel_token";
const PANEL_PIN_KEY = "vendeplus_panel_pin";

export function getSavedPanelToken() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(PANEL_TOKEN_KEY) || "";
}

export function getSavedPanelPin() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(PANEL_PIN_KEY) || "";
}

export function hasSavedPanelAuth() {
  return Boolean(getSavedPanelToken() || getSavedPanelPin());
}

export function savePanelToken(accessToken: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PANEL_TOKEN_KEY, accessToken);
  sessionStorage.removeItem(PANEL_PIN_KEY);
}

export function savePanelPin(pin: string) {
  if (typeof window === "undefined" || !pin) return;
  sessionStorage.setItem(PANEL_PIN_KEY, pin);
}

export function clearPanelAuthStorage() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PANEL_TOKEN_KEY);
  sessionStorage.removeItem(PANEL_PIN_KEY);
}

export async function getPanelAuthHeaders(
  pin = getSavedPanelPin()
): Promise<Record<string, string>> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = supabase ? await supabase.auth.getSession() : { data: null };
    const accessToken = data?.session?.access_token;

    if (accessToken) {
      savePanelToken(accessToken);
      return { Authorization: `Bearer ${accessToken}` };
    }
  } catch {
    // Keep the current PIN fallback if the browser session cannot be read.
  }

  const savedToken = getSavedPanelToken();

  if (savedToken) {
    return { Authorization: `Bearer ${savedToken}` };
  }

  return { "x-panel-pin": pin };
}
