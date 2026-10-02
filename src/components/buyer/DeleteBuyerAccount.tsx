"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Clock3, LogIn, ShieldCheck, Trash2 } from "lucide-react";
import { buyerAuthHeaders, getBuyerClient, signInBuyerWithGoogle } from "@/lib/buyer/client";

type AccountIdentity = {
  email: string;
  type: "buyer" | "commerce" | "delivery" | "mixed";
  operational: boolean;
  pending: boolean;
  requestedAt: string | null;
};

export function DeleteBuyerAccount() {
  const [identity, setIdentity] = useState<AccountIdentity | null>(null);
  const [ready, setReady] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [requested, setRequested] = useState(false);

  const refreshIdentity = useCallback(async () => {
    try {
      const response = await fetch("/api/buyer/account", {
        credentials: "same-origin",
        cache: "no-store",
        headers: await buyerAuthHeaders(),
      });
      if (!response.ok) { setIdentity(null); return; }
      const data = await response.json();
      setIdentity(data.account || null);
      setRequested(Boolean(data.account?.pending));
    } catch {
      setIdentity(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshIdentity();
    const auth = getBuyerClient();
    if (!auth) return;
    const { data } = auth.auth.onAuthStateChange(() => { window.setTimeout(() => void refreshIdentity(), 0); });
    return () => data.subscription.unsubscribe();
  }, [refreshIdentity]);

  async function login() {
    setBusy(true);
    setError("");
    try { await signInBuyerWithGoogle(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No pudimos ingresar."); setBusy(false); }
  }

  async function removeAccount() {
    if (busy || confirmation !== "ELIMINAR") return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/buyer/account", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...await buyerAuthHeaders() },
        body: JSON.stringify({ confirmation }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No pudimos procesar la eliminacion.");
      setConfirmation("");
      if (data.pending) {
        setRequested(true);
        setIdentity((current) => current ? { ...current, pending: true } : current);
      } else {
        await getBuyerClient()?.auth.signOut({ scope: "local" });
        setIdentity(null);
        setDeleted(true);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos procesar la eliminacion.");
    } finally {
      setBusy(false);
    }
  }

  const backHref = identity?.operational ? "/panel" : "/mi-cuenta";
  return <main className="buyer-account-page buyer-delete-page">
    <Link href={backHref} className="buyer-back"><ArrowLeft size={18} />{identity?.operational ? "Mi negocio" : "Mi cuenta"}</Link>
    <header><h1>Eliminar cuenta</h1></header>
    {deleted ? <section className="buyer-delete-result" role="status"><ShieldCheck size={28} /><h2>Cuenta eliminada</h2><p>Tu acceso, historial vinculado y calificaciones fueron eliminados.</p><Link href="/marketplace" className="buyer-account-link">Volver al Marketplace</Link></section> : requested ? <section className="buyer-delete-result" role="status"><Clock3 size={28} /><h2>Solicitud recibida</h2><p>Revisaremos los accesos vinculados antes de eliminar la cuenta. El catalogo, los pedidos y la facturacion del negocio se conservan.</p><Link href={backHref} className="buyer-account-link">Volver</Link></section> : <>
      <section className="buyer-delete-summary">
        <p>Desde aqui puedes eliminar tu cuenta de SOMOS o solicitar la eliminacion si administra operaciones.</p>
        <h2>Que se elimina</h2>
        <ul><li>Tu acceso y las sesiones de SOMOS.</li><li>La vinculacion de pedidos con tu cuenta de comprador.</li><li>Tus calificaciones y observaciones.</li></ul>
        <h2>Que puede conservarse</h2>
        <p>Los pedidos, catalogos y registros de facturacion permanecen como registros operativos del comercio cuando exista una necesidad comercial, de seguridad o legal.</p>
      </section>
      {!ready ? <p role="status">Comprobando sesion...</p> : !identity ? <section className="buyer-signin"><p>Ingresa con la cuenta que deseas eliminar.</p><button type="button" disabled={busy} onClick={() => void login()}><LogIn size={19} />Continuar con Google</button><Link href="/panel/login" className="buyer-account-link">Ingresar como comercio</Link></section> : <section className="buyer-delete-confirm">
        <p>Cuenta: <strong>{identity.email}</strong></p>
        {identity.operational ? <p className="buyer-delete-operation-note">Esta cuenta administra un comercio o empresa delivery. Revisaremos primero sus accesos para no dejar la operacion sin responsable.</p> : null}
        <label htmlFor="delete-confirmation">Escribe ELIMINAR para confirmar</label>
        <input id="delete-confirmation" value={confirmation} autoComplete="off" spellCheck={false} disabled={busy} onChange={event => { setConfirmation(event.target.value); setError(""); }} />
        <button type="button" className="buyer-delete-button" disabled={busy || confirmation !== "ELIMINAR"} onClick={() => void removeAccount()}><Trash2 size={18} />{busy ? "Procesando..." : identity.operational ? "Solicitar eliminacion" : "Eliminar mi cuenta"}</button>
      </section>}
    </>}
    {error ? <p role="alert" className="buyer-error">{error}</p> : null}
    <Link href="/privacidad" className="buyer-privacy-link"><ShieldCheck size={17} />Consulta como tratamos tus datos</Link>
  </main>;
}
