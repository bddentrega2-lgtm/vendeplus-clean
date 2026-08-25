"use client";

import { Download, Smartphone, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallPromptWindow = Window & {
  __somosInstallPrompt?: BeforeInstallPromptEvent;
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

export function PwaInstallButton({
  compact = false,
  tile = false,
  subtle = false,
  label = "Instalar Somos",
}: {
  compact?: boolean;
  tile?: boolean;
  subtle?: boolean;
  label?: string;
}) {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const isIos = useMemo(() => isIosDevice(), []);

  useEffect(() => {
    setInstalled(isStandalone());
    const promptWindow = window as InstallPromptWindow;
    setInstallPrompt(promptWindow.__somosInstallPrompt || null);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      const prompt = event as BeforeInstallPromptEvent;
      promptWindow.__somosInstallPrompt = prompt;
      setInstallPrompt(prompt);
    }

    function handlePromptReady() {
      setInstallPrompt(promptWindow.__somosInstallPrompt || null);
    }

    function handleInstalled() {
      setInstalled(true);
      setInstalling(false);
      setInstallPrompt(null);
      setShowHelp(false);
    }

    function refreshInstalledState() {
      if (isStandalone()) handleInstalled();
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("somosinstallpromptready", handlePromptReady);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("pageshow", refreshInstalledState);
    document.addEventListener("visibilitychange", refreshInstalledState);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("somosinstallpromptready", handlePromptReady);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("pageshow", refreshInstalledState);
      document.removeEventListener("visibilitychange", refreshInstalledState);
    };
  }, []);

  async function installApp() {
    if (installing) return;

    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    setInstalling(true);
    setShowHelp(false);

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setInstalled(true);
      } else {
        setShowHelp(true);
      }
    } catch {
      setShowHelp(true);
    } finally {
      delete (window as InstallPromptWindow).__somosInstallPrompt;
      setInstallPrompt(null);
      setInstalling(false);
    }
  }

  if (installed) {
    if (tile) {
      return (
        <a
          href="/"
          aria-label="Ir al inicio de Somos"
          className="grid h-14 place-items-center rounded-xl bg-[#FFF8F0] ring-1 ring-[#25262B]/[0.06] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#2E3A79]/10 sm:rounded-2xl"
        >
          <Image
            src="/brand/new-somos-preview/somos-isotipo-preview.png"
            alt=""
            width={28}
            height={28}
          />
        </a>
      );
    }

    return compact || subtle ? null : (
      <div className="rounded-3xl bg-green-50 px-4 py-3 text-sm font-black text-green-700">
        App instalada en este dispositivo
      </div>
    );
  }

  return (
    <div className={tile ? "relative h-14" : compact || subtle ? "space-y-2" : "rounded-3xl bg-white/10 p-3"}>
      <button
        type="button"
        onClick={installApp}
        disabled={installing}
        className={[
          "inline-flex w-full items-center justify-center font-[inherit] font-black disabled:cursor-wait disabled:opacity-60",
          tile
            ? "h-14 rounded-xl bg-[#FFF8F0] px-1 text-center text-[10px] leading-tight text-[#2E3A79] ring-1 ring-[#25262B]/[0.06] sm:rounded-2xl sm:text-xs"
            : subtle
            ? "gap-1.5 rounded-full bg-[#FFF0E8] px-2.5 py-2 text-[11px] text-[#C44D1B] ring-1 ring-[#FF7133]/15"
            : compact
            ? "gap-2 rounded-2xl bg-[#FFB547] px-4 py-3 text-sm text-[#25262B]"
            : "gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-[#2E3A79]",
        ].join(" ")}
      >
        {tile ? null : installPrompt ? <Download size={17} /> : <Smartphone size={17} />}
        <span>{installing ? "Abriendo..." : label}</span>
      </button>

      {showHelp ? (
        <div
          role="dialog"
          aria-label="Ayuda para instalar Somos"
          className={[
            "relative mt-2 rounded-2xl p-3 text-xs font-bold leading-relaxed",
            tile
              ? "absolute right-0 top-full z-30 w-[min(280px,calc(100vw-3rem))] bg-white text-[#746f69] shadow-xl ring-1 ring-[#25262B]/10"
            : compact || subtle
              ? "fixed inset-x-4 top-20 z-[80] mx-auto max-w-sm bg-white text-[#746f69] shadow-2xl ring-1 ring-[#25262B]/10"
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
              inicio. El acceso abrira Somos como app.
            </p>
          ) : (
            <p className="pr-8">
              Si no aparece la ventana, abre el menu del navegador y toca
              Instalar app o Agregar a pantalla de inicio.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
