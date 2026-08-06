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
import { plans, getPlan, PER_SERVICE_FEE_USD } from "@/lib/plans";
import { isDateBeforeToday, isSubscriptionPastDue } from "@/lib/subscription-status";

const publicPlan = plans.find((plan) => plan.id === "per_service")!;
const selectedPlanId = "per_service" as const;
const somosPaymentDetails = [
  { label: "Cedula/RIF", value: "20890442" },
  { label: "Telefono", value: "04245666025" },
  { label: "Banco", value: "Provincial" },
];

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  plan_type?: string | null;
  subscription_status?: string | null;
  subscription_ends_at?: string | null;
  next_payment_due_at?: string | null;
  monthly_price_usd?: number | null;
  product_limit?: number | null;
  usd_to_bs?: number | null;
  trial_ends_at?: string | null;
  service_fee_payer?: "merchant" | "customer" | null;
  service_fee_billing_cycle?: "weekly" | "monthly" | null;
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

function isStorePastDue(store?: StoreRow | null) {
  return isSubscriptionPastDue(store);
}

function getDefaultStoreId(stores: StoreRow[], currentStoreId: string) {
  if (currentStoreId && stores.some((store) => store.id === currentStoreId)) return currentStoreId;
  return stores.find((store) => isStorePastDue(store))?.id || stores[0]?.id || "";
}

