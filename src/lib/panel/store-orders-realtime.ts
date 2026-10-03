"use client";

import { getPanelAccessToken } from "@/lib/panel/client-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type BrowserClient = NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;
type SharedChannel = ReturnType<BrowserClient["channel"]>;
type Listener = {
  onOrderChanged?: () => void;
  onKitchenChanged?: () => void;
  onTransportOrderChanged?: () => void;
  onStatus?: (connected: boolean) => void;
};
type Entry = { client: BrowserClient; channel: SharedChannel; connected: boolean; listeners: Map<symbol, Listener> };

const entries = new Map<string, Entry>();

function notify(topic: string, event: keyof Pick<Listener, "onOrderChanged" | "onKitchenChanged" | "onTransportOrderChanged">) {
  const entry = entries.get(topic);
  if (!entry) return;
  for (const listener of entry.listeners.values()) listener[event]?.();
}

function updateStatus(topic: string, connected: boolean) {
  const entry = entries.get(topic);
  if (!entry) return;
  entry.connected = connected;
  for (const listener of entry.listeners.values()) listener.onStatus?.(connected);
}

export function subscribeStoreOrdersRealtime(storeId: string, listener: Listener) {
  const id = Symbol(storeId);
  const topic = `store:${storeId}:orders`;
  let disposed = false;
  let attached: Entry | null = null;

  void (async () => {
    const client = createSupabaseBrowserClient();
    const token = await getPanelAccessToken();
    if (disposed || !client || !token) return;
    await client.realtime.setAuth(token);
    if (disposed) return;

    let entry = entries.get(topic);
    if (!entry) {
      const channel = client.channel(topic, { config: { private: true } })
        .on("broadcast", { event: "order_changed" }, () => notify(topic, "onOrderChanged"))
        .on("broadcast", { event: "kitchen_changed" }, () => notify(topic, "onKitchenChanged"))
        .on("broadcast", { event: "transport_order_changed" }, () => notify(topic, "onTransportOrderChanged"));
      entry = { client, channel, connected: false, listeners: new Map() };
      entries.set(topic, entry);
      channel.subscribe(status => {
        if (status === "SUBSCRIBED") updateStatus(topic, true);
        else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) updateStatus(topic, false);
      });
    }

    attached = entry;
    entry.listeners.set(id, listener);
    listener.onStatus?.(entry.connected);
  })().catch(() => listener.onStatus?.(false));

  return () => {
    disposed = true;
    if (!attached) return;
    attached.listeners.delete(id);
    if (attached.listeners.size > 0) return;
    entries.delete(topic);
    void attached.client.removeChannel(attached.channel);
  };
}
