"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCcw, XCircle } from "lucide-react";
import { getPanelAuthHeaders, getSavedPanelToken, hasSavedPanelAuth } from "@/lib/panel/client-auth";
import { formatBs, formatUsd } from "@/lib/currency";

type PaymentRow = {
  id: string;
  store_id: string;
  billing_period: "monthly" | "annual";
  amount_usd: number;
  amount_bs: number;
  payment_reference?: string | null;
  payment_bank?: string | null;
  paid_at?: string | null;
  notes?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  stores?: { name?: string; slug?: string; subscription_ends_at?: string | null; next_payment_due_at?: string | null } | null;
};

async function adminRequest(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getPanelAuthHeaders("")),
      ...(options?.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Error cargando pagos.");
  return data;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function AdminSubscriptionPaymentsManager() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [filter, setFilter] = useState("pending");
  const [storeQuery, setStoreQuery] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(() => hasSavedPanelAuth());
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const data = await adminRequest(`/api/admin/subscription-payments?status=${filter}`);
      setPayments(data.payments || []);
      setIsUnlocked(true);
    } catch (error: any) {
      setMessage(error.message || "No se pudieron cargar pagos.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  async function review(paymentId: string, action: "approve" | "reject") {
    setIsLoading(true);
    setMessage("");

    try {
      const data = await adminRequest("/api/admin/subscription-payments", {
        method: "PATCH",
        body: JSON.stringify({ paymentId, action }),
      });
      setMessage(data.message || "Pago revisado.");
      await load();
    } catch (error: any) {
      setMessage(error.message || "No se pudo revisar el pago.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (getSavedPanelToken()) load();
    else setIsLoading(false);
  }, [load]);

  const visiblePayments = payments.filter((payment) => {
    const needle = storeQuery.trim().toLowerCase();
    if (!needle) return true;
    return [payment.stores?.name, payment.stores?.slug]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });

  if (isLoading && !isUnlocked) {
    return (
      <section className="rounded-[34px] bg-white p-6 text-center shadow-xl shadow-[#2E3A79]/[0.07]">
        <Loader2 size={22} className="mx-auto animate-spin" />
        <p className="mt-3 text-sm font-black text-[#746f69]">Cargando pagos...</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">Pagos de planes</p>
            <h2 className="mt-1 text-3xl font-black">{payments.length} registros</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {["pending", "approved", "rejected", "all"].map((item) => (
              <button key={item} type="button" onClick={() => setFilter(item)} className={filter === item ? "rounded-full bg-[#25262B] px-4 py-2 text-xs font-black text-white" : "rounded-full bg-[#F8F3E8] px-4 py-2 text-xs font-black text-[#746f69]"}>
                {item}
              </button>
            ))}
            <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-full bg-[#FFB547] px-4 py-2 text-xs font-black text-[#25262B]">
              <RefreshCcw size={14} /> Actualizar
            </button>
          </div>
        </div>
        <input
          value={storeQuery}
          onChange={(event) => setStoreQuery(event.target.value)}
          placeholder="Filtrar por comercio..."
          className="mt-4 w-full rounded-2xl border border-[#25262B]/10 bg-[#F8F3E8] px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79] md:max-w-md"
        />
        {message ? <p className="mt-3 text-sm font-black text-[#2E3A79]">{message}</p> : null}
      </section>

      <section className="grid gap-3">
        {visiblePayments.map((payment) => (
          <article key={payment.id} className="rounded-[28px] bg-white p-4 shadow-xl shadow-[#2E3A79]/[0.06] ring-1 ring-[#25262B]/[0.06]">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-black">{payment.stores?.name || "Comercio"}</h3>
                  <span className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black text-[#2E3A79]">/{payment.stores?.slug}</span>
                  <span className="rounded-full bg-[#FFB547] px-3 py-1 text-xs font-black text-[#25262B]">{payment.status}</span>
                </div>
                <p className="mt-2 text-sm font-bold text-[#746f69]">
                  {payment.billing_period === "annual" ? "Anual" : "Mensual"} · {formatUsd(Number(payment.amount_usd || 0))} · {formatBs(Number(payment.amount_bs || 0))}
                </p>
                <p className="mt-1 text-xs font-bold text-[#746f69]">
                  Referencia: {payment.payment_reference || "sin referencia"} · Enviado: {formatDate(payment.created_at)}
                </p>
                <p className="mt-1 text-xs font-bold text-[#746f69]">
                  Banco emisor: {payment.payment_bank || "no indicado"} · Fecha pago: {formatDate(payment.paid_at)}
                </p>
                {payment.notes ? <p className="mt-2 rounded-2xl bg-[#F8F3E8] p-3 text-sm font-bold text-[#746f69]">{payment.notes}</p> : null}
              </div>
              {payment.status === "pending" ? (
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button type="button" onClick={() => review(payment.id, "approve")} className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-3 text-sm font-black text-green-700">
                    <CheckCircle2 size={16} /> Aprobar y extender
                  </button>
                  <button type="button" onClick={() => review(payment.id, "reject")} className="inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-3 text-sm font-black text-red-700">
                    <XCircle size={16} /> Rechazar
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
        {!visiblePayments.length ? <p className="rounded-[28px] bg-white p-6 text-center text-sm font-black text-[#746f69]">No hay pagos con este filtro.</p> : null}
      </section>
    </div>
  );
}
