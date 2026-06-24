"use client";

import { Check, Plus, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Product, ProductVariant, SelectedCartOption } from "@/types";
import { addToCart } from "@/lib/cart";
import { formatBs, formatUsd } from "@/lib/currency";
import { QuantityControl } from "@/components/public/QuantityControl";

type SelectionMap = Record<string, string[]>;

function buildSelectedOptions(product: Product, selections: SelectionMap) {
  return (product.optionGroups || []).flatMap((group) => {
    const selectedIds = selections[group.id] || [];

    return selectedIds
      .map((valueId) => {
        const value = group.values.find((option) => option.id === valueId);
        if (!value) return null;

        return {
          groupId: group.id,
          groupName: group.name,
          valueId: value.id,
          valueName: value.name,
          priceDeltaUsd: value.priceDeltaUsd,
        } satisfies SelectedCartOption;
      })
      .filter(Boolean) as SelectedCartOption[];
  });
}

function ProductOptionsSheet({
  product,
  storeSlug,
  usdToBs,
  quantity,
  selectedVariant,
  baseUnitPrice,
  onClose,
  onAdded,
}: {
  product: Product;
  storeSlug: string;
  usdToBs: number;
  quantity: number;
  selectedVariant: ProductVariant | null;
  baseUnitPrice: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const initialSelections = useMemo(() => {
    return {};
  }, []);
  const [selections, setSelections] = useState<SelectionMap>(initialSelections);
  const [message, setMessage] = useState("");

  const selectedOptions = useMemo(
    () => buildSelectedOptions(product, selections),
    [product, selections]
  );
  const extrasUsd = selectedOptions.reduce(
    (sum, option) => sum + option.priceDeltaUsd,
    0
  );
  const unitPrice = baseUnitPrice + extrasUsd;
  const totalUsd = unitPrice * quantity;

  function toggleOption(groupId: string, valueId: string) {
    const group = product.optionGroups?.find((item) => item.id === groupId);
    if (!group) return;

    setMessage("");
    setSelections((current) => {
      const currentIds = current[groupId] || [];

      if (group.selectionType === "single") {
        return { ...current, [groupId]: [valueId] };
      }

      const isSelected = currentIds.includes(valueId);
      const nextIds = isSelected
        ? currentIds.filter((id) => id !== valueId)
        : [...currentIds, valueId];
      const maxSelect = group.maxSelect > 0 ? group.maxSelect : group.values.length;

      if (!isSelected && nextIds.length > maxSelect) {
        setMessage(`Puedes elegir hasta ${maxSelect} opciones en ${group.name}.`);
        return current;
      }

      return { ...current, [groupId]: nextIds };
    });
  }

  function validateSelections() {
    for (const group of product.optionGroups || []) {
      const selectedCount = selections[group.id]?.length || 0;
      const minSelect = group.required ? Math.max(1, group.minSelect) : 0;

      if (selectedCount < minSelect) {
        return `Selecciona una opción para continuar en ${group.name}.`;
      }

      if (group.maxSelect > 0 && selectedCount > group.maxSelect) {
        return `Reduce la selección en ${group.name}.`;
      }
    }

    return "";
  }

  function addCustomizedProduct() {
    const validation = validateSelections();
    if (validation) {
      setMessage(validation);
      return;
    }

    addToCart(storeSlug, {
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImageUrl: product.imageUrl,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name,
      quantity,
      unitPriceUsd: unitPrice,
      selectedOptions,
    });

    onAdded();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-[#25262B]/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="max-h-[88vh] w-full overflow-y-auto rounded-[28px] bg-white p-4 pb-6 shadow-2xl sm:max-w-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
              Personaliza tu producto
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#25262B]">
              {product.name}
            </h2>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Base: {formatUsd(baseUnitPrice)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-[#F8F3E8] text-[#2E3A79]"
            aria-label="Cerrar personalización"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {(product.optionGroups || []).map((group) => {
            const selectedIds = selections[group.id] || [];
            const maxSelect = group.maxSelect > 0 ? group.maxSelect : group.values.length;
            const instruction =
              group.selectionType === "single"
                ? group.required
                  ? "Selecciona 1 opción"
                  : "Puedes elegir 1 opción"
                : `Puedes elegir hasta ${maxSelect}`;

            return (
              <fieldset key={group.id} className="rounded-2xl bg-[#FFF8F0] p-3">
                <legend className="text-sm font-black text-[#25262B]">
                  <span className="flex flex-wrap items-center gap-2">
                    {group.name}
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-[11px] font-black",
                        group.required
                          ? "bg-[#FFB547] text-[#25262B]"
                          : "bg-white text-[#746f69]",
                      ].join(" ")}
                    >
                      {group.required ? "Obligatorio" : "Opcional"}
                    </span>
                  </span>
                </legend>
                <p className="mt-1 text-xs font-bold text-[#746f69]">
                  {instruction}
                  {group.description ? ` · ${group.description}` : ""}
                </p>
                <div className="mt-3 grid gap-2">
                  {group.values.map((value) => {
                    const active = selectedIds.includes(value.id);
                    const controlType =
                      group.selectionType === "single" ? "radio" : "checkbox";

                    return (
                      <label
                        key={value.id}
                        className={[
                          "flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm font-black ring-1",
                          active
                            ? "bg-[#2E3A79] text-white ring-[#2E3A79]"
                            : "bg-white text-[#25262B] ring-[#25262B]/[0.07]",
                        ].join(" ")}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <input
                            type={controlType}
                            name={group.id}
                            checked={active}
                            onChange={() => toggleOption(group.id, value.id)}
                            className="h-4 w-4"
                          />
                          <span className="truncate">{value.name}</span>
                        </span>
                        <span className={active ? "text-white" : "text-[#746f69]"}>
                          {value.priceDeltaUsd > 0
                            ? `+${formatUsd(value.priceDeltaUsd)}`
                            : "+$0.00"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>

        {message ? (
          <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-black text-red-700">
            {message}
          </p>
        ) : null}

        <div className="sticky bottom-0 mt-4 rounded-2xl bg-white pt-3">
          <div className="mb-3 flex items-end justify-between gap-3 rounded-2xl bg-[#F8F3E8] p-3">
            <span className="text-sm font-bold text-[#746f69]">Total</span>
            <div className="text-right">
              <p className="text-xl font-black text-[#25262B]">
                {formatUsd(totalUsd)}
              </p>
              <p className="text-xs font-black text-[#746f69]">
                {formatBs(totalUsd * usdToBs)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={addCustomizedProduct}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
          >
            <Plus size={18} />
            Agregar al carrito
          </button>
        </div>
      </section>
    </div>
  );
}

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
  const [isCustomizing, setIsCustomizing] = useState(false);

  const unitPrice = useMemo(() => {
    return product.priceUsd + (selectedVariant?.priceDeltaUsd || 0);
  }, [product.priceUsd, selectedVariant]);
  const unitPriceBs = unitPrice * usdToBs;

  function handleAdd() {
    if (product.optionGroups?.length) {
      setIsCustomizing(true);
      return;
    }

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

  function markAdded() {
    setAdded(true);
    setQuantity(1);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <article className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#25262B]/[0.07]">
      <div className="relative h-40 overflow-hidden bg-[#F8F3E8] sm:h-44">
        <img
          src={product.imageUrl}
          alt={product.imageAlt}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          decoding="async"
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
            {added
              ? "Agregado"
              : product.optionGroups?.length
                ? "Personalizar"
                : "Agregar"}
          </button>
        </div>
      </div>
      {isCustomizing ? (
        <ProductOptionsSheet
          product={product}
          storeSlug={storeSlug}
          usdToBs={usdToBs}
          quantity={quantity}
          selectedVariant={selectedVariant}
          baseUnitPrice={unitPrice}
          onClose={() => setIsCustomizing(false)}
          onAdded={markAdded}
        />
      ) : null}
    </article>
  );
}

export function ProductListItem({
  product,
  storeSlug,
  usdToBs = 600,
  cartQuantity = 0,
}: {
  product: Product;
  storeSlug: string;
  usdToBs?: number;
  cartQuantity?: number;
}) {
  const defaultVariant =
    product.variants?.find((variant) => variant.isAvailable) ||
    product.variants?.[0] ||
    null;
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    defaultVariant
  );
  const [added, setAdded] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);

  const unitPrice = useMemo(() => {
    return product.priceUsd + (selectedVariant?.priceDeltaUsd || 0);
  }, [product.priceUsd, selectedVariant]);

  function handleAdd() {
    if (product.optionGroups?.length) {
      setIsCustomizing(true);
      return;
    }

    addToCart(storeSlug, {
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImageUrl: product.imageUrl,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name,
      quantity: 1,
      unitPriceUsd: unitPrice,
    });

    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  function markAdded() {
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  return (
    <article className="rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-[#25262B]/[0.07]">
      <div className="grid grid-cols-[72px_1fr_auto] gap-3">
        <img
          src={product.imageUrl}
          alt={product.imageAlt}
          className="h-[72px] w-[72px] rounded-2xl bg-[#F8F3E8] object-cover"
          decoding="async"
          loading="lazy"
        />
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-black leading-tight text-[#25262B]">
                {product.name}
              </h3>
              <p className="mt-1 line-clamp-1 text-xs font-semibold text-[#746f69]">
                {product.description}
              </p>
            </div>
          </div>

          {product.variants?.length ? (
            <select
              value={selectedVariant?.id || ""}
              onChange={(event) =>
                setSelectedVariant(
                  product.variants?.find(
                    (variant) => variant.id === event.target.value
                  ) || null
                )
              }
              className="mt-2 w-full rounded-xl border border-[#25262B]/10 bg-[#FFF8F0] px-3 py-2 text-xs font-black text-[#746f69] outline-none"
            >
              {product.variants.map((variant) => (
                <option
                  key={variant.id}
                  value={variant.id}
                  disabled={!variant.isAvailable}
                >
                  {variant.name}
                  {variant.priceDeltaUsd > 0
                    ? ` +${formatUsd(variant.priceDeltaUsd)}`
                    : ""}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="flex w-28 flex-col items-end justify-between gap-2">
          {cartQuantity > 0 ? (
            <span className="rounded-full bg-[#2E3A79] px-2 py-1 text-[11px] font-black text-white">
              {cartQuantity}
            </span>
          ) : (
            <span />
          )}
          <div className="text-right">
            <p className="text-sm font-black text-[#25262B]">{formatUsd(unitPrice)}</p>
            <p className="text-[11px] font-black text-[#746f69]">
              {formatBs(unitPrice * usdToBs)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className={[
              "inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full px-3 text-xs font-black",
              added
                ? "bg-[#6FA64F] text-white"
                : "bg-[#FFB547] text-[#25262B]",
            ].join(" ")}
          >
            {added ? <Check size={15} /> : <Plus size={15} />}
            {added ? "Listo" : product.optionGroups?.length ? "Elegir" : "Sumar"}
          </button>
        </div>
      </div>
      {isCustomizing ? (
        <ProductOptionsSheet
          product={product}
          storeSlug={storeSlug}
          usdToBs={usdToBs}
          quantity={1}
          selectedVariant={selectedVariant}
          baseUnitPrice={unitPrice}
          onClose={() => setIsCustomizing(false)}
          onAdded={markAdded}
        />
      ) : null}
    </article>
  );
}
