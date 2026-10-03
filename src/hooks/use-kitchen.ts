'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePanelAuth } from '@/components/panel/PanelAuthProvider';
import { requestTableJson } from '@/lib/panel/table-snapshot-client';
import { subscribeStoreOrdersRealtime } from '@/lib/panel/store-orders-realtime';
import { kitchenEligible, type KitchenOrder, type KitchenTicket } from '@/lib/kitchen';
import { defaultOrderDelayThresholds, type OrderDelayThresholds } from '@/lib/order-delay';

type Ticket = KitchenTicket & { orders?: KitchenOrder };
type KitchenSettings = { enabled: boolean; dispatch_mode: 'manual' | 'paid'; delay_alerts_enabled: boolean; delay_thresholds: OrderDelayThresholds };
type Snapshot = { eligible: boolean; settings: KitchenSettings; tickets: Ticket[]; serverTime?: string };
const empty: Snapshot = { eligible: false, settings: { enabled: false, dispatch_mode: 'manual', delay_alerts_enabled: false, delay_thresholds: defaultOrderDelayThresholds }, tickets: [] };
export function useKitchen(board = false) {
  const { selectedStoreId, selectedStore, accountId } = usePanelAuth();
  const eligible = kitchenEligible(selectedStore);
  const scope = `${accountId}:${selectedStoreId}:${board}`;
  const [snapshot, setSnapshot] = useState<{ scope: string; value: Snapshot }>({ scope: '', value: empty });
  const [error, setError] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(Date.now);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const pendingRef = useRef(new Set<string>());
  const clockOffset = useRef(0);
  const refreshRef = useRef<() => void>(() => {});
  const lifetime = useRef(0);
  const refresh = useCallback(() => refreshRef.current(), []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + clockOffset.current), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    ++lifetime.current;
    let active = true, inFlight = false, trailing = false, realtime = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let lastLoad = 0;
    setError(''); setMutationError(''); setConnected(false); setOnline(navigator.onLine); setLoading(eligible);
    const load = async () => {
      if (!active || !eligible) return;
      if (inFlight) { trailing = true; return; }
      inFlight = true;
      try {
        const tickets = new Map<string, Ticket>();
        let data: Snapshot = empty;
        for (let page = 0; ; page++) {
          if (page >= 100) throw new Error('Demasiadas comandas activas. Revisa los pedidos pendientes.');
          const result = await requestTableJson(`/api/panel/kitchen?view=${board ? 'board' : 'summary'}&offset=${page * 100}`, {
            headers: { 'X-Panel-Store-Id': selectedStoreId }, cache: 'no-store',
          });
          if (!active) return;
          data = result;
          for (const ticket of result.tickets || []) tickets.set(ticket.order_id, ticket);
          if (!result.hasMore) break;
        }
        if (!active) return;
        if (data.serverTime) clockOffset.current = Date.parse(data.serverTime) - Date.now();
        setNow(Date.now() + clockOffset.current);
        setSnapshot({ scope, value: { ...data, tickets: [...tickets.values()] } });
        setError(''); lastLoad = Date.now();
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'No se pudo actualizar Cocina.');
      } finally {
        inFlight = false;
        if (active) {
          setLoading(false);
          if (trailing) { trailing = false; void load(); }
        }
      }
    };
    refreshRef.current = () => { void load(); };
    const schedule = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void load(), 150);
    };
    const resume = () => { setOnline(navigator.onLine); if (document.visibilityState === 'visible' && navigator.onLine) void load(); };
    const offline = () => { setOnline(false); setConnected(false); realtime = false; };
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - lastLoad > (realtime ? 120_000 : 15_000)) void load();
    }, 5_000);
    window.addEventListener('online', resume);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', resume);
    let cleanupRealtime = () => {};
    if (eligible) {
      void load();
      cleanupRealtime = subscribeStoreOrdersRealtime(selectedStoreId, {
        onKitchenChanged: schedule,
        onOrderChanged: schedule,
        onStatus: isConnected => {
          if (!active) return;
          realtime = isConnected;
          setConnected(isConnected);
          if (isConnected) schedule();
        },
      });
    }
    return () => {
      active = false;
      // Invalidate mutations from a previous store or an unmounted view.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      lifetime.current++;
      refreshRef.current = () => {}; clearTimeout(debounce); clearInterval(poll); cleanupRealtime();
      window.removeEventListener('online', resume); window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [scope, selectedStoreId, eligible, board]);
  const mutate = async (id: string, path: string, method: string, body: unknown) => {
    const key = `${scope}:${id}`, generation = lifetime.current;
    if (pendingRef.current.has(key)) return;
    pendingRef.current.add(key); setPending(new Set(pendingRef.current)); setMutationError('');
    try {
      const result = await requestTableJson(path, { method, headers: { 'X-Panel-Store-Id': selectedStoreId, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (lifetime.current === generation) {
        if (result.settings) setSnapshot(current => current.scope === scope
          ? { ...current, value: { ...current.value, settings: result.settings } }
          : current);
        setMutationError(''); refresh();
      }
    } catch (cause) {
      if (lifetime.current === generation) { refresh(); setMutationError(cause instanceof Error ? cause.message : 'No se pudo confirmar el cambio.'); }
    } finally { pendingRef.current.delete(key); setPending(new Set(pendingRef.current)); }
  };
  return {
    ...(snapshot.scope === scope ? snapshot.value : empty), eligible, now, error: mutationError || error, loading, connected, online, refresh,
    isPending: (id: string) => pending.has(`${scope}:${id}`),
    operate: (orderId: string, action: string, expectedState?: string) => mutate(orderId, '/api/panel/kitchen', 'POST', { orderId, action, expectedState }),
    cancel: (orderId: string, expectedStatus: string, cancellation: { cancellationReason: string; cancellationDetail: string }) =>
      mutate(orderId, '/api/panel/orders', 'PATCH', { id: orderId, status: 'cancelled', expectedStatus, ...cancellation }),
    configure: (enabled: boolean, dispatchMode: string, delayThresholds: OrderDelayThresholds = snapshot.value.settings.delay_thresholds,
      delayAlertsEnabled: boolean = snapshot.value.settings.delay_alerts_enabled) =>
      mutate('settings', '/api/panel/kitchen', 'PATCH', { enabled, dispatchMode, delayThresholds, delayAlertsEnabled }),
  };
}
