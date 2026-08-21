"use client";

import { Store } from "lucide-react";
import { usePanelAuth } from "@/components/panel/PanelAuthProvider";

export function PanelStoreSelector() {
  const { stores, selectedStoreId, selectStore } = usePanelAuth();

  if (stores.length <= 1) return null;

  function handleChange(storeId: string) {
    selectStore(storeId);
  }

  return (
    <label className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/20">
      <Store size={18} className="shrink-0 text-[#FFB547]" aria-hidden="true" />
      <span className="sr-only">Sede activa</span>
      <select
        value={selectedStoreId}
        onChange={(event) => handleChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm font-black text-white outline-none [&>option]:text-[#25262B]"
        aria-label="Sede activa"
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
    </label>
  );
}
