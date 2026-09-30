"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, ChevronLeft, ChevronRight, LogIn, LogOut, RefreshCw, ShieldCheck, Star, Trash2 } from "lucide-react";
import { buyerAuthHeaders, getBuyerClient, signInBuyerWithGoogle } from "@/lib/buyer/client";

type BuyerOrder = {
  id: string; public_code: string; created_at: string; status: string; total_usd: number; delivery_type: string; rating: number | null; observation: string | null;
  stores: { name: string; slug: string } | null;
  order_items: { product_name: string; variant_name: string | null; quantity: number; total_usd: number; order_item_options: { option_name: string; quantity: number; price_delta_usd: number }[] }[];
};
const states: Record<string, string> = { received: "Recibido", accepted: "Aceptado", preparing: "En preparacion", ready: "Listo", delivering: "En camino", completed: "Completado", cancelled: "Cancelado" };

export function BuyerAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ userId: string; page: number; orders: BuyerOrder[]; hasMore: boolean } | null>(null);
  useEffect(() => {
    const auth = getBuyerClient();
    if (!auth) { setReady(true); return; }
    const { data } = auth.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null); setReady(true);
    });
    if (new URLSearchParams(window.location.search).has("acceso")) setError("No se completo el acceso. Vuelve a intentar con Google.");
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { setPage(0); setHistory(null); }, [user?.id]);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    void buyerAuthHeaders().then(headers => fetch(`/api/buyer/orders?page=${page}`, { headers, signal: controller.signal, cache: "no-store" }))
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "No pudimos cargar tus pedidos."); return data; })
      .then(data => { if (!controller.signal.aborted) setHistory({ userId: user.id, page, orders: data.orders, hasMore: data.hasMore }); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user, page, reload]);
  async function login() {
    setBusy(true); setError("");
    try { await signInBuyerWithGoogle(); } catch (error) { setError(error instanceof Error ? error.message : "No pudimos ingresar."); }
    finally { setBusy(false); }
  }
  const visible = history?.userId === user?.id && history?.page === page ? history : null;
  return <main className="buyer-account-page">
    <Link href="/marketplace" className="buyer-back"><ArrowLeft size={18} />Marketplace</Link>
    <header><h1>Mi cuenta</h1>{user ? <button type="button" disabled={busy} onClick={async () => {
      setBusy(true); setHistory(null);
      try { const result = await getBuyerClient()?.auth.signOut({ scope: "local" }); if (result?.error) throw result.error; setUser(null); }
      catch { setError("No pudimos cerrar la sesion. Vuelve a intentar."); }
      finally { setBusy(false); }
    }}><LogOut size={18} />Salir</button> : null}</header>
    {!ready ? <p role="status">Comprobando sesion...</p> : !user ? <section className="buyer-signin"><h2>Tus pedidos</h2><button type="button" disabled={busy} onClick={() => void login()}><LogIn size={19} />Continuar con Google</button><p>Puedes seguir comprando como invitado.</p></section> : <>
      <p className="buyer-email">{user.email}</p>
      <section className="buyer-history"><div className="buyer-history-heading"><h2>Mis pedidos</h2><button title="Actualizar pedidos" aria-label="Actualizar pedidos" disabled={loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={18} /></button></div>
        {loading ? <p role="status">Cargando pedidos...</p> : null}
        {!loading && !error && visible && !visible.orders.length ? <div className="buyer-empty"><h3>Aun no tienes pedidos en esta cuenta</h3><Link href="/marketplace">Explorar comercios</Link></div> : null}
        {visible?.orders.map(order => <article key={order.id} className="buyer-order"><header><div><strong>{order.stores?.name || "Comercio"}</strong><p>{order.public_code}</p></div><span>{states[order.status] || "En proceso"}</span></header><p>{new Date(order.created_at).toLocaleString("es-VE", { timeZone: "America/Caracas", dateStyle: "medium", timeStyle: "short" })}</p><ul>{order.order_items.map((item, index) => <li key={index}><span>{item.quantity} x {item.product_name}{item.variant_name ? ` (${item.variant_name})` : ""}{item.order_item_options?.length ? <small>{item.order_item_options.map(option => `${Number(option.quantity || 1) > 1 ? `${option.quantity}x ` : ""}${option.option_name}`).join(", ")}</small> : null}</span><strong>${Number(item.total_usd).toFixed(2)}</strong></li>)}</ul><footer><strong>Total ${Number(order.total_usd).toFixed(2)}</strong>{order.stores?.slug ? <Link href={`/${order.stores.slug}`}>Ver comercio</Link> : null}</footer>{order.status === "completed" ? <OrderRating order={order} /> : null}</article>)}
        <nav className="buyer-pagination" aria-label="Paginas de pedidos"><button aria-label="Pagina anterior" title="Pagina anterior" disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}><ChevronLeft size={20} /></button><span>Pagina {page + 1}</span><button aria-label="Pagina siguiente" title="Pagina siguiente" disabled={!visible?.hasMore || loading} onClick={() => setPage(value => value + 1)}><ChevronRight size={20} /></button></nav>
      </section>
      <div className="buyer-account-controls"><Link href="/privacidad"><ShieldCheck size={17} />Privacidad</Link><Link href="/eliminar-cuenta" className="buyer-delete-link"><Trash2 size={17} />Eliminar cuenta</Link></div>
    </>}
    {error ? <p role="alert" className="buyer-error">{error}</p> : null}
  </main>;
}

function OrderRating({ order }: { order: BuyerOrder }) {
  const [rating, setRating] = useState(order.rating || 0);
  const [saved, setSaved] = useState(order.rating || 0);
  const [observation, setObservation] = useState(order.observation || "");
  const [savedObservation, setSavedObservation] = useState(order.observation || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <form className="buyer-rating" onSubmit={async event => {
    event.preventDefault(); if (!rating || busy) return; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/buyer/reviews", { method: "POST", headers: { "Content-Type": "application/json", ...await buyerAuthHeaders() }, body: JSON.stringify({ orderId: order.id, rating, observation: observation.trim() }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "No pudimos guardar la calificacion.");
      setSaved(rating); setSavedObservation(observation.trim()); setObservation(observation.trim()); setMessage("Calificacion guardada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos guardar la calificacion."); }
    finally { setBusy(false); }
  }}>
    <fieldset disabled={busy}><legend>{saved ? "Tu calificacion" : "Calificar comercio"}</legend><div className="buyer-stars">{[1, 2, 3, 4, 5].map(value => <label key={value} title={`${value} estrellas`}><input type="radio" name={`rating-${order.id}`} value={value} checked={rating === value} onChange={() => { setRating(value); setMessage(""); }} aria-label={`${value} estrellas`} /><Star size={24} fill={value <= rating ? "currentColor" : "none"} /></label>)}</div></fieldset>
    <div className="buyer-review-observation">
      <label htmlFor={`observation-${order.id}`}>Observacion (opcional)</label>
      <textarea id={`observation-${order.id}`} rows={3} maxLength={500} value={observation} disabled={busy} aria-describedby={`observation-count-${order.id}`} onChange={event => { setObservation(event.target.value); setMessage(""); }} />
      <small id={`observation-count-${order.id}`}>{observation.length}/500</small>
    </div>
    <button type="submit" disabled={busy || !rating || (saved === rating && savedObservation === observation.trim())}>{busy ? "Guardando..." : "Guardar calificacion"}</button>
    {message ? <p role="status">{message}</p> : null}
  </form>;
}
