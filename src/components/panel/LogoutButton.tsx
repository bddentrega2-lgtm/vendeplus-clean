"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { clearPanelAuthStorage } from "@/lib/panel/client-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase?.auth.signOut();
    } catch {
      // Si Supabase no responde, igual limpiamos sesión local.
    }

    clearPanelAuthStorage();

    router.push("/panel/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25262B] px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
    >
      <LogOut size={16} />
      Cerrar sesión
    </button>
  );
}
