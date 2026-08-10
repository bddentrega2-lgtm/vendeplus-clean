"use client";

import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Gift, Loader2, LockKeyhole, Sparkles, Trophy } from "lucide-react";
import { getPanelAuthHeaders, getSavedPanelPin } from "@/lib/panel/client-auth";
import { buildClientPublicUrl } from "@/lib/public-url";

type Achievement = {
  key: string;
  title: string;
  description: string;
  reward: string;
  unlocked: boolean;
  source: "earned" | "inherited" | "admin" | null;
  progress: { current: number; target: number; detail?: string };
};

type MonthlyChallenge = Achievement & {
  startsAt: string;
  endsAt: string;
  rewardStartsAt?: string | null;
  rewardEndsAt?: string | null;
};

export function AchievementsManager() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [monthlyChallenges, setMonthlyChallenges] = useState<MonthlyChallenge[]>([]);
  const [storeId, setStoreId] = useState("");
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedStore = stores.find((store) => store.id === storeId);

  async function copyReferralLink() {
    if (!selectedStore?.slug) return;
    await navigator.clipboard.writeText(buildClientPublicUrl(`/registro?ref=${selectedStore.slug}`));
    setCopied(true);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const headers = await getPanelAuthHeaders(getSavedPanelPin());
        const settingsResponse = await fetch("/api/panel/settings", { headers });
        const settings = await settingsResponse.json();
        if (!settingsResponse.ok) throw new Error(settings.error || "No se pudieron cargar los comercios.");
        const availableStores = Array.isArray(settings.stores) ? settings.stores : [];
        const selectedId = storeId || availableStores[0]?.id || "";
        if (!selectedId) throw new Error("No hay un comercio disponible.");
        const response = await fetch(`/api/panel/achievements?storeId=${encodeURIComponent(selectedId)}`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudieron cargar los logros.");
        if (active) {
          setStores(availableStores);
          setStoreId(selectedId);
          setAchievements(data.achievements || []);
          setMonthlyChallenges(data.monthlyChallenges || []);
        }
      } catch (nextError: any) {
        if (active) setError(nextError.message || "No se pudieron cargar los logros.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [storeId]);

  if (loading) return <div className="grid min-h-48 place-items-center"><Loader2 className="animate-spin text-[#2E3A79]" /></div>;
  if (error) return <p className="rounded-3xl bg-red-50 p-5 font-bold text-red-700">{error}</p>;

  return (
    <div className="space-y-5">
      <section className="rounded-[32px] bg-gradient-to-br from-[#2E3A79] to-[#4656a4] p-6 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#FFB547]">Logros Somos</p><h2 className="mt-2 text-3xl font-black">Crece y desbloquea beneficios</h2><p className="mt-2 max-w-2xl text-sm font-semibold text-white/75">Cada logro permanente abre una función para siempre.</p></div>
          {stores.length > 1 ? <select value={storeId} onChange={(event) => { setLoading(true); setStoreId(event.target.value); }} className="rounded-2xl bg-white px-4 py-3 font-black text-[#25262B]">{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select> : <Trophy size={48} className="text-[#FFB547]" />}
        </div>
      </section>

      <section className="overflow-hidden rounded-[26px] bg-gradient-to-br from-[#FFF0C9] via-white to-[#E9EEFF] p-4 shadow-lg shadow-[#2E3A79]/[0.07] ring-1 ring-[#FFB547]/40">
        <div className="flex items-start justify-between gap-3"><div><p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#8A5700]"><CalendarDays size={14} /> Retos de agosto</p><h3 className="mt-1 text-2xl font-black">Recompensas por tiempo limitado</h3><p className="mt-1 text-xs font-semibold text-[#746f69]">Disponibles hasta el 31 de agosto.</p></div><Sparkles className="shrink-0 text-[#FFB547]" size={30} /></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {monthlyChallenges.map((challenge) => {
            const percent = challenge.unlocked ? 100 : Math.min(100, Math.round((challenge.progress.current / challenge.progress.target) * 100));
            return <article key={challenge.key} className="rounded-[22px] bg-white p-4 shadow-md ring-1 ring-[#25262B]/[0.06]">
              <div className="flex items-start justify-between gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${challenge.unlocked ? "bg-green-100 text-green-700" : "bg-[#2E3A79] text-[#FFB547]"}`}>{challenge.unlocked ? <CheckCircle2 size={20} /> : <Trophy size={20} />}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${challenge.unlocked ? "bg-green-100 text-green-700" : "bg-[#FFF0C9] text-[#8A5700]"}`}>{challenge.unlocked ? "Ganada" : `${percent}%`}</span></div>
              <h4 className="mt-3 text-lg font-black">{challenge.title}</h4><p className="mt-1 text-xs font-semibold leading-relaxed text-[#746f69]">{challenge.description}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F8F3E8]"><div className="h-full rounded-full bg-gradient-to-r from-[#FFB547] to-[#F28C28]" style={{ width: `${percent}%` }} /></div>
              <p className="mt-1.5 text-[11px] font-black text-[#746f69]">{challenge.progress.detail}</p><div className="mt-3 flex items-center gap-2 rounded-xl bg-[#2E3A79]/[0.07] p-2.5 text-xs font-black text-[#2E3A79]"><Gift size={15} />{challenge.reward}</div>
            </article>;
          })}
        </div>
      </section>

      {selectedStore?.slug ? <section className="rounded-[28px] bg-white p-5 shadow-lg ring-1 ring-[#25262B]/[0.06]"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Tu enlace de referido</p><p className="mt-1 break-all text-sm font-bold text-[#2E3A79]">{buildClientPublicUrl(`/registro?ref=${selectedStore.slug}`)}</p></div><button type="button" onClick={copyReferralLink} className="shrink-0 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]">{copied ? "Enlace copiado" : "Copiar enlace"}</button></div></section> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {achievements.map((achievement) => {
          const percent = achievement.unlocked ? 100 : Math.min(100, Math.round((achievement.progress.current / achievement.progress.target) * 100));
          return <article key={achievement.key} className="rounded-[22px] bg-white p-4 shadow-lg shadow-[#2E3A79]/[0.05] ring-1 ring-[#25262B]/[0.06]">
            <div className="flex items-start justify-between gap-2"><span className={`grid h-9 w-9 place-items-center rounded-xl ${achievement.unlocked ? "bg-green-100 text-green-700" : "bg-[#F8F3E8] text-[#2E3A79]"}`}>{achievement.unlocked ? <CheckCircle2 size={19} /> : <LockKeyhole size={19} />}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${achievement.unlocked ? "bg-green-100 text-green-700" : "bg-[#F8F3E8] text-[#746f69]"}`}>{achievement.unlocked ? "Desbloqueado" : `${percent}%`}</span></div>
            <h3 className="mt-3 text-base font-black leading-tight">{achievement.title}</h3><p className="mt-1 text-xs font-semibold leading-relaxed text-[#746f69]">{achievement.description}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F8F3E8]"><div className="h-full rounded-full bg-[#FFB547]" style={{ width: `${percent}%` }} /></div>
            <p className="mt-1.5 text-[11px] font-black text-[#746f69]">{achievement.progress.detail || `${achievement.progress.current} de ${achievement.progress.target}`}</p>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#FFB547]/15 p-2.5 text-xs font-black text-[#2E3A79]"><Gift size={15} />{achievement.reward}</div>
            {achievement.source === "inherited" ? <p className="mt-2 text-[10px] font-bold text-green-700">Beneficio heredado.</p> : null}
          </article>;
        })}
      </section>

    </div>
  );
}
