"use client";

import NextImage from "next/image";
import { Check, Loader2, RefreshCcw, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { apiRequest, getPaymentStatusLabel, type OrderRow } from "./orders-manager-helpers";

export function PaymentReviewDialog({ order, pin, onClose, onVerify }: {
  order: Pick<OrderRow, "id" | "public_code" | "has_payment_receipt" | "payment_reference"> & { payment_method: string | null; payment_status?: string | null };
  pin: string;
  onClose: () => void;
  onVerify?: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(order.has_payment_receipt === true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const verifyingRef = useRef(false);
  const [paymentError, setPaymentError] = useState("");

  async function verifyPayment() {
    if (!onVerify || verifyingRef.current) return;
    verifyingRef.current = true;
    setIsVerifying(true);
    setPaymentError("");
    try { await onVerify(); }
    catch (reason) { setPaymentError(reason instanceof Error ? reason.message : "No se pudo confirmar el pago."); }
    finally { verifyingRef.current = false; setIsVerifying(false); }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    let active = true;
    setImageUrl(null);
    setError("");
    setIsLoading(order.has_payment_receipt === true);
    if (order.has_payment_receipt) {
      void apiRequest(pin, `/api/panel/orders/${encodeURIComponent(order.id)}/payment-receipt`, { cache: "no-store", signal: AbortSignal.timeout(15_000) })
        .then((data) => {
          if (!data.url) throw new Error("El comprobante ya no está disponible.");
          if (active) setImageUrl(data.url);
        })
        .catch((reason) => {
          if (active) setError(reason instanceof Error ? reason.message : "No se pudo abrir el comprobante.");
        })
        .finally(() => { if (active) setIsLoading(false); });
    }
    return () => { active = false; };
  }, [order.id, order.has_payment_receipt, pin, attempt]);

  return <dialog ref={dialogRef} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg bg-white p-4 text-[#25262B] shadow-2xl backdrop:bg-black/60">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 break-words">
        <h2 id={titleId} className="text-lg font-black">Revisar pago</h2>
        <p className="mt-1 font-bold">{order.public_code}</p>
        <p className="text-sm font-bold text-[#746f69]">{order.payment_method}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Cerrar revisión de pago"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F8F3E8]">
        <X size={18} />
      </button>
    </div>
    {order.payment_reference ? <p className="mt-4 break-all rounded-lg bg-blue-50 p-3 text-sm font-black text-blue-800">
      Referencia: {order.payment_reference}
    </p> : null}
    {isLoading ? <div role="status" aria-label="Cargando comprobante" className="mt-4 grid h-64 place-items-center rounded-lg bg-[#F8F3E8]">
      <Loader2 className="animate-spin text-[#2E3A79]" size={28} />
    </div> : imageUrl ? <div className="relative mt-4 h-[min(60dvh,520px)] overflow-hidden rounded-lg bg-[#F8F3E8]">
      <NextImage src={imageUrl} alt={`Comprobante del pedido ${order.public_code}`} fill unoptimized className="object-contain"
        onError={() => { setImageUrl(null); setError("No se pudo cargar la imagen del comprobante."); }} />
    </div> : null}
    {error ? <div className="mt-4">
      <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>
      <button type="button" className="vp-button-soft mt-3" onClick={() => setAttempt((value) => value + 1)}>
        <RefreshCcw size={16} /> Reintentar
      </button>
    </div> : null}
    {!order.has_payment_receipt && !order.payment_reference ? <p className="mt-4 text-sm font-bold text-[#746f69]">Sin comprobante ni referencia.</p> : null}
    {onVerify ? <div className="mt-4 border-t border-[#25262B]/10 pt-3">
      <p role="status" className="text-sm font-bold">{getPaymentStatusLabel(order.payment_status)}</p>
      {order.payment_status !== "verified" ? <button type="button" className="vp-button-primary mt-3 w-full disabled:opacity-50" disabled={isVerifying} onClick={() => void verifyPayment()}>
        {isVerifying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {isVerifying ? "Guardando..." : "Marcar como pagado"}
      </button> : null}
      {paymentError ? <p role="alert" className="mt-3 text-sm font-bold text-red-700">{paymentError}</p> : null}
    </div> : null}
  </dialog>;
}
