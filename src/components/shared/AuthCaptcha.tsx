"use client";

import { useEffect, useRef, useState } from "react";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const TURNSTILE_SCRIPT_ID = "turnstile-api-script";

type TurnstileOptions = {
  sitekey: string;
  action?: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string;
      remove?: (widgetId: string) => void;
      reset?: (widgetId: string) => void;
    };
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as
      | HTMLScriptElement
      | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("turnstile_error")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile_error"));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export function AuthCaptcha({
  action = "signup",
  onToken,
}: {
  action?: string;
  onToken: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string>("");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!turnstileSiteKey) return;

    let isMounted = true;

    loadTurnstileScript()
      .then(() => {
        if (!isMounted || !containerRef.current || !window.turnstile || widgetIdRef.current) {
          return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: turnstileSiteKey,
          action,
          callback: (token) => {
            setLoadError(false);
            onToken(token);
          },
          "expired-callback": () => onToken(""),
          "error-callback": () => {
            onToken("");
            setLoadError(true);
          },
        });
      })
      .catch(() => {
        if (!isMounted) return;
        onToken("");
        setLoadError(true);
      });

    return () => {
      isMounted = false;
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = "";
    };
  }, [action, onToken]);

  if (!turnstileSiteKey) return null;

  return (
    <div className="mt-4">
      <div ref={containerRef} className="min-h-[65px]" />
      {loadError ? (
        <p className="mt-2 rounded-2xl bg-amber-50 p-3 text-xs font-black text-amber-800 ring-1 ring-amber-100">
          No se pudo cargar la verificacion de seguridad. Revisa tu conexion e intenta de nuevo.
        </p>
      ) : null}
    </div>
  );
}
