"use client";

import Link from "next/link";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { CartItem, Store } from "@/types";
import { getCart, getCartSubtotal, removeCartItem, updateCartItemQuantity } from "@/lib/cart";
import { formatBs, formatUsd } from "@/lib/currency";

export function CartPageClient({ store }: { store: Store }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    function sync() {
      setItems(getCart(store.slug));
    }

    sync();
    window.addEventListener("vendeplus-cart-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("vendeplus-cart-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [store.slug]);

  const subtotal = getCartSubtotal(items);
  const exchangeRate = store.usdToBs || 600;
  const subtotalBs = subtotal * exchangeRate;

  function setQuantity(index: number, quantity: number) {
    updateCartItemQuantity(store.slug, index, quantity);
  }

  function remove(index: number) {
    removeCartItem(store.slug, index);
  }

  return (
    <main className="vp-container pb-10 pt-5">
      <div className="vp-phone-shell">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link href={`/${store.slug}`} className="vp-button-soft px-4 py-3">
            <ArrowLeft size={18} /> Seguir comprando
          </Link>
          <div className="rounded-full bg-[#2E3A79] px-4 py-3 text-sm font-black text-white">Carrito</div>
        </div>

        <section className="overflow-hidden rounded-[36px] bg-[#2E3A79] text-white shadow-2xl shadow-[#2E3A79]/20">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-3xl bg-white/12">
                <ShoppingBag size={25} className="text-[#FFB547]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white/65">{store.name}</p>
                <h1 className="text-3xl font-black">Tu pedido</h1>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-white/72">
              Revisa cantidades, notas y productos antes de finalizar el pedido.
            </p>
          </div>
        </section>

        <section className="mt-5 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-[32px] bg-white p-8 text-center shadow-sm ring-1 ring-[#25262B]/[0.06]">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#FFF8F0] text-[#2E3A79]">
                <ShoppingBag size={28} />
              </div>
              <h2 className="mt-4 text-xl font-black text-[#25262B]">Tu carrito está vacío</h2>
              <p className="mt-2 text-sm font-bold text-[#746f69]">Agrega productos del catálogo para continuar.</p>
              <Link href={`/${store.slug}`} className="vp-button-mango mt-5 w-full">Volver al catálogo</Link>
            </div>
          ) : (
            items.map((item, index) => (
              <article key={`${item.productId}-${item.variantId || "base"}-${index}`} className="rounded-[28px] bg-white p-3 shadow-sm ring-1 ring-[#25262B]/[0.07]">
                <div className="flex gap-3">
                  <img src={item.productImageUrl} alt={item.productName} className="h-24 w-24 rounded-[22px] object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="font-black leading-tight text-[#25262B]">{item.productName}</h2>
                        {item.variantName ? <p className="mt-1 text-xs font-black text-[#746f69]">{item.variantName}</p> : null}
                      </div>
                      <button type="button" onClick={() => remove(index)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {item.notes ? <p className="mt-2 rounded-2xl bg-[#FFF8F0] p-2 text-xs font-bold text-[#746f69]">{item.notes}</p> : null}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-full border border-[#25262B]/10 bg-white p-1">
                        <button type="button" onClick={() => setQuantity(index, item.quantity - 1)} className="grid h-8 w-8 place-items-center rounded-full bg-[#FFF8F0]"><Minus size={14} /></button>
                        <span className="grid min-w-9 place-items-center px-1 text-sm font-black">{item.quantity}</span>
                        <button type="button" onClick={() => setQuantity(index, item.quantity + 1)} className="grid h-8 w-8 place-items-center rounded-full bg-[#FFB547]"><Plus size={14} /></button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#746f69]">{formatUsd(item.unitPriceUsd)} c/u</p>
                        <p className="text-base font-black text-[#25262B]">{formatUsd(item.unitPriceUsd * item.quantity)}</p>
                        <p className="text-xs font-black text-[#746f69]">{formatBs(item.unitPriceUsd * item.quantity * exchangeRate)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>

        {items.length > 0 ? (
          <section className="sticky bottom-4 z-20 mt-5 rounded-[32px] bg-[#25262B] p-3 text-white shadow-2xl shadow-[#25262B]/25">
            <div className="rounded-[26px] bg-white p-4 text-[#25262B]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-[#746f69]">Subtotal</span>
                <div className="text-right">
                  <p className="text-xl font-black">{formatUsd(subtotal)}</p>
                  <p className="text-xs font-black text-[#746f69]">{formatBs(subtotalBs)}</p>
                </div>
              </div>
              <Link href={`/${store.slug}/checkout`} className="vp-button-mango mt-4 w-full">Finalizar pedido</Link>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
