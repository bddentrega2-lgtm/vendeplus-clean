"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NewOrderToast, type NewOrderToastData } from "@/components/panel/NewOrderToast";
import { usePanelAuth } from "@/components/panel/PanelAuthProvider";
import { getPanelAccessToken } from "@/lib/panel/client-auth";
import {
  playNewOrderSound,
  unlockOrderNotificationSound,
} from "@/lib/panel/order-notification-sound";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TABLE_ORDERS_CHANGED_EVENT } from "@/lib/table-orders";
import { fetchTableSnapshot } from "@/lib/panel/table-snapshot-client";

type TableOrderSummary = {
  id: string;
  public_code?: string | null;
  customer_name?: string | null;
  table_name_snapshot?: string | null;
};

const TABLE_ORDERS_FALLBACK_POLL_MS = 120_000;
const TABLE_ORDERS_DISCONNECTED_POLL_MS = 15_000;

export function TableOrderNotifier() {
  const { selectedStoreId, selectedStore } = usePanelAuth();
  const [notification, setNotification] = useState<NewOrderToastData | null>(null);
  const [isRealtimeReady, setIsRealtimeReady] = useState(false);
  const knownOrderIdsRef = useRef(new Set<string>());
  const hasBaselineRef = useRef(false);
  const requestInFlightRef = useRef<string | null>(null);
  const queuedRefreshRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const currentStoreRef = useRef(selectedStoreId);
  currentStoreRef.current = selectedStoreId;
  const knownCallsRef = useRef(new Set<string>());
  const hasAccess = selectedStore?.table_orders_access_enabled === true;

  const refresh = useCallback(async (notifyNew: boolean) => {
    if (!selectedStoreId || !hasAccess || !mountedRef.current) return;
    if (requestInFlightRef.current === selectedStoreId) {
      queuedRefreshRef.current = selectedStoreId;
      return;
    }
    requestInFlightRef.current = selectedStoreId;

    try {
      const payload = await fetchTableSnapshot(selectedStoreId, true);
      if (!mountedRef.current || currentStoreRef.current !== selectedStoreId) return;
      const orders: TableOrderSummary[] = Array.isArray(payload.activeOrders)
        ? payload.activeOrders
        : [];
      const newOrder = notifyNew && hasBaselineRef.current
        ? orders.find((order) => order.id && !knownOrderIdsRef.current.has(order.id))
        : null;

      for (const order of orders) {
        if (order.id) knownOrderIdsRef.current.add(order.id);
      }
      const calls: Array<{ table_id: string; requested_at: string }> = payload.waiterCalls || [];
      const newCall = notifyNew && hasBaselineRef.current
        ? calls.find((call) => !knownCallsRef.current.has(`${call.table_id}:${call.requested_at}`)) : null;
      knownCallsRef.current = new Set(calls.map((call) => `${call.table_id}:${call.requested_at}`));
      hasBaselineRef.current = true;

      window.dispatchEvent(new CustomEvent(TABLE_ORDERS_CHANGED_EVENT, {
        detail: { storeId: selectedStoreId, activeOrders: orders, waiterCalls: calls, tables: payload.tables },
      }));

      if (newOrder) {
        void playNewOrderSound();
        setNotification({
          id: `${newOrder.id}-${Date.now()}`,
          title: newOrder.public_code || "Pedido en mesa recibido",
          subtitle: [
            newOrder.customer_name || "Cliente",
            newOrder.table_name_snapshot || "Mesa",
          ].join(" · "),
        });
      } else if (newCall) {
        void playNewOrderSound();
        setNotification({ id: `${newCall.table_id}:${newCall.requested_at}`, title: "Solicitud de asistencia",
          subtitle: payload.tables?.find((table: { id: string }) => table.id === newCall.table_id)?.name || "Mesa" });
      }
    } catch {
      // El siguiente evento o sondeo vuelve a intentarlo sin interrumpir el panel.
    } finally {
      if (requestInFlightRef.current === selectedStoreId) {
        requestInFlightRef.current = null;
        if (queuedRefreshRef.current === selectedStoreId) {
          queuedRefreshRef.current = null;
          // Drain one trailing refresh so the last event in a burst is not lost.
          if (mountedRef.current && currentStoreRef.current === selectedStoreId) void refresh(true);
        }
      }
    }
  }, [hasAccess, selectedStoreId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; queuedRefreshRef.current = null; };
  }, []);

  useEffect(() => {
    knownOrderIdsRef.current = new Set();
    knownCallsRef.current = new Set();
    hasBaselineRef.current = false;
    setNotification(null);
    void refresh(false);
  }, [refresh]);

  useEffect(() => {
    const unlock = () => void unlockOrderNotificationSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!selectedStoreId || !hasAccess) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    const interval = window.setInterval(
      refreshWhenVisible,
      isRealtimeReady ? TABLE_ORDERS_FALLBACK_POLL_MS : TABLE_ORDERS_DISCONNECTED_POLL_MS
    );
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [hasAccess, isRealtimeReady, refresh, selectedStoreId]);

  useEffect(() => {
    if (!selectedStoreId || !hasAccess) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;
    let refreshTimer: number | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    setIsRealtimeReady(false);
    const scheduleRefresh = () => {
      if (!active) return;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void refresh(true), 120);
    };

    void (async () => {
      const accessToken = await getPanelAccessToken();
      if (!active || !accessToken) return;
      await supabase.realtime.setAuth(accessToken);
      channel = supabase
        .channel(`store:${selectedStoreId}:orders`, { config: { private: true } })
        .on("broadcast", { event: "order_changed" }, scheduleRefresh)
        .subscribe((status) => {
          if (!active) return;
          setIsRealtimeReady(status === "SUBSCRIBED");
        });
    })();

    return () => {
      active = false;
      setIsRealtimeReady(false);
      if (refreshTimer) window.clearTimeout(refreshTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [hasAccess, refresh, selectedStoreId]);

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => setNotification(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [notification]);

  return (
    <NewOrderToast
      notification={notification}
      onClose={() => setNotification(null)}
    />
  );
}
