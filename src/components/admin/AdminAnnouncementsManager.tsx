"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Power, RefreshCcw, Send } from "lucide-react";
import { getPanelAuthHeaders, getSavedPanelToken } from "@/lib/panel/client-auth";

type Announcement = {
  id: string;
  title: string;
  message: string;
  kind: string;
  action_label?: string | null;
  action_url?: string | null;
  starts_at: string;
  ends_at?: string | null;
  is_active: boolean;
};

const kindLabels: Record<string, string> = {
  news: "Novedad",
  challenge: "Reto del mes",
  feature: "Nueva función",
  important: "Importante",
};

async function adminRequest(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getPanelAuthHeaders("")),
      ...(options?.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No se pudo completar la acción.");
  return data;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha final";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminAnnouncementsManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [form, setForm] = useState({
    title: "",
    message: "",
    kind: "news",
    actionLabel: "",
    actionUrl: "",
    endsAt: "",
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminRequest("/api/admin/announcements");
      setAnnouncements(data.announcements || []);
    } catch (error: any) {
      setFeedback(error.message || "No se pudieron cargar las notificaciones.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getSavedPanelToken()) void load();
    else setIsLoading(false);
  }, [load]);

  async function publish(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setFeedback("");
    try {
      const data = await adminRequest("/api/admin/announcements", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setFeedback(data.message || "Notificación publicada.");
      setForm({ title: "", message: "", kind: "news", actionLabel: "", actionUrl: "", endsAt: "" });
      await load();
    } catch (error: any) {
      setFeedback(error.message || "No se pudo publicar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggle(item: Announcement) {
    setFeedback("");
    try {
      await adminRequest("/api/admin/announcements", {
        method: "PATCH",
        body: JSON.stringify({ id: item.id, isActive: !item.is_active }),
      });
      await load();
    } catch (error: any) {
      setFeedback(error.message || "No se pudo actualizar.");
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <form onSubmit={publish} className="rounded-[30px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#FFB547] text-[#25262B]"><Megaphone size={20} /></div>
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#746f69]">Nuevo aviso</p><h2 className="text-xl font-black">Publicar en el panel</h2></div>
        </div>

        <label className="mt-5 block text-sm font-black">Tipo</label>
        <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })} className="mt-2 w-full rounded-2xl border border-[#25262B]/10 bg-[#F8F3E8] px-4 py-3 text-sm font-bold outline-none">
          {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>

        <label className="mt-4 block text-sm font-black">Título</label>
        <input required maxLength={100} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ej: Nuevo reto de agosto" className="mt-2 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none" />

        <label className="mt-4 block text-sm font-black">Mensaje</label>
        <textarea required maxLength={500} rows={4} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Explica la novedad en pocas palabras." className="mt-2 w-full resize-none rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none" />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><label className="block text-sm font-black">Texto del botón (opcional)</label><input maxLength={40} value={form.actionLabel} onChange={(event) => setForm({ ...form, actionLabel: event.target.value })} placeholder="Ver reto" className="mt-2 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none" /></div>
          <div><label className="block text-sm font-black">Enlace (opcional)</label><input maxLength={500} value={form.actionUrl} onChange={(event) => setForm({ ...form, actionUrl: event.target.value })} placeholder="/panel/logros" className="mt-2 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none" /></div>
        </div>

        <label className="mt-4 block text-sm font-black">Finaliza (opcional)</label>
        <input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} className="mt-2 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none" />

        {feedback ? <p className="mt-4 rounded-2xl bg-[#F8F3E8] p-3 text-sm font-black text-[#2E3A79]">{feedback}</p> : null}
        <button disabled={isSaving} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
          {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} Publicar ahora
        </button>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between rounded-[26px] bg-white p-4 shadow-lg ring-1 ring-[#25262B]/[0.06]">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#746f69]">Historial</p><h2 className="text-xl font-black">{announcements.length} notificaciones</h2></div>
          <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-full bg-[#F8F3E8] px-4 py-2 text-xs font-black"><RefreshCcw size={14} /> Actualizar</button>
        </div>
        {isLoading ? <div className="rounded-[26px] bg-white p-8 text-center"><Loader2 className="mx-auto animate-spin" /></div> : null}
        {!isLoading && !announcements.length ? <p className="rounded-[26px] bg-white p-8 text-center text-sm font-black text-[#746f69]">Todavía no hay notificaciones.</p> : null}
        {announcements.map((item) => (
          <article key={item.id} className="rounded-[26px] bg-white p-4 shadow-lg ring-1 ring-[#25262B]/[0.06]">
            <div className="flex items-start justify-between gap-3">
              <div><span className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black text-[#2E3A79]">{kindLabels[item.kind] || "Novedad"}</span><h3 className="mt-3 text-lg font-black">{item.title}</h3><p className="mt-1 text-sm font-bold leading-relaxed text-[#746f69]">{item.message}</p></div>
              <button type="button" onClick={() => toggle(item)} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${item.is_active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}><Power size={14} /> {item.is_active ? "Activo" : "Pausado"}</button>
            </div>
            <p className="mt-3 text-xs font-bold text-[#746f69]">Inicio: {formatDate(item.starts_at)} · Fin: {formatDate(item.ends_at)}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