export function SubscriptionPaymentManager() {
  const [pin, setPin] = useState("");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [serviceUsageByStore, setServiceUsageByStore] = useState<Record<string, ServiceUsage>>({});
  const [storeId, setStoreId] = useState("");
  const [billingPeriod] = useState<"monthly" | "annual">("monthly");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentBank, setPaymentBank] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [serviceFeePayer, setServiceFeePayer] = useState<"merchant" | "customer">("merchant");
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
  const dueAt =
    selectedStore?.next_payment_due_at || selectedStore?.subscription_ends_at || selectedStore?.trial_ends_at;
  const isTrial = selectedStore?.subscription_status === "trial" || selectedStore?.plan_type === "trial";
  const isPastDueStatus = ["past_due", "expired", "paused", "cancelled"].includes(
    String(selectedStore?.subscription_status || "").toLowerCase()
  );
  const isPastDueByDate = Boolean(
    dueAt && currentTimeMs !== null && isDateBeforeToday(dueAt, new Date(currentTimeMs))
  );
  const isTrialExpired = Boolean(
    isTrial && dueAt && currentTimeMs !== null && isDateBeforeToday(dueAt, new Date(currentTimeMs))
  );
  const isPerService = ["per_service", "custom"].includes(String(selectedStore?.plan_type || ""));
  const needsPlanChoice = Boolean(selectedStore && !isPerService && (isTrialExpired || isPastDueStatus || isPastDueByDate));
  const amountUsd = useMemo(() => {
    if (needsPlanChoice && selectedPlanId === "per_service") return 0;
    if (isPerService) return serviceUsage.amountUsd;
    const monthly = Number(selectedStore?.monthly_price_usd || 0) || currentPlan.priceUsd;
    return billingPeriod === "annual" ? monthly * 12 : monthly;
  }, [
    billingPeriod,
    currentPlan.priceUsd,
    isPerService,
    needsPlanChoice,
    selectedStore?.monthly_price_usd,
    serviceUsage.amountUsd,
  ]);
  const amountBs = amountUsd * Number(selectedStore?.usd_to_bs || 600);
  const shouldShowPaymentForm = Boolean(
    selectedStore && !isTrial && !needsPlanChoice
  );
  const currentServiceFeePayerLabel =
    selectedStore?.service_fee_payer === "customer" ? "lo paga el cliente" : "lo asume el comercio";

  async function load(currentPin: string, options?: { keepMessage?: boolean }) {
    setIsLoading(true);
    if (!options?.keepMessage) setMessage("");

    try {
      const data = await subscriptionRequest(currentPin);
      const nextStores = data.stores || [];
      setStores(nextStores);
      setPayments(data.payments || []);
      setServiceUsageByStore(data.serviceUsageByStore || {});
      setStoreId((current) => getDefaultStoreId(nextStores, current));
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
          action: needsPlanChoice ? "choose_plan" : "submit_payment",
          planId: needsPlanChoice ? selectedPlanId : selectedStore.plan_type,
          billingPeriod,
          paymentReference,
          paymentBank,
          paidAt,
          notes,
        }),
      });
      const successMessage =
        data.message || "Pago enviado a revisión. Queda pendiente de aprobación por Somos.";
      setPaymentReference("");
      setPaymentBank("");
      setPaidAt("");
      setNotes("");
      await load(pin, { keepMessage: true });
      setMessage(successMessage);
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

  useEffect(() => {
    setServiceFeePayer(selectedStore?.service_fee_payer === "customer" ? "customer" : "merchant");
  }, [selectedStore?.id, selectedStore?.service_fee_payer]);

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
          serviceFeePayer,
        }),
      });
      const successMessage = data.message || "Plan por servicio activado.";
      await load(pin, { keepMessage: true });
      setMessage(successMessage);
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
              La prueba gratis dura 15 días. Al vencer, continúa con el fee por pedido.
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
          <div><p className="text-xs font-black text-[#746f69]">Vence</p><p className="font-black">{formatDate(dueAt)}</p></div>
          <div><p className="text-xs font-black text-[#746f69]">Monto</p><p className="font-black">{formatUsd(amountUsd)} / {formatBs(amountBs)}</p></div>
        </div>

        {(isTrial || needsPlanChoice) ? (
          <section className="mt-4 rounded-[24px] bg-[#FFF8F0] p-4">
            <p className="text-sm font-black text-[#25262B]">
              {needsPlanChoice
                ? "Tu periodo venció. Elige quién asumirá el fee por pedido para continuar."
                : `Estas en prueba gratis hasta ${formatDate(dueAt)}.`}
            </p>
            {needsPlanChoice ? (
              <div className="mt-3 rounded-[22px] bg-[#2E3A79] p-4 text-white">
                <p className="text-base font-black">{publicPlan.name}</p>
                <p className="mt-1 text-sm font-black">
                  ${PER_SERVICE_FEE_USD.toFixed(2)} por pedido en corte mensual
                </p>
                <p className="mt-2 text-xs font-bold opacity-70">
                  Hasta {publicPlan.productLimit} productos. Los planes privados solo pueden ser habilitados por Somos.
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {needsPlanChoice && selectedPlan.id === "per_service" ? (
          <section className="mt-4 rounded-[24px] bg-[#F8F3E8] p-4">
            <p className="text-sm font-black text-[#25262B]">Antes de activar: quien paga el fee?</p>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              El fee es de {formatUsd(PER_SERVICE_FEE_USD)} por pedido y el corte sera mensual.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setServiceFeePayer("merchant")}
                className={[
                  "rounded-[20px] p-4 text-left ring-1",
                  serviceFeePayer === "merchant"
                    ? "bg-[#2E3A79] text-white ring-[#2E3A79]"
                    : "bg-white text-[#25262B] ring-[#25262B]/10",
                ].join(" ")}
              >
                <p className="font-black">Lo asume el comercio</p>
                <p className="mt-1 text-xs font-bold opacity-75">
                  El cliente no ve este cargo; se acumula para el corte mensual.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setServiceFeePayer("customer")}
                className={[
                  "rounded-[20px] p-4 text-left ring-1",
                  serviceFeePayer === "customer"
                    ? "bg-[#2E3A79] text-white ring-[#2E3A79]"
                    : "bg-white text-[#25262B] ring-[#25262B]/10",
                ].join(" ")}
              >
                <p className="font-black">Lo paga el cliente</p>
                <p className="mt-1 text-xs font-bold opacity-75">
                  Se suma al total del pedido como fee de plataforma.
                </p>
              </button>
            </div>
          </section>
        ) : null}

        {isPerService ? (
          <section className="mt-4 rounded-[24px] bg-[#FFF8F0] p-4">
            <p className="text-sm font-black text-[#25262B]">Corte por servicio</p>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Servicios acumulados este periodo: {serviceUsage.serviceCount}. Total del corte:{" "}
              {formatUsd(serviceUsage.amountUsd)}.
            </p>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Fee configurado: {currentServiceFeePayerLabel}.
            </p>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-[#2E3A79]">
              Pago completo acumulado. No se aceptan abonos parciales.
            </p>
            <p className="mt-1 text-xs font-bold text-[#746f69]">
              Cuando el pago sea aprobado por admin, el acumulado vuelve a cero y comienza un nuevo mes de corte.
            </p>
          </section>
        ) : null}

        {needsPlanChoice && selectedPlan.id === "per_service" ? (
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

        {shouldShowPaymentForm ? (
        <>
        <section className="mt-4 rounded-[24px] bg-[#EEF7FF] p-4">
          <p className="text-sm font-black text-[#25262B]">Pago Movil Somos</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {somosPaymentDetails.map((detail) => (
              <div key={detail.label} className="rounded-2xl bg-white px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">{detail.label}</p>
                <p className="mt-1 text-sm font-black text-[#25262B]">{detail.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm font-black text-[#2E3A79]">
            Monto a pagar: {formatUsd(amountUsd)} / {formatBs(amountBs)}
          </p>
          <p className="mt-1 text-xs font-bold text-[#746f69]">
            Con este pago, admin revisa la referencia y activa el plan.
          </p>
        </section>
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
          {isPerService ? "Enviar pago acumulado completo" : "Enviar pago adelantado"}
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
