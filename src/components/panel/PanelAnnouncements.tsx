"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Check, Gift, Megaphone, Sparkles, TriangleAlert, X } from "lucide-react";
import { getPanelAuthHeaders, getSavedPanelToken } from "@/lib/panel/client-auth";

type Announcement = {
  id: string;
  title: string;
  message: string;
  kind: "news" | "challenge" | "feature" | "important";
  action_label?: string | null;
  action_url?: string | null;
};

const SEEN_KEY = "somos_seen_announcements";

const styles = {
  news: { icon: Megaphone, className: "border-[#2E3A79]/15 bg-[#EEF0FF] text-[#2E3A79]" },
  challenge: { icon: Gift, className: "border-[#FFB547]/40 bg-[#FFF4D9] text-[#62420C]" },
  feature: { icon: Sparkles, className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  important: { icon: TriangleAlert, className: "border-red-200 bg-red-50 text-red-800" },
};

function readStoredIds(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set<string>(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function saveStoredIds(key: string, ids: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...ids].slice(-100)));
}

export function PanelAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);

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
        if (active) {
          setSeenIds(readStoredIds(SEEN_KEY));
          setAnnouncements(Array.isArray(data.announcements) ? data.announcements : []);
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

  const pendingCount = useMemo(
    () => announcements.filter((item) => !seenIds.has(item.id)).length,
    [announcements, seenIds]
  );

  function openNotifications() {
    const nextSeen = new Set(seenIds);
    announcements.forEach((item) => nextSeen.add(item.id));
    saveStoredIds(SEEN_KEY, nextSeen);
    setSeenIds(nextSeen);
    setIsOpen(true);
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 lg:bottom-6" aria-label="Novedades de Somos">
      {isOpen ? (
        <section className="absolute bottom-16 right-0 max-h-[min(70vh,520px)] w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-[26px] bg-white shadow-2xl ring-1 ring-[#25262B]/10">
          <header className="flex items-center justify-between bg-[#25262B] px-4 py-3 text-white">
            <div className="flex items-center gap-2"><Bell size={18} className="text-[#FFB547]" /><p className="text-sm font-black">Novedades de Somos</p></div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Cerrar notificaciones" className="rounded-full p-1 hover:bg-white/10"><X size={18} /></button>
          </header>
          <div className="max-h-[min(60vh,450px)] space-y-3 overflow-y-auto p-3">
            {!announcements.length ? (
              <div className="py-8 text-center text-[#746f69]">
                <Bell size={28} className="mx-auto opacity-40" />
                <p className="mt-3 text-sm font-black">Sin mensajes</p>
                <p className="mt-1 text-xs font-bold">Aquí aparecerán las novedades de Somos.</p>
              </div>
            ) : null}
            {announcements.map((announcement) => {
              const visual = styles[announcement.kind] || styles.news;
              const Icon = visual.icon;
              return (
                <article key={announcement.id} className={`rounded-2xl border p-3 ${visual.className}`}>
                  <div className="flex items-start gap-2">
                    <Icon size={18} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1"><p className="text-sm font-black">{announcement.title}</p><p className="mt-1 text-xs font-bold leading-relaxed opacity-80">{announcement.message}</p></div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {announcement.action_label && announcement.action_url ? <Link href={announcement.action_url} onClick={() => setIsOpen(false)} className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-black shadow-sm">{announcement.action_label}</Link> : null}
                    <button type="button" onClick={() => setIsOpen(false)} className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-black opacity-70 hover:bg-white/60 hover:opacity-100"><Check size={14} /> Entendido</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <button type="button" onClick={() => isOpen ? setIsOpen(false) : openNotifications()} aria-label={pendingCount ? `${pendingCount} notificaciones nuevas` : "Abrir notificaciones"} className="relative grid h-14 w-14 place-items-center rounded-full bg-[#2E3A79] text-white shadow-xl shadow-[#2E3A79]/30 transition hover:scale-105">
        <Bell size={23} />
        {!isOpen && pendingCount > 0 ? <span className="absolute -right-1 -top-1 grid min-h-6 min-w-6 place-items-center rounded-full bg-red-600 px-1.5 text-xs font-black text-white ring-2 ring-white">{pendingCount > 99 ? "99+" : pendingCount}</span> : null}
      </button>
    </div>
  );
}
