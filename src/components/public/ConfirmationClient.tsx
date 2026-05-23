"use client";

import Link from "next/link";
import { CheckCircle2, Copy, Home, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { SavedOrder, Store } from "@/types";
import { formatBs, formatUsd } from "@/lib/currency";
import { getOrderKey } from "@/components/public/CheckoutForm";

export function ConfirmationClient({ store }: { store: Store }) {
  const [order, setOrder] = useState<SavedOrder | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getOrderKey(store.slug));
      if (!raw) return;
      setOrder(JSON.parse(raw));
    } catch {
      setOrder(null);
    }
  }, [store.slug]);

  async function copyMessage() {
    if (!order) return;
    await navigator.clipboard.writeText(order.whatsappMessage);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
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
              El pedido fue preparado para WhatsApp. Si WhatsApp no abrió, puedes copiarlo o reenviarlo desde aquí.
            </p>
          </div>
        </section>

        {order ? (
          <section className="mt-5 rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.07]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#746f69]">{order.id}</p>
            <h2 className="mt-1 text-2xl font-black text-[#25262B]">{order.storeName}</h2>

            <div className="mt-5 space-y-3">
              <div className="flex justify-between gap-4 rounded-2xl bg-[#FFF8F0] p-3 text-sm">
                <span className="font-bold text-[#746f69]">Modalidad</span>
                <span className="font-black text-[#25262B]">{order.form.deliveryType === "delivery" ? "Delivery" : "Pickup"}</span>
              </div>
              <div className="flex justify-between gap-4 rounded-2xl bg-[#FFF8F0] p-3 text-sm">
                <span className="font-bold text-[#746f69]">Total</span>
                <span className="font-black text-[#25262B]">{formatUsd(order.totals.totalUsd)} · {formatBs(order.totals.totalBs)}</span>
              </div>
              {order.quote.distanceKm !== null && order.form.deliveryType === "delivery" ? (
                <div className="flex justify-between gap-4 rounded-2xl bg-[#FFF8F0] p-3 text-sm">
                  <span className="font-bold text-[#746f69]">Distancia</span>
                  <span className="font-black text-[#25262B]">{order.quote.distanceKm.toFixed(2)} km</span>
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3">
              <a href={order.whatsappUrl} target="_blank" rel="noopener noreferrer" className="vp-button-mango w-full">
                <MessageCircle size={18} /> Reenviar por WhatsApp
              </a>
              <button type="button" onClick={copyMessage} className="vp-button-soft w-full">
                <Copy size={18} /> {copied ? "Copiado" : "Copiar pedido"}
              </button>
              <Link href={`/${store.slug}`} className="vp-button-primary w-full">
                <Home size={18} /> Volver al catálogo
              </Link>
            </div>
          </section>
        ) : (
          <section className="mt-5 rounded-[34px] bg-white p-5 text-center shadow-xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.07]">
            <h2 className="text-xl font-black text-[#25262B]">No encontramos un pedido reciente</h2>
            <p className="mt-2 text-sm font-bold text-[#746f69]">Vuelve al catálogo y realiza un nuevo pedido.</p>
            <Link href={`/${store.slug}`} className="vp-button-mango mt-5 w-full">Volver al catálogo</Link>
          </section>
        )}
      </div>
    </main>
  );
}
