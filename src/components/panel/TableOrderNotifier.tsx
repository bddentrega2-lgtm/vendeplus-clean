"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NewOrderToast, type NewOrderToastData } from "@/components/panel/NewOrderToast";
import { usePanelAuth } from "@/components/panel/PanelAuthProvider";
import { getPanelAccessToken, getPanelAuthHeaders } from "@/lib/panel/client-auth";
import {
  playNewOrderSound,
  unlockOrderNotificationSound,
} from "@/lib/panel/order-notification-sound";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TABLE_ORDERS_CHANGED_EVENT } from "@/lib/table-orders";

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
  const requestInFlightRef = useRef(false);
  const hasAccess = selectedStore?.table_orders_access_enabled === true;

  const refresh = useCallback(async (notifyNew: boolean) => {
    if (!selectedStoreId || !hasAccess || requestInFlightRef.current) return;
    requestInFlightRef.current = true;

    try {
      const response = await fetch(
        `/api/panel/tables?storeId=${encodeURIComponent(selectedStoreId)}`,
        { cache: "no-store", headers: await getPanelAuthHeaders() }
      );
      if (!response.ok) return;

      const payload = await response.json();
      const orders: TableOrderSummary[] = Array.isArray(payload.activeOrders)
        ? payload.activeOrders
        : [];
      const newOrder = notifyNew && hasBaselineRef.current
        ? orders.find((order) => order.id && !knownOrderIdsRef.current.has(order.id))
        : null;

      for (const order of orders) {
        if (order.id) knownOrderIdsRef.current.add(order.id);
      }
      hasBaselineRef.current = true;

      if (newOrder) {
        window.dispatchEvent(new CustomEvent(TABLE_ORDERS_CHANGED_EVENT, {
          detail: { storeId: selectedStoreId, orderId: newOrder.id },
        }));
        void playNewOrderSound();
        setNotification({
          id: `${newOrder.id}-${Date.now()}`,
          title: newOrder.public_code || "Pedido en mesa recibido",
          subtitle: [
            newOrder.customer_name || "Cliente",
            newOrder.table_name_snapshot || "Mesa",
          ].join(" · "),
        });
      }
    } catch {
      // El siguiente evento o sondeo vuelve a intentarlo sin interrumpir el panel.
    } finally {
      requestInFlightRef.current = false;
    }
  }, [hasAccess, selectedStoreId]);

  useEffect(() => {
    knownOrderIdsRef.current = new Set();
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
