"use client";

import { Check, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { Product, ProductVariant } from "@/types";
import { addToCart } from "@/lib/cart";
import { formatBs, formatUsd } from "@/lib/currency";
import { QuantityControl } from "@/components/public/QuantityControl";

export function ProductCard({
  product,
  storeSlug,
  usdToBs = 600,
}: {
  product: Product;
  storeSlug: string;
  usdToBs?: number;
}) {
  const defaultVariant = product.variants?.find((variant) => variant.isAvailable) || product.variants?.[0] || null;
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(defaultVariant);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState(false);

  const unitPrice = useMemo(() => {
    return product.priceUsd + (selectedVariant?.priceDeltaUsd || 0);
  }, [product.priceUsd, selectedVariant]);
  const unitPriceBs = unitPrice * usdToBs;

  function handleAdd() {
    addToCart(storeSlug, {
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImageUrl: product.imageUrl,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name,
      quantity,
      unitPriceUsd: unitPrice,
      notes: notes.trim() || undefined,
    });

    setAdded(true);
    setNotes("");
    setQuantity(1);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <article className="group overflow-hidden rounded-[32px] bg-white shadow-[0_18px_45px_rgba(46,58,121,0.10)] ring-1 ring-[#25262B]/[0.07]">
      <div className="relative h-48 overflow-hidden bg-[#E8D9C9]">
        <img
          src={product.imageUrl}
          alt={product.imageAlt}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#25262B]/55 via-transparent to-transparent" />
        {product.isFeatured ? (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-3 py-2 text-xs font-black text-[#2E3A79] shadow-lg">
            <Sparkles size={14} className="text-[#FFB547]" /> Recomendado
          </div>
        ) : null}
        <div className="absolute bottom-3 right-3 rounded-2xl bg-[#FFB547] px-3 py-2 text-right text-[#25262B] shadow-lg">
          <p className="text-sm font-black">{formatUsd(unitPrice)}</p>
          <p className="text-[11px] font-black opacity-75">{formatBs(unitPriceBs)}</p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black leading-tight text-[#25262B]">{product.name}</h3>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#746f69]">{product.description}</p>
            </div>
            {product.imageEmoji ? <span className="text-2xl">{product.imageEmoji}</span> : null}
          </div>

          {product.tags?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[#FFF8F0] px-3 py-1 text-xs font-black text-[#746f69]">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {product.variants?.length ? (
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-[#746f69]">Presentación</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((variant) => {
                const active = selectedVariant?.id === variant.id;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    disabled={!variant.isAvailable}
                    onClick={() => setSelectedVariant(variant)}
                    className={active
                      ? "rounded-full bg-[#2E3A79] px-3 py-2 text-xs font-black text-white"
                      : variant.isAvailable
                        ? "rounded-full border border-[#25262B]/10 bg-[#FFF8F0] px-3 py-2 text-xs font-black text-[#746f69]"
                        : "rounded-full border border-[#25262B]/10 bg-[#F5F2EC] px-3 py-2 text-xs font-black text-[#746f69] opacity-50"
                    }
                  >
                    {variant.name}
                    {variant.priceDeltaUsd > 0 ? ` +${formatUsd(variant.priceDeltaUsd)}` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="vp-input min-h-20 resize-none text-sm"
          placeholder="Nota opcional: talla, color, sin cebolla..."
        />

        <div className="flex items-center justify-between gap-3">
          <QuantityControl value={quantity} onChange={setQuantity} />
          <button
            type="button"
            onClick={handleAdd}
            className={added
              ? "inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#6FA64F] px-4 py-3 text-sm font-black text-white"
              : "inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B] shadow-lg shadow-[#FFB547]/25"
            }
          >
            {added ? <Check size={18} /> : <Plus size={18} />}
            {added ? "Agregado" : `Agregar · ${formatUsd(unitPrice * quantity)}`}
          </button>
        </div>
      </div>
    </article>
  );
}
