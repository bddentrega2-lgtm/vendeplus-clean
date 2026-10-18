"use client";

import { Check, Loader2, RefreshCw, Trash2 } from "lucide-react";
import type { useCartReview } from "@/hooks/use-cart-review";
import { formatBaseCurrency } from "@/lib/currency";

export function CartReviewNotice({ cart, storeSlug, currency, disabled = false }: {
  cart: ReturnType<typeof useCartReview>; storeSlug: string; currency: string; disabled?: boolean;
}) {
  if (cart.checking) return <p role="status" className="my-3 flex items-center gap-2 text-sm font-semibold"><Loader2 size={16} className="animate-spin" /> Revisando tu carrito...</p>;
  if (cart.error) return <div role="alert" className="my-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
    <p>{cart.error}</p><button type="button" onClick={cart.retry} disabled={disabled} className="mt-2 inline-flex min-h-10 items-center gap-2 font-bold"><RefreshCw size={16} /> Reintentar</button>
  </div>;
  if (!cart.review?.issues.length) return null;
  return <div role="alert" className="my-3 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-[#25262B]">
    <p className="font-bold">Revisa estos cambios</p>
    {cart.review.issues.map(issue => <div key={`${issue.index}-${issue.kind}`} className="min-w-0 border-t border-amber-200 pt-2">
      <p className="break-words font-bold">{cart.items[issue.index]?.productName}</p>
      <p className="mt-1">{issue.message}</p>
      {issue.kind === "price" ? <p className="mt-1 font-bold"><span className="mr-2 font-normal line-through">{formatBaseCurrency(cart.items[issue.index]?.unitPriceUsd || 0, currency)}</span>{formatBaseCurrency(cart.review!.items[issue.index].unitPriceUsd, currency)} c/u</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {issue.kind === "price" ? <button type="button" disabled={disabled} onClick={() => cart.change(issue.index, "price")} className="inline-flex min-h-11 items-center gap-1 font-bold text-emerald-800"><Check size={17} /> Aceptar precio</button> : null}
        <button type="button" disabled={disabled} onClick={() => cart.change(issue.index, "remove")} className="inline-flex min-h-11 items-center gap-1 font-bold text-red-700"><Trash2 size={17} /> Quitar</button>
      </div>
    </div>)}
    <a href={`/${storeSlug}?revisar=carrito`} className="inline-block py-2 font-bold underline">Elegir en el catálogo</a>
  </div>;
}
