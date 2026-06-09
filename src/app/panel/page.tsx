"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function getSavedPanelToken() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("vendeplus_panel_token") || "";
}

export default function PanelPage() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function redirectToPanelEntry() {
      const supabase = createSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: null };
      const hasSession = Boolean(data?.session?.access_token || getSavedPanelToken());

      if (!isMounted) return;
      router.replace(hasSession ? "/panel/estadisticas" : "/panel/login");
    }

    redirectToPanelEntry();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F8F3E8] px-4 text-[#25262B]">
      <section className="rounded-[32px] bg-white p-6 text-center shadow-xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <Loader2 size={24} className="mx-auto animate-spin text-[#2E3A79]" />
        <p className="mt-3 text-sm font-black text-[#746f69]">
          Abriendo panel...
        </p>
      </section>
    </main>
  );
}
