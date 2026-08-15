"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Gift, Megaphone, Sparkles, TriangleAlert, X } from "lucide-react";
import { getPanelAuthHeaders, getSavedPanelToken } from "@/lib/panel/client-auth";

type Announcement = {
  id: string;
  title: string;
  message: string;
  kind: "news" | "challenge" | "feature" | "important";
  action_label?: string | null;
  action_url?: string | null;
};

const styles = {
  news: { icon: Megaphone, className: "border-[#2E3A79]/15 bg-[#EEF0FF] text-[#2E3A79]" },
  challenge: { icon: Gift, className: "border-[#FFB547]/40 bg-[#FFF4D9] text-[#62420C]" },
  feature: { icon: Sparkles, className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  important: { icon: TriangleAlert, className: "border-red-200 bg-red-50 text-red-800" },
};

export function PanelAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!getSavedPanelToken()) return;
      try {
        const response = await fetch("/api/panel/announcements", {
          headers: await getPanelAuthHeaders(),
        });
        if (!response.ok) return;
        const data = await response.json();
        const dismissed = new Set<string>(
          JSON.parse(localStorage.getItem("somos_dismissed_announcements") || "[]")
        );
        if (active) {
          setAnnouncements(
            (Array.isArray(data.announcements) ? data.announcements : []).filter(
              (item: Announcement) => !dismissed.has(item.id)
            )
          );
        }
      } catch {
        // Los avisos no deben interrumpir la operación del panel.
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  function dismiss(id: string) {
    const dismissed = new Set<string>(
      JSON.parse(localStorage.getItem("somos_dismissed_announcements") || "[]")
    );
    dismissed.add(id);
    localStorage.setItem("somos_dismissed_announcements", JSON.stringify([...dismissed].slice(-100)));
    setAnnouncements((current) => current.filter((item) => item.id !== id));
  }

  if (!announcements.length) return null;

  return (
    <div className="mb-5 space-y-2" aria-label="Novedades de Somos">
      {announcements.map((announcement) => {
        const visual = styles[announcement.kind] || styles.news;
        const Icon = visual.icon || Bell;
        return (
          <aside key={announcement.id} className={`flex items-start gap-3 rounded-2xl border p-3 shadow-sm ${visual.className}`}>
            <Icon size={19} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">{announcement.title}</p>
              <p className="mt-0.5 text-xs font-bold leading-relaxed opacity-80 sm:text-sm">{announcement.message}</p>
              {announcement.action_label && announcement.action_url ? (
                <Link href={announcement.action_url} className="mt-2 inline-flex rounded-full bg-white/80 px-3 py-1.5 text-xs font-black shadow-sm">
                  {announcement.action_label}
                </Link>
              ) : null}
            </div>
            <button type="button" onClick={() => dismiss(announcement.id)} aria-label="Cerrar aviso" className="shrink-0 rounded-full p-1 opacity-60 transition hover:bg-white/60 hover:opacity-100">
              <X size={17} />
            </button>
          </aside>
        );
      })}
    </div>
  );
}
