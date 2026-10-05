"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Bell, RefreshCw, Volume2, Settings, X } from "lucide-react";
import { loadOrderNoticeReadIds, nativeOrderAlerts, newOrdersSince, orderNoticeReadKey, readOrderNoticeIds, rememberReadOrderNotices, setNativeOrderAlertsActive } from "@/lib/mobile/order-alerts";
import { usePanelAuth } from "./PanelAuthProvider";
import { PanelAnnouncements } from "./PanelAnnouncements";
import { getPanelAuthHeaders } from "@/lib/panel/client-auth";
import { useNativeBackLayer } from "@/hooks/use-native-app";
import styles from "./PanelNotifications.module.css";

type RecentOrder = { id: string; store_id: string; public_code: string; customer_name: string; status: string; created_at: string };

const statusLabels: Record<string, string> = {
  received: "Recibido", accepted: "Aceptado", preparing: "En preparación", ready: "Listo",
  delivering: "En camino", completed: "Completado", cancelled: "Cancelado",
};

export function PanelNotifications() {
  const { accountId, selectedStoreId } = usePanelAuth();
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertsSupported, setAlertsSupported] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertBusy, setAlertBusy] = useState(false);
  const enabledRef = useRef(false);
  const mounted = useRef(true);
  const seenOrders = useRef<Set<string> | null>(null);
  const started = useRef(0);
  const alertKey = `somos_order_alerts_${accountId}`;
  const [open, setOpen] = useState<"orders" | "news" | null>(null);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const readKey = orderNoticeReadKey(accountId, selectedStoreId);
  const readIdsRef = useRef(new Set<string>());
  const unreadCount = orders.filter(order => !readIds.has(order.id)).length;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    const trigger = root.current?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
    setOpen(null);
    trigger?.focus();
  }, []);
  useNativeBackLayer(open !== null, close);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    readIdsRef.current = loadOrderNoticeReadIds(accountId, selectedStoreId).ids;
    setReadIds(readIdsRef.current);
  }, [accountId, selectedStoreId]);

  useEffect(() => {
    const syncReadState = (event: StorageEvent) => {
      if (event.key !== readKey) return;
      readIdsRef.current = readOrderNoticeIds(readKey);
      setReadIds(new Set(readIdsRef.current));
    };
    window.addEventListener("storage", syncReadState);
    return () => window.removeEventListener("storage", syncReadState);
  }, [readKey]);

  useEffect(() => {
    if (open !== "orders" || loading || error || !orders.length) return;
    readIdsRef.current = rememberReadOrderNotices(readKey, orders.map(order => order.id), readIdsRef.current);
    setReadIds(readIdsRef.current);
  }, [open, loading, error, orders, readKey]);

  useEffect(() => {
    const plugin = nativeOrderAlerts();
    if (!plugin) return;
    let active = true;
    setAlertsSupported(true);
    const sync = async () => {
      try {
        const { granted } = await plugin.status();
        if (!active) return;
        const enabled = granted && localStorage.getItem(alertKey) === "true";
        enabledRef.current = enabled;
        setAlertsEnabled(enabled);
        setNativeOrderAlertsActive(enabled);
      } catch { if (active) setAlertMessage("No pudimos comprobar los permisos de sonido."); }
    };
    void sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => { active = false; enabledRef.current = false; setNativeOrderAlertsActive(false); void plugin.clear().catch(() => {}); window.removeEventListener("focus", sync); document.removeEventListener("visibilitychange", sync); };
  }, [alertKey]);

  async function toggleAlerts() {
    const plugin = nativeOrderAlerts();
    if (!plugin || alertBusy) return;
    setAlertBusy(true);
    try {
      const next = !alertsEnabled && (await plugin.enable()).granted;
      if (!mounted.current) return;
      localStorage.setItem(alertKey, String(next));
      enabledRef.current = next;
      setAlertsEnabled(next);
      setNativeOrderAlertsActive(next);
      if (!next) await plugin.clear();
      setAlertMessage(next ? "Avisos activados con el panel abierto." : alertsEnabled ? "Avisos desactivados." : "Permiso no concedido. Revisa los ajustes de Android.");
    } catch { if (mounted.current) setAlertMessage("No pudimos activar los avisos. Revisa los permisos."); }
    finally { if (mounted.current) setAlertBusy(false); }
  }

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, close]);

  useEffect(() => {
    if (!selectedStoreId) return;
    let active = true;
    let busy = false;
    const abort = new AbortController();
    async function load() {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const params = new URLSearchParams({ storeId: selectedStoreId });
        const response = await fetch(`/api/panel/order-notifications?${params}`, { headers: await getPanelAuthHeaders(), cache: "no-store", signal: abort.signal });
        if (!response.ok) throw new Error("orders");
        const data = await response.json();
        if (!Array.isArray(data.orders)) throw new Error("orders");
        if (active) {
          const current: RecentOrder[] = data.orders.filter((order: RecentOrder) => selectedStoreId === "all" || order.store_id === selectedStoreId);
          if (!seenOrders.current) {
            const serverTime = Date.parse(response.headers.get("date") || "");
            started.current = Number.isFinite(serverTime) ? serverTime : Date.now();
          }
          const fresh = seenOrders.current ? newOrdersSince(current, seenOrders.current, selectedStoreId, started.current) : [];
          seenOrders.current = new Set([...(seenOrders.current || []), ...current.map(order => order.id)].slice(-500));
          if (enabledRef.current && fresh.length) {
            const plugin = nativeOrderAlerts();
            try {
              if (plugin && (await plugin.status()).granted && active && enabledRef.current) {
                for (const order of fresh) {
                  if (!active || !enabledRef.current) break;
                  await plugin.show({ id: `${accountId}:${selectedStoreId}:${order.id}` });
                }
              }
            } catch { if (active) setAlertMessage("No se pudo mostrar el aviso. Revisa los permisos de Android."); }
          }
          if (!active) return;
          setOrders(current);
          setError(false);
        }
      } catch {
        if (active) { setError(true); setOrders([]); }
      } finally {
        busy = false;
        if (active) setLoading(false);
      }
    }
    void load();
    const interval = window.setInterval(() => void load(), 15_000);
    document.addEventListener("visibilitychange", load);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      abort.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener("focus", load);
    };
  }, [accountId, selectedStoreId, retry]);

  return (
    <div ref={root} className={styles.controls} aria-label="Avisos del comercio">
      <button type="button" className={styles.trigger} title="Notificaciones de pedidos" aria-label="Notificaciones de pedidos" aria-expanded={open === "orders"} aria-controls="panel-order-notifications" onClick={() => { setOpen(open === "orders" ? null : "orders"); if (open !== "orders") setRetry(value => value + 1); }}>
        <Bell size={20} />
        {!error && open !== "orders" && unreadCount > 0 ? <span className={styles.badge} aria-label={`${unreadCount} pedidos sin revisar`}>{unreadCount}</span> : null}
      </button>
      {open === "orders" ? <section id="panel-order-notifications" aria-label="Pedidos recientes" className={styles.popover}>
        <header className={styles.heading}><h2>Pedidos recientes</h2><button type="button" className={styles.close} aria-label="Cerrar pedidos" onClick={close}><X size={18} /></button></header>
        {alertsSupported ? <div className={styles.alertSettings}>
          <label><input type="checkbox" checked={alertsEnabled} disabled={alertBusy} onChange={() => void toggleAlerts()} />Sonido y notificacion</label>
          <p>Solo con el panel abierto. Segundo plano no disponible.</p>
          <div><button type="button" disabled={!alertsEnabled || alertBusy} onClick={async () => {
            setAlertBusy(true);
            try { await nativeOrderAlerts()?.show({ id: `test:${Date.now()}`, test: true }); setAlertMessage("Aviso de prueba enviado al telefono."); }
            catch { setAlertMessage("No se pudo mostrar el aviso. Revisa los ajustes de Android."); }
            finally { setAlertBusy(false); }
          }}><Volume2 size={16} />Probar</button><button type="button" title="Ajustes de notificaciones de Android" aria-label="Ajustes de notificaciones de Android" onClick={() => void nativeOrderAlerts()?.settings().catch(() => setAlertMessage("No pudimos abrir los ajustes."))}><Settings size={18} /></button></div>
          {alertMessage ? <p role="status">{alertMessage}</p> : null}
        </div> : null}
        {loading ? <p role="status" className={styles.message}>Cargando pedidos...</p> : error ? <div role="alert" className={styles.message}>No pudimos consultar los pedidos.<button type="button" className={styles.action} onClick={() => { setLoading(true); setRetry(value => value + 1); }}><RefreshCw size={16} />Reintentar</button></div> : orders.length ? <ul>{orders.map(order => <li key={order.id} className={styles.order}><strong>{order.public_code}</strong><span>{order.customer_name || "Cliente"}</span><span>{statusLabels[order.status] || order.status}</span><span>{new Date(order.created_at).toLocaleString("es-VE", { timeZone: "America/Caracas", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></li>)}</ul> : <p className={styles.message}>No hay pedidos recientes.</p>}
        <Link href="/panel/pedidos" onClick={close} className={styles.action}>Ver pedidos<ArrowRight size={16} /></Link>
      </section> : null}
      <PanelAnnouncements isOpen={open === "news"} onToggle={() => setOpen("news")} onClose={close} />
    </div>
  );
}
