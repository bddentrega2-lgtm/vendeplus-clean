"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { completeBuyerSignIn } from "@/lib/buyer/client";

export default function BuyerCallback() {
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const url = window.location.href;
    window.history.replaceState(null, "", "/auth/buyer-callback");
    void completeBuyerSignIn(url).then(() => window.location.replace("/mi-cuenta")).catch(error => setError(error.message));
  }, []);
  return <main className="buyer-account-page"><h1>Mi cuenta</h1><p role="status">{error || "Completando acceso con Google..."}</p>{error ? <Link href="/mi-cuenta">Volver a intentar</Link> : null}</main>;
}
