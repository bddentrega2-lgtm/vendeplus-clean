"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { formatBs, formatUsd } from "@/lib/currency";
import { getCart, getCartCount, getCartSubtotal } from "@/lib/cart";

export function CartBar({
  storeSlug,
  usdToBs = 600,
}: {
  storeSlug: string;
  usdToBs?: number;
}) {
  const [count, setCount] = useState(0);
  const [subtotal, setSubtotal] = useState(0);

  useEffect(() => {
    function sync() {
      const cart = getCart(storeSlug);
      setCount(getCartCount(cart));
      setSubtotal(getCartSubtotal(cart));
    }

    sync();
    window.addEventListener("vendeplus-cart-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("vendeplus-cart-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [storeSlug]);

  if (count === 0) return null;

  return (
    <div className="vp-safe-bottom fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto max-w-[480px] rounded-[28px] bg-[#25262B] p-2 shadow-2xl shadow-[#25262B]/30">
        <Link href={`/${storeSlug}/carrito`} className="flex items-center justify-between gap-3 rounded-[24px] bg-[#2E3A79] p-3 text-white">
          <div className="flex items-center gap-3">
            <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-white/12">
              <ShoppingBag size={22} />
              <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-[#FFB547] px-1 text-xs font-black text-[#25262B]">{count}</span>
            </div>
            <div>
              <p className="text-xs font-bold text-white/70">Tu carrito</p>
              <p className="text-base font-black">{formatUsd(subtotal)}</p>
              <p className="text-[11px] font-black text-white/60">{formatBs(subtotal * usdToBs)}</p>
            </div>
          </div>
          <span className="rounded-full bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B]">Ver carrito</span>
        </Link>
      </div>
    </div>
  );
}
