"use client";

import { MapPin } from "lucide-react";
import { usePanelStore } from "@/components/panel/PanelStoreContext";

export function PanelStoreSwitcher({ compact = false }: { compact?: boolean }) {
  const { stores, activeStoreId, selectStore, loading } = usePanelStore();

  if (loading || stores.length < 2) return null;

  return (
    <label className={compact ? "block" : "flex min-w-0 items-center gap-3"}>
      <span className={compact ? "mb-2 flex items-center gap-2 text-xs font-black text-white/70" : "sr-only"}>
        <MapPin size={14} /> Sede activa
      </span>
      <select
        value={activeStoreId}
        onChange={(event) => selectStore(event.target.value)}
        aria-label="Sede activa"
        className="w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-black text-[#25262B] outline-none ring-[#FFB547] focus:ring-2"
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.branch_name || store.name}
          </option>
        ))}
      </select>
    </label>
  );
}
