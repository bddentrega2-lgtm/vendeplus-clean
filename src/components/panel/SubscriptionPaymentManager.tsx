"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Loader2, Send } from "lucide-react";
import { PanelAccessGate, PanelModuleSkeleton } from "@/components/panel/PanelLoadingState";
import {
  getPanelAccessToken,
  getPanelAuthHeaders,
  getSavedPanelPin,
  hasSavedPanelAuth,
  savePanelPin,
  shouldShowPanelInitialAccessGate,
} from "@/lib/panel/client-auth";
import { formatBs, formatUsd } from "@/lib/currency";
import { plans, getPlan, type PlanId, PER_SERVICE_FEE_USD } from "@/lib/plans";

const selfServicePlans = plans.filter((plan) => plan.id !== "custom");

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  plan_type?: string | null;
  subscription_status?: string | null;
  subscription_ends_at?: string | null;
  next_payment_due_at?: string | null;
  monthly_price_usd?: number | null;
  usd_to_bs?: number | null;
  trial_ends_at?: string | null;
};

type ServiceUsage = {
  serviceCount: number;
  amountUsd: number;
  periodStart: string | null;
};

type PaymentRow = {
  id: string;
  store_id: string;
  billing_period: "monthly" | "annual";
  amount_usd: number;
  amount_bs: number;
  payment_reference?: string | null;
  payment_bank?: string | null;
  paid_at?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

async function subscriptionRequest(pin: string, options?: RequestInit) {
  const response = await fetch("/api/panel/subscription-payments", {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getPanelAuthHeaders(pin)),
      ...(options?.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Error cargando suscripción.");
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

export function SubscriptionPaymentManager() {
  const [pin, setPin] = useState("");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [serviceUsageByStore, setServiceUsageByStore] = useState<Record<string, ServiceUsage>>({});
  const [storeId, setStoreId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>("monthly");
  const [billingPeriod] = useState<"monthly" | "annual">("monthly");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentBank, setPaymentBank] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => shouldShowPanelInitialAccessGate());
  const [isLoading, setIsLoading] = useState(() => hasSavedPanelAuth());
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [currentTimeMs, setCurrentTimeMs] = useState<number | null>(null);

  const selectedStore = stores.find((store) => store.id === storeId) || stores[0] || null;
  const selectedPlan = getPlan(selectedPlanId);
  const currentPlan = getPlan(selectedStore?.plan_type);
  const serviceUsage = selectedStore
    ? serviceUsageByStore[selectedStore.id] || { serviceCount: 0, amountUsd: 0, periodStart: null }
    : { serviceCount: 0, amountUsd: 0, periodStart: null };
  const trialDueAt = selectedStore?.trial_ends_at || selectedStore?.subscription_ends_at;
  const isTrial = selectedStore?.subscription_status === "trial" || selectedStore?.plan_type === "trial";
  const isTrialExpired = Boolean(
    isTrial && trialDueAt && currentTimeMs !== null && new Date(trialDueAt).getTime() < currentTimeMs
  );
  const isPerService = selectedStore?.plan_type === "per_service";
  const amountUsd = useMemo(() => {
    if (isTrialExpired && selectedPlanId === "monthly") return 20;
    if (isTrialExpired && selectedPlanId === "per_service") return 0;
    if (isPerService) return serviceUsage.amountUsd;
    const monthly = Number(selectedStore?.monthly_price_usd || 0) || currentPlan.priceUsd;
    return billingPeriod === "annual" ? monthly * 12 : monthly;
  }, [
    billingPeriod,
    currentPlan.priceUsd,
    isPerService,
    isTrialExpired,
    selectedPlanId,
    selectedStore?.monthly_price_usd,
    serviceUsage.amountUsd,
  ]);
  const amountBs = amountUsd * Number(selectedStore?.usd_to_bs || 600);

  async function load(currentPin: string) {
    setIsLoading(true);
    setMessage("");

    try {
      const data = await subscriptionRequest(currentPin);
      setStores(data.stores || []);
      setPayments(data.payments || []);
      setServiceUsageByStore(data.serviceUsageByStore || {});
      setStoreId((current) => current || data.stores?.[0]?.id || "");
      setIsUnlocked(true);
      savePanelPin(currentPin);
    } catch (error: any) {
      setMessage(error.message || "No se pudo cargar suscripción.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }

  async function submitPayment() {
    if (!selectedStore) return;

    setIsLoading(true);
    setMessage("");

    try {
      const data = await subscriptionRequest(pin, {
        method: "POST",
        body: JSON.stringify({
          storeId: selectedStore.id,
          action: isTrialExpired ? "choose_plan" : "submit_payment",
          planId: isTrialExpired ? selectedPlanId : selectedStore.plan_type,
          billingPeriod,
          paymentReference,
          paymentBank,
          paidAt,
          notes,
        }),
      });
      setMessage(data.message || "Pago enviado.");
      setPaymentReference("");
      setPaymentBank("");
      setPaidAt("");
      setNotes("");
      await load(pin);
    } catch (error: any) {
      setMessage(error.message || "No se pudo enviar el pago.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setCurrentTimeMs(Date.now());

    async function boot() {
      const savedPin = getSavedPanelPin();
      const savedToken = await getPanelAccessToken();
      if (!active) return;

      if (savedPin || savedToken) {
        setPin(savedPin);
        load(savedPin);
      } else {
        setIsCheckingAccess(false);
      }
    }

    boot();
    return () => {
      active = false;
    };
  }, []);

  if (isCheckingAccess) return <PanelAccessGate />;
  if (isLoading && !isUnlocked) return <PanelModuleSkeleton label="Cargando suscripción..." />;
  if (!isUnlocked) return <PanelAccessGate />;

  async function activatePerServicePlan() {
    if (!selectedStore) return;

    setIsLoading(true);
    setMessage("");

    try {
      const data = await subscriptionRequest(pin, {
        method: "POST",
        body: JSON.stringify({
          storeId: selectedStore.id,
          action: "choose_plan",
          planId: "per_service",
        }),
      });
      setMessage(data.message || "Plan por servicio activado.");
      await load(pin);
    } catch (error: any) {
      setMessage(error.message || "No se pudo activar el plan.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#2E3A79] text-[#FFB547]">
            <CreditCard size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-black">Pagar suscripción</h2>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              La prueba gratis dura 15 días. Al vencer, elige mensual o corte por servicio.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Comercio</span>
            <select value={selectedStore?.id || ""} onChange={(event) => setStoreId(event.target.value)} className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none">
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </label>
          <div className="rounded-2xl bg-[#F8F3E8] px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Periodo</p>
            <p className="mt-1 text-sm font-black text-[#25262B]">Mensual</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-[24px] bg-[#F8F3E8] p-4 sm:grid-cols-3">
          <div><p className="text-xs font-black text-[#746f69]">Plan</p><p className="font-black">{isTrial ? "Prueba gratis" : currentPlan.name}</p></div>
          <div><p className="text-xs font-black text-[#746f69]">Vence</p><p className="font-black">{formatDate(trialDueAt || selectedStore?.next_payment_due_at)}</p></div>
          <div><p className="text-xs font-black text-[#746f69]">Monto</p><p className="font-black">{formatUsd(amountUsd)} / {formatBs(amountBs)}</p></div>
        </div>

        {isTrial ? (
          <section className="mt-4 rounded-[24px] bg-[#FFF8F0] p-4">
            <p className="text-sm font-black text-[#25262B]">
              {isTrialExpired
                ? "Tu prueba gratis venció. Elige un plan para continuar."
                : `Estás en prueba gratis hasta ${formatDate(trialDueAt)}.`}
            </p>
            {isTrialExpired ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {selfServicePlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={[
                      "rounded-[22px] p-4 text-left ring-1",
                      selectedPlanId === plan.id
                        ? "bg-[#2E3A79] text-white ring-[#2E3A79]"
                        : "bg-white text-[#25262B] ring-[#25262B]/10",
                    ].join(" ")}
                  >
                    <p className="text-base font-black">{plan.name}</p>
                    <p className="mt-1 text-sm font-black">
                      {plan.id === "monthly"
                        ? "$20 adelantados al mes"
                        : `$${PER_SERVICE_FEE_USD.toFixed(2)} por servicio en corte mensual`}
                    </p>
                    <p className="mt-2 text-xs font-bold opacity-70">
                      Hasta {plan.productLimit} productos.
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {isPerService ? (
          <section className="mt-4 rounded-[24px] bg-[#FFF8F0] p-4">
            <p className="text-sm font-black text-[#25262B]">Corte por servicio</p>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Servicios acumulados este periodo: {serviceUsage.serviceCount}. Total del corte:{" "}
              {formatUsd(serviceUsage.amountUsd)}.
            </p>
          </section>
        ) : null}

        {isTrialExpired && selectedPlan.id === "per_service" ? (
          <button
            type="button"
            onClick={activatePerServicePlan}
            disabled={isLoading || !selectedStore}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
            Activar plan por servicio
          </button>
        ) : null}

        {(!isTrial || (isTrialExpired && selectedPlan.id === "monthly")) ? (
        <>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Referencia</span>
            <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Banco emisor</span>
            <input value={paymentBank} onChange={(event) => setPaymentBank(event.target.value)} placeholder="Ej: Banesco" className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Fecha de pago</span>
            <input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none" />
          </label>
        </div>
        <label className="mt-4 block space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Nota</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none" />
        </label>
        <button type="button" onClick={submitPayment} disabled={isLoading || !selectedStore} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60">
          {isLoading ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          {isPerService ? "Enviar corte a revisión" : "Enviar pago adelantado"}
        </button>
        </>
        ) : null}
        {message ? <p className="mt-3 text-sm font-black text-[#2E3A79]">{message}</p> : null}
      </section>

      <aside className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <h3 className="text-xl font-black">Últimos pagos</h3>
        <div className="mt-4 space-y-2">
          {payments.map((payment) => (
            <div key={payment.id} className="rounded-2xl bg-[#F8F3E8] p-3 text-sm font-bold">
              <div className="flex justify-between gap-3">
                <span>{formatUsd(Number(payment.amount_usd || 0))}</span>
                <span>{payment.status}</span>
              </div>
              <p className="mt-1 text-xs text-[#746f69]">{payment.payment_bank || "Banco no indicado"} · {formatDate(payment.paid_at)}</p>
              <p className="mt-1 text-xs text-[#746f69]">{formatDate(payment.created_at)} · {payment.billing_period}</p>
            </div>
          ))}
          {!payments.length ? <p className="text-sm font-bold text-[#746f69]">Sin pagos registrados.</p> : null}
        </div>
      </aside>
    </div>
  );
}
