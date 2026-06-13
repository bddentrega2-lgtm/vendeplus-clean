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
  const defaultVariant =
    product.variants?.find((variant) => variant.isAvailable) ||
    product.variants?.[0] ||
    null;
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    defaultVariant
  );
  const [quantity, setQuantity] = useState(1);
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
    });

    setAdded(true);
    setQuantity(1);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <article className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#25262B]/[0.07]">
      <div className="relative h-32 overflow-hidden bg-[#E8D9C9]">
        <img
          src={product.imageUrl}
          alt={product.imageAlt}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#25262B]/45 via-transparent to-transparent" />
        {product.isFeatured ? (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-[#2E3A79] shadow-lg">
            <Sparkles size={13} className="text-[#FFB547]" /> Recomendado
          </div>
        ) : null}
        <div className="absolute bottom-3 right-3 rounded-2xl bg-white/95 px-3 py-2 text-right text-[#25262B] shadow-lg">
          <p className="text-sm font-black">{formatUsd(unitPrice)}</p>
          <p className="text-[11px] font-black opacity-75">{formatBs(unitPriceBs)}</p>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-black leading-tight text-[#25262B]">
                {product.name}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-[#746f69]">
                {product.description}
              </p>
            </div>
            {product.imageEmoji ? (
              <span className="text-xl">{product.imageEmoji}</span>
            ) : null}
          </div>

          {product.tags?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {product.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#FFF8F0] px-2.5 py-1 text-[11px] font-black text-[#746f69]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {product.variants?.length ? (
          <div>
            <p className="mb-2 text-[11px] font-black uppercase text-[#746f69]">
              Presentacion
            </p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((variant) => {
                const active = selectedVariant?.id === variant.id;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    disabled={!variant.isAvailable}
                    onClick={() => setSelectedVariant(variant)}
                    className={
                      active
                        ? "rounded-full bg-[#2E3A79] px-3 py-2 text-xs font-black text-white"
                        : variant.isAvailable
                          ? "rounded-full border border-[#25262B]/10 bg-[#FFF8F0] px-3 py-2 text-xs font-black text-[#746f69]"
                          : "rounded-full border border-[#25262B]/10 bg-[#F5F2EC] px-3 py-2 text-xs font-black text-[#746f69] opacity-50"
                    }
                  >
                    {variant.name}
                    {variant.priceDeltaUsd > 0
                      ? ` +${formatUsd(variant.priceDeltaUsd)}`
                      : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <QuantityControl value={quantity} onChange={setQuantity} />
          <button
            type="button"
            onClick={handleAdd}
            className={
              added
                ? "inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#6FA64F] px-4 py-3 text-sm font-black text-white"
                : "inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B] shadow-lg shadow-[#FFB547]/25"
            }
          >
            {added ? <Check size={18} /> : <Plus size={18} />}
            {added ? "Agregado" : "Agregar"}
          </button>
        </div>
      </div>
    </article>
  );
}
