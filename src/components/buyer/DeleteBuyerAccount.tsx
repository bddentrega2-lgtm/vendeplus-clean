"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, LogIn, ShieldCheck, Trash2 } from "lucide-react";
import { buyerAuthHeaders, getBuyerClient, signInBuyerWithGoogle } from "@/lib/buyer/client";

export function DeleteBuyerAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);
  useEffect(() => {
    const auth = getBuyerClient();
    if (!auth) { setReady(true); return; }
    const { data } = auth.auth.onAuthStateChange((_event, session) => { setUser(session?.user || null); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  async function login() {
    setBusy(true); setError("");
    try { await signInBuyerWithGoogle(); } catch (reason) { setError(reason instanceof Error ? reason.message : "No pudimos ingresar."); setBusy(false); }
  }
  async function removeAccount() {
    if (busy || confirmation !== "ELIMINAR") return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/buyer/account", { method: "DELETE", headers: { "Content-Type": "application/json", ...await buyerAuthHeaders() }, body: JSON.stringify({ confirmation }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No pudimos eliminar tu cuenta.");
      await getBuyerClient()?.auth.signOut({ scope: "local" });
      setUser(null); setDeleted(true); setConfirmation("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No pudimos eliminar tu cuenta."); }
    finally { setBusy(false); }
  }
  return <main className="buyer-account-page buyer-delete-page">
    <Link href="/mi-cuenta" className="buyer-back"><ArrowLeft size={18} />Mi cuenta</Link>
    <header><h1>Eliminar cuenta</h1></header>
    {deleted ? <section className="buyer-delete-result" role="status"><ShieldCheck size={28} /><h2>Cuenta eliminada</h2><p>Tu acceso, historial vinculado y calificaciones fueron eliminados.</p><Link href="/marketplace" className="buyer-account-link">Volver al Marketplace</Link></section> : <>
      <section className="buyer-delete-summary">
        <p>Esta pagina permite solicitar y completar la eliminacion de una cuenta de comprador de Somos.</p>
        <h2>Que se elimina</h2>
        <ul><li>Tu acceso con Google y sesiones de Somos.</li><li>La vinculacion de pedidos con tu cuenta.</li><li>Tus calificaciones y observaciones.</li></ul>
        <h2>Que puede conservarse</h2>
        <p>Los pedidos ya enviados permanecen como registros operativos del comercio, sin acceso desde tu cuenta. El comercio puede conservarlos cuando exista una obligacion comercial, de seguridad o legal.</p>
      </section>
      {!ready ? <p role="status">Comprobando sesion...</p> : !user ? <section className="buyer-signin"><p>Ingresa con la cuenta que deseas eliminar.</p><button type="button" disabled={busy} onClick={() => void login()}><LogIn size={19} />Continuar con Google</button></section> : <section className="buyer-delete-confirm">
        <p>Cuenta: <strong>{user.email}</strong></p>
        <label htmlFor="delete-confirmation">Escribe ELIMINAR para confirmar</label>
        <input id="delete-confirmation" value={confirmation} autoComplete="off" spellCheck={false} disabled={busy} onChange={event => { setConfirmation(event.target.value); setError(""); }} />
        <button type="button" className="buyer-delete-button" disabled={busy || confirmation !== "ELIMINAR"} onClick={() => void removeAccount()}><Trash2 size={18} />{busy ? "Eliminando..." : "Eliminar mi cuenta"}</button>
      </section>}
    </>}
    {error ? <p role="alert" className="buyer-error">{error}</p> : null}
    <Link href="/privacidad" className="buyer-privacy-link"><ShieldCheck size={17} />Consulta como tratamos tus datos</Link>
  </main>;
}
