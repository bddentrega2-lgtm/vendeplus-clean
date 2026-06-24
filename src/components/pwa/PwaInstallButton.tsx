"use client";

import { Download, Smartphone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice() {
  if (typeof window === "undefined") return false;

  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function PwaInstallButton({ compact = false }: { compact?: boolean }) {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const isIos = useMemo(() => isIosDevice(), []);

  useEffect(() => {
    setInstalled(isStandalone());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstalled(true);
      setShowHelp(false);
    }

    setInstallPrompt(null);
  }

  if (installed) {
    return compact ? null : (
      <div className="rounded-3xl bg-green-50 px-4 py-3 text-sm font-black text-green-700">
        App instalada en este dispositivo
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "rounded-3xl bg-white/10 p-3"}>
      <button
        type="button"
        onClick={installApp}
        className={[
          "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black",
          compact
            ? "bg-[#FFB547] text-[#25262B]"
            : "bg-white text-[#2E3A79]",
        ].join(" ")}
      >
        {installPrompt ? <Download size={17} /> : <Smartphone size={17} />}
        Instalar Vende+
      </button>

      {showHelp ? (
        <div
          className={[
            "relative mt-2 rounded-2xl p-3 text-xs font-bold leading-relaxed",
            compact
              ? "bg-white text-[#746f69] ring-1 ring-[#25262B]/10"
              : "bg-white/10 text-white/80",
          ].join(" ")}
        >
          <button
            type="button"
            onClick={() => setShowHelp(false)}
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/10"
            aria-label="Cerrar ayuda de instalacion"
          >
            <X size={14} />
          </button>
          {isIos ? (
            <p className="pr-8">
              En iPhone: toca Compartir en Safari y luego Agregar a pantalla de
              inicio. El acceso abrirá Vende+ como app.
            </p>
          ) : (
            <p className="pr-8">
              Si no aparece la ventana, abre el menu del navegador y elige
              Instalar app o Agregar a pantalla de inicio.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
