"use client";

import Link from "next/link";
import { CheckCircle2, Copy, Home, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { SavedOrder, Store } from "@/types";
import { formatBs, formatUsd } from "@/lib/currency";
import { buildPaymentInfo } from "@/lib/payment-display";
import { getOrderKey } from "@/components/public/CheckoutForm";

export function ConfirmationClient({ store }: { store: Store }) {
  const [order, setOrder] = useState<SavedOrder | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentCopied, setPaymentCopied] = useState(false);
  const [copiedPaymentLine, setCopiedPaymentLine] = useState("");
  const [paymentCopyPreview, setPaymentCopyPreview] = useState("");
  const [paymentCopyError, setPaymentCopyError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getOrderKey(store.slug));
      if (!raw) return;
      setOrder(JSON.parse(raw));
    } catch {
      setOrder(null);
    }
  }, [store.slug]);

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
            <h1 className="mt-5 text-3xl font-black">Pedido listo</h1>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-white/72">
              Tu pedido fue registrado. El comercio lo revisará y te confirmará por WhatsApp.
            </p>
          </div>
        </section>

        {order ? (
          <section className="mt-5 rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.07]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#746f69]">
              {order.id}
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#25262B]">{order.storeName}</h2>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-green-50 p-3 text-sm font-black leading-relaxed text-green-700">
                Siguiente paso: revisa los datos de pago y envía la referencia o captura por WhatsApp si ya pagaste.
              </div>
              <div className="flex justify-between gap-4 rounded-2xl bg-[#FFF8F0] p-3 text-sm">
                <span className="font-bold text-[#746f69]">Modalidad</span>
                <span className="font-black text-[#25262B]">
                  {order.form.deliveryType === "delivery" ? "Entrega" : "Retiro"}
                </span>
              </div>
              <div className="flex justify-between gap-4 rounded-2xl bg-[#FFF8F0] p-3 text-sm">
                <span className="font-bold text-[#746f69]">Total</span>
                <span className="font-black text-[#25262B]">
                  {formatUsd(order.totals.totalUsd)} / {formatBs(order.totals.totalBs)}
                </span>
              </div>
              <div className="flex justify-between gap-4 rounded-2xl bg-[#FFF8F0] p-3 text-sm">
                <span className="font-bold text-[#746f69]">Pago</span>
                <span className="font-black text-[#25262B]">
                  {order.form.paymentMethod || "Por confirmar"}
                </span>
              </div>
              {order.quote.distanceKm !== null && order.form.deliveryType === "delivery" ? (
                <div className="flex justify-between gap-4 rounded-2xl bg-[#FFF8F0] p-3 text-sm">
                  <span className="font-bold text-[#746f69]">Distancia</span>
                  <span className="font-black text-[#25262B]">
                    {order.quote.distanceKm.toFixed(2)} km
                  </span>
                </div>
              ) : null}
            </div>

            {paymentInfo ? (
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
                    No hay datos de pago guardados para este método. Si ya los cargaste en configuración, aplica la migración de pagos en Supabase y vuelve a guardar.
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
