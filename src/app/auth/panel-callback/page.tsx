"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  completePanelOAuthSession,
  getPendingPanelOAuthRedirect,
  waitForPanelContext,
} from "@/lib/panel/client-auth";
import { safeInternalPanelPath } from "@/lib/panel/safe-redirect";

export default function PanelOAuthCallbackPage() {
  const [message, setMessage] = useState("Completando inicio con Google...");

  useEffect(() => {
    let isMounted = true;

    async function completeAndRedirect() {
      try {
        const accessToken = await completePanelOAuthSession();
        if (!accessToken) throw new Error("No se pudo completar la sesion con Google.");

        const url = new URL(window.location.href);
        const nextPath = safeInternalPanelPath(
          url.searchParams.get("next") || getPendingPanelOAuthRedirect() || "/panel",
          "/panel"
        );

        if (nextPath.startsWith("/panel") && !(await waitForPanelContext())) {
          throw new Error("No se pudo abrir la sesion del panel.");
        }

        window.location.replace(nextPath);
      } catch (error: any) {
        if (!isMounted) return;
        setMessage(error.message || "No se pudo completar el inicio con Google.");
        window.setTimeout(() => {
          window.location.replace("/panel/login");
        }, 1200);
      }
    }

    void completeAndRedirect();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F8F3E8] px-4 text-[#25262B]">
      <section className="w-full max-w-sm rounded-[32px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.10] ring-1 ring-[#25262B]/[0.06]">
        <Loader2 className="mx-auto animate-spin text-[#2E3A79]" size={30} />
        <h1 className="mt-4 text-xl font-black">Entrando al panel</h1>
        <p className="mt-2 text-sm font-bold text-[#746f69]">{message}</p>
      </section>
    </main>
  );
}
