"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { buyerAuthPlugin, completeBuyerSignIn } from "@/lib/buyer/client";

export function BuyerAuthResume() {
  const router = useRouter();
  useEffect(() => {
    let busy = false;
    const resume = async () => {
      if (busy) return;
      const plugin = buyerAuthPlugin();
      if (!plugin) return;
      busy = true;
      try {
        const { url } = await plugin.consume();
        if (url) {
          await completeBuyerSignIn(url);
          router.replace("/mi-cuenta");
        }
      } catch { router.replace("/mi-cuenta?acceso=error"); }
      finally { busy = false; }
    };
    void resume();
    window.addEventListener("focus", resume);
    window.addEventListener("somos:resume", resume);
    return () => { window.removeEventListener("focus", resume); window.removeEventListener("somos:resume", resume); };
  }, [router]);
  return null;
}
