"use client";

import Link from "next/link";
import { Camera, CheckCircle2, Circle, Copy, Home, MessageCircle, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";
import type { SavedOrder, Store } from "@/types";
import { formatBaseCurrency, formatBs } from "@/lib/currency";
import { buildPaymentInfo } from "@/lib/payment-display";
import { getOrderKey } from "@/components/public/CheckoutForm";

export function ConfirmationClient({ store }: { store: Store }) {
  const [order, setOrder] = useState<SavedOrder | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentCopied, setPaymentCopied] = useState(false);
  const [copiedPaymentLine, setCopiedPaymentLine] = useState("");
  const [paymentCopyPreview, setPaymentCopyPreview] = useState("");
  const [paymentCopyError, setPaymentCopyError] = useState("");
  const [tableStatus, setTableStatus] = useState("received");
  const showPricesInBs = store.showPricesInBs !== false;
  const baseCurrency = store.baseCurrency || "USD";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getOrderKey(store.slug));
      if (!raw) return;
      setOrder(JSON.parse(raw));
    } catch {
      setOrder(null);
    }
  }, [store.slug]);

  useEffect(() => {
    if (!order?.databaseId || !order.tableOrder?.storeToken) return;

    let active = true;
    const refreshStatus = async () => {
      try {
        const params = new URLSearchParams({
          orderId: order.databaseId || "",
          token: order.tableOrder?.storeToken || "",
        });
        const response = await fetch(`/api/table-orders/status?${params}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (active && payload.order?.status) setTableStatus(payload.order.status);
      } catch {
        // The last known state remains visible during a temporary connection issue.
      }
    };

    void refreshStatus();
    const intervalId = window.setInterval(refreshStatus, 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [order]);

  const paymentInfo = order
    ? buildPaymentInfo({
        store,
        paymentMethod: order.form.paymentMethod,
        totals: order.totals,
        orderId: order.id,
        customerPaymentNote: order.form.notes,
        paymentReference: order.form.paymentReference,
      })
    : null;

  async function copyMessage() {
    if (!order) return;
    await navigator.clipboard.writeText(order.whatsappMessage);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function copyPaymentData() {
    if (!paymentInfo) return;
    setPaymentCopyError("");
    setPaymentCopyPreview(paymentInfo.copyText);

    try {
      await navigator.clipboard.writeText(paymentInfo.copyText);
      setPaymentCopied(true);
      window.setTimeout(() => setPaymentCopied(false), 1800);
    } catch {
      setPaymentCopyError("No se pudo copiar automaticamente. Puedes copiar el texto mostrado abajo.");
    }
  }

  async function copyPaymentLine(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedPaymentLine(`${label}-${value}`);
    window.setTimeout(() => setCopiedPaymentLine(""), 1800);
  }

  return (
    <main className="vp-container pb-10 pt-8">
      <div className="vp-phone-shell">
        <section className="overflow-hidden rounded-[38px] bg-[#2E3A79] text-white shadow-2xl shadow-[#2E3A79]/25">
          <div className="p-7 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-[30px] bg-[#FFB547] text-[#25262B] shadow-xl shadow-[#FFB547]/20">
              <CheckCircle2 size={40} />
            </div>
            <h1 className="mt-5 text-3xl font-black">Pedido enviado</h1>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-white/72">
              {order?.form.deliveryType === "table"
                ? "Tu pedido fue registrado. Puedes seguir su preparación en esta pantalla."
                : "Tu pedido fue registrado. El comercio lo revisará y te confirmará por WhatsApp."}
            </p>
          </div>
        </section>

        {order ? (
          <section className="mt-5 rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.07]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#746f69]">
              {order.id}
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#25262B]">{order.storeName}</h2>

            {order.tableOrder ? (
              <div className="mt-5 rounded-[26px] bg-[#F3F5FF] p-4 ring-1 ring-[#2E3A79]/10">
                <div className="flex items-center gap-2 text-[#2E3A79]">
                  <UtensilsCrossed size={18} />
                  <p className="font-black">
                    {order.tableOrder.tableName}
                    {order.tableOrder.tableZone ? ` · ${order.tableOrder.tableZone}` : ""}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-1" aria-label="Estado del pedido">
                  {[
                    ["received", "Enviado"],
                    ["accepted", "Aprobado"],
                    ["preparing", "Preparando"],
                    ["ready", "Listo"],
                  ].map(([status, label], index, statuses) => {
                    const currentIndex = statuses.findIndex(([value]) => value === tableStatus);
                    const isDone = tableStatus === "completed" || (currentIndex >= 0 && index <= currentIndex);
                    return (
                      <div key={status} className="min-w-0 text-center">
                        {isDone ? (
                          <CheckCircle2 className="mx-auto text-green-600" size={20} />
                        ) : (
                          <Circle className="mx-auto text-[#2E3A79]/25" size={20} />
                        )}
                        <span className="mt-1 block text-[10px] font-black text-[#746f69]">{label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-900 ring-1 ring-amber-200">
                  <Camera className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                  <p className="text-xs font-black leading-relaxed">
                    Haz una captura de esta pantalla para confirmar tu pedido cuando esté listo.
                  </p>
                </div>
                {tableStatus === "cancelled" ? (
                  <p className="mt-3 rounded-xl bg-red-50 p-2 text-center text-xs font-black text-red-700">
                    El pedido fue cancelado. Consulta al personal.
                  </p>
                ) : tableStatus === "ready" || tableStatus === "completed" ? (
                  <p className="mt-3 rounded-xl bg-green-50 p-3 text-center text-sm font-black text-green-700">
                    {order.tableOrder.fulfillmentMode === "counter_pickup"
                      ? "Tu pedido está listo. Retíralo en la barra."
                      : `Tu pedido está listo. Te lo llevaremos a ${order.tableOrder.tableName}.`}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              {order.form.deliveryType !== "table" ? (
                <div className="rounded-2xl bg-green-50 p-3 text-sm font-black leading-relaxed text-green-700">
                  Siguiente paso: revisa los datos de pago y envia la referencia o captura por WhatsApp si ya pagaste.
                </div>
              ) : null}
              <div className="flex justify-between gap-4 rounded-2xl bg-[#FFF8F0] p-3 text-sm">
                <span className="font-bold text-[#746f69]">Modalidad</span>
                <span className="font-black text-[#25262B]">
                  {order.form.deliveryType === "table"
                    ? order.tableOrder?.tableName || "Mesa"
                    : order.form.deliveryType === "delivery"
                    ? "Delivery"
                    : order.form.deliveryType === "national_shipping"
                      ? "Envio nacional"
                      : "Retiro (pick up)"}
                </span>
              </div>
              {order.form.deliveryType === "table" && order.form.paymentReference ? (
                <div className="flex justify-between gap-4 rounded-2xl bg-green-50 p-3 text-sm">
                  <span className="font-bold text-green-700">Referencia recibida</span>
                  <span className="break-all text-right font-black text-green-800">
                    {order.form.paymentReference}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 rounded-2xl bg-[#FFF8F0] p-3 text-sm">
                <span className="font-bold text-[#746f69]">Total</span>
                <span className="font-black text-[#25262B]">
                  {formatBaseCurrency(order.totals.totalUsd, baseCurrency)}
                  {showPricesInBs ? ` / ${formatBs(order.totals.totalBs)}` : ""}
                </span>
              </div>
              <div className="flex justify-between gap-4 rounded-2xl bg-[#FFF8F0] p-3 text-sm">
                <span className="font-bold text-[#746f69]">Pago</span>
                <span className="font-black text-[#25262B]">
                  {order.form.paymentMethod || "Por confirmar"}
                </span>
              </div>
              {order.form.deliveryType === "national_shipping" ? (
                <div className="space-y-2 rounded-2xl bg-[#FFF8F0] p-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="font-bold text-[#746f69]">Cedula</span>
                    <span className="font-black text-[#25262B]">{order.form.nationalIdNumber || "Por confirmar"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-bold text-[#746f69]">Ciudad</span>
                    <span className="font-black text-[#25262B]">{order.form.nationalShippingCity || "Por confirmar"}</span>
                  </div>
                </div>
              ) : order.form.deliveryType === "delivery" ? (
                <div className="flex justify-between gap-4 rounded-2xl bg-[#FFF8F0] p-3 text-sm">
                  <span className="font-bold text-[#746f69]">Entrega</span>
                  <span className="font-black text-[#25262B]">
                    {order.quote.zoneName ||
                      order.quote.message ||
                      (order.quote.distanceKm !== null
                        ? `${order.quote.distanceKm.toFixed(2)} km`
                        : order.quote.label)}
                  </span>
                </div>
              ) : null}
            </div>

            {paymentInfo && order.form.deliveryType !== "table" ? (
              <div className="mt-5 rounded-[26px] bg-[#2E3A79] p-4 text-white">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFB547]">
                  Datos para realizar el pago
                </p>
                <h3 className="mt-1 text-xl font-black">{paymentInfo.title}</h3>

                <div className="mt-4 space-y-2">
                  {paymentInfo.lines.length ? (
                    paymentInfo.lines.map((line) => {
                      const copiedKey = `${line.label}-${line.value}`;

                      return (
                        <div
                          key={`${line.label}-${line.value}`}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-3 text-sm"
                        >
                          <div className="min-w-0">
                            <span className="block font-bold text-white/70">{line.label}</span>
                            <span className="block break-words font-black">{line.value}</span>
                          </div>
                          {line.copyable ? (
                            <button
                              type="button"
                              onClick={() => copyPaymentLine(line.label, line.value)}
                              className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-[#2E3A79]"
                            >
                              {copiedPaymentLine === copiedKey ? "Copiado" : "Copiar"}
                            </button>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="rounded-2xl bg-white/10 p-3 text-sm font-bold text-white/75">
                      El comercio te confirmara los datos de pago por WhatsApp.
                    </p>
                  )}
                </div>

                <p className="mt-3 text-sm font-semibold leading-relaxed text-white/75">
                  {paymentInfo.help}
                </p>

                {!paymentInfo.hasConfiguredData ? (
                  <p className="mt-3 rounded-2xl bg-white/10 p-3 text-xs font-black text-white">
                    No hay datos de pago guardados para este metodo. Confirmalos por WhatsApp con el comercio.
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={copyPaymentData}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
                >
                  <Copy size={18} />
                  {paymentCopied ? "Datos copiados" : "Copiar datos de pago"}
                </button>

                {paymentCopyError ? (
                  <p className="mt-3 rounded-2xl bg-white/10 p-3 text-xs font-black text-white">
                    {paymentCopyError}
                  </p>
                ) : null}

                {paymentCopyPreview ? (
                  <div className="mt-3 rounded-2xl bg-white/10 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#FFB547]">
                      Texto copiado
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs font-bold leading-relaxed text-white/85">
                      {paymentCopyPreview}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3">
              {order.form.deliveryType !== "table" ? (
                <>
                  <a
                    href={order.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vp-button-mango w-full"
                  >
                    <MessageCircle size={18} /> Enviar comprobante por WhatsApp
                  </a>
                  <button type="button" onClick={copyMessage} className="vp-button-soft w-full">
                    <Copy size={18} /> {copied ? "Copiado" : "Copiar pedido"}
                  </button>
                </>
              ) : null}
              <Link href={`/${store.slug}`} className="vp-button-primary w-full">
                <Home size={18} /> Volver al catalogo
              </Link>
            </div>
          </section>
        ) : (
          <section className="mt-5 rounded-[34px] bg-white p-5 text-center shadow-xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.07]">
            <h2 className="text-xl font-black text-[#25262B]">No encontramos un pedido reciente</h2>
            <p className="mt-2 text-sm font-bold text-[#746f69]">
              Vuelve al catalogo y realiza un nuevo pedido.
            </p>
            <Link href={`/${store.slug}`} className="vp-button-mango mt-5 w-full">
              Volver al catalogo
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
