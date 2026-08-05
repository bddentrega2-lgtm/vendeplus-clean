"use client";

import { useEffect, useState } from "react";
import type { Store, StoreOpenState } from "@/types";
import { getStoreOpenState } from "@/lib/business-hours";

function calculateOpenState(store: Store) {
  return getStoreOpenState({
    manualOpenStatus: store.manualOpenStatus,
    manualOpenNote: store.manualOpenNote,
    businessHours: store.businessHours,
    openingHoursText: store.openingHours,
  });
}

export function useLiveStoreOpenState(store: Store): StoreOpenState {
  const [openState, setOpenState] = useState<StoreOpenState>(
    store.openState || calculateOpenState(store)
  );

  useEffect(() => {
    const refresh = () => setOpenState(calculateOpenState(store));
    refresh();

    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [store]);

  return openState;
}
