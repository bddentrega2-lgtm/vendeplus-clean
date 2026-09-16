"use client";

import { useEffect } from "react";

const AUTH_COMPAT_VERSION = "2026-09-16-panel-session-v3";
const AUTH_COMPAT_KEY = "somos_auth_compat_version";

function isPrivateAppPath(pathname: string) {
  return (
    pathname.startsWith("/panel") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/transporte/panel")
  );
}

function clearLegacyAuthStorageOnce() {
  if (!isPrivateAppPath(window.location.pathname)) return;
  if (window.localStorage.getItem(AUTH_COMPAT_KEY) === AUTH_COMPAT_VERSION) return;

  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keys = Array.from({ length: storage.length }, (_, index) =>
      storage.key(index)
    ).filter(Boolean) as string[];

    for (const key of keys) {
      if (
        key === "vendeplus_panel_token" ||
        key === "vendeplus_panel_pin" ||
        key === "vendeplus_panel_oauth_redirect" ||
        key.startsWith("sb-") ||
        key.includes("supabase")
      ) {
        storage.removeItem(key);
      }
    }
  }

  window.localStorage.setItem(AUTH_COMPAT_KEY, AUTH_COMPAT_VERSION);
}

export function RegisterServiceWorker() {
  useEffect(() => {
    try {
      clearLegacyAuthStorageOnce();
    } catch {
      // Auth cleanup should never block loading.
    }

    if (!("serviceWorker" in navigator)) return;

    function register() {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          void registration.update();

          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }

          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                worker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch(() => {
          // Installation should never block browsing, checkout, or admin access.
        });
    }

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => {
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
