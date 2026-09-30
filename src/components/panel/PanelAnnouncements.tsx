"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Gift, Megaphone, Sparkles, TriangleAlert, X } from "lucide-react";
import { getPanelAuthHeaders, getSavedPanelToken } from "@/lib/panel/client-auth";
import stylesUI from "./PanelNotifications.module.css";

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
  try { localStorage.setItem(key, JSON.stringify([...ids].slice(-100))); } catch { /* Storage may be unavailable. */ }
}

export function PanelAnnouncements({ isOpen, onToggle, onClose }: { isOpen: boolean; onToggle: () => void; onClose: () => void }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!getSavedPanelToken()) throw new Error("session");
        const response = await fetch("/api/panel/announcements", {
          headers: await getPanelAuthHeaders(),
        });
        if (!response.ok) throw new Error("announcements");
        const data = await response.json();
        if (active) {
          setSeenIds(readStoredIds(SEEN_KEY));
          setAnnouncements(Array.isArray(data.announcements) ? data.announcements : []);
          setFailed(false);
        }
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [retry]);

  const pendingCount = useMemo(
    () => announcements.filter((item) => !seenIds.has(item.id)).length,
    [announcements, seenIds]
  );

  function openNotifications() {
    const nextSeen = new Set(seenIds);
    announcements.forEach((item) => nextSeen.add(item.id));
    saveStoredIds(SEEN_KEY, nextSeen);
    setSeenIds(nextSeen);
    onToggle();
  }

  return (
    <div>
      {isOpen ? (
        <section id="panel-news" aria-label="Novedades de Somos" className={stylesUI.popover}>
          <header className="flex items-center justify-between bg-[#25262B] px-4 py-3 text-white">
            <div className="flex items-center gap-2"><Megaphone size={18} className="text-[#FFB547]" /><p className="text-sm font-black">Novedades de Somos</p></div>
            <button type="button" onClick={onClose} aria-label="Cerrar novedades" className={stylesUI.close}><X size={18} /></button>
          </header>
          <div className="max-h-[min(60vh,450px)] space-y-3 overflow-y-auto p-3">
            {loading ? <p role="status" className={stylesUI.message}>Cargando novedades...</p> : failed ? <div role="alert" className={stylesUI.message}>No pudimos cargar las novedades.<button type="button" className={stylesUI.action} onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Reintentar</button></div> : !announcements.length ? (
              <div className="py-8 text-center text-[#746f69]">
                <Megaphone size={28} className="mx-auto opacity-40" />
                <p className="mt-3 text-sm font-black">Sin mensajes</p>
                <p className="mt-1 text-xs font-bold">Aquí aparecerán las novedades de Somos.</p>
              </div>
            ) : null}
            {announcements.map((announcement) => {
              const visual = styles[announcement.kind] || styles.news;
              const Icon = visual.icon;
              return (
                <article key={announcement.id} className={`rounded-lg border p-3 ${visual.className}`}>
                  <div className="flex items-start gap-2">
                    <Icon size={18} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1"><p className="text-sm font-black">{announcement.title}</p><p className="mt-1 text-xs font-bold leading-relaxed opacity-80">{announcement.message}</p></div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {announcement.action_label && announcement.action_url ? <Link href={announcement.action_url} onClick={onClose} className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-black shadow-sm">{announcement.action_label}</Link> : null}
                    <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-black opacity-70 hover:bg-white/60 hover:opacity-100"><Check size={14} /> Entendido</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <button type="button" onClick={() => isOpen ? onClose() : openNotifications()} aria-label="Novedades de Somos" title="Novedades de Somos" aria-expanded={isOpen} aria-controls="panel-news" className={stylesUI.trigger}>
        <Megaphone size={20} />
        {!isOpen && pendingCount > 0 ? <span className={stylesUI.badge}>{pendingCount > 99 ? "99+" : pendingCount}</span> : null}
      </button>
    </div>
  );
}
