"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Clock3, Loader2, RefreshCcw, ShieldAlert, Store, Truck } from "lucide-react";

type DeletionRequest = {
  id: string;
  email: string;
  account_type: "buyer" | "commerce" | "delivery" | "mixed";
  status: "pending" | "completed" | "rejected";
  requested_at: string;
  resolved_at: string | null;
  stores: string[];
  agencies: string[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function AdminAccountDeletionRequestsManager() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/account-deletion-requests?status=pending", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudieron cargar las solicitudes.");
      setRequests(payload.requests || []);
      setTotal(payload.total || 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="space-y-3 rounded-lg border border-[#25262B]/10 bg-white p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><ShieldAlert size={19} className="text-[#E95F32]" /><h2 className="font-black">Eliminacion de cuentas</h2></div>
          <p className="mt-1 text-sm text-[#746f69]">Transfiere primero los accesos operativos; el catalogo y los pedidos no deben eliminarse.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="grid size-10 place-items-center rounded-lg border border-[#25262B]/10 disabled:opacity-50" aria-label="Actualizar solicitudes de eliminacion" title="Actualizar">
          <RefreshCcw size={17} className={loading ? "animate-spin" : ""} />
        </button>
      </header>
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
      {loading ? <div className="flex items-center gap-2 py-4 text-sm font-bold text-[#746f69]"><Loader2 size={18} className="animate-spin" />Cargando solicitudes...</div> : null}
      {!loading && !requests.length && !error ? <div className="flex items-center gap-2 py-3 text-sm font-bold text-[#746f69]"><Clock3 size={18} />No hay solicitudes pendientes.</div> : null}
      {!loading && requests.length ? (
        <div className="divide-y divide-[#25262B]/10 border border-[#25262B]/10">
          {requests.map((entry) => (
            <article key={entry.id} className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-black" title={entry.email}>{entry.email}</p>
                <p className="text-xs font-bold text-[#746f69]">Solicitada {formatDate(entry.requested_at)}</p>
                {entry.stores.length ? <p className="mt-2 flex items-start gap-2 text-sm"><Store size={16} className="mt-0.5 shrink-0" /><span>{entry.stores.join(", ")}</span></p> : null}
                {entry.agencies.length ? <p className="mt-1 flex items-start gap-2 text-sm"><Truck size={16} className="mt-0.5 shrink-0" /><span>{entry.agencies.join(", ")}</span></p> : null}
              </div>
              <Link href="/admin/usuarios" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#2E3A79] px-3 text-sm font-black text-white">Revisar accesos</Link>
            </article>
          ))}
        </div>
      ) : null}
      {total > 50 ? <p className="text-xs font-bold text-[#746f69]">Mostrando las 50 solicitudes mas recientes de {total}.</p> : null}
    </section>
  );
}
