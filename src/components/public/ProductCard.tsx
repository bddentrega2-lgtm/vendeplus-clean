"use client";

import { Check, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Product, ProductInventorySku, ProductOptionGroup, ProductOptionValue, ProductVariant, SelectedCartOption } from "@/types";
import { addToCart } from "@/lib/cart";
import { formatBaseCurrency, formatBs } from "@/lib/currency";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

type SelectionMap = Record<string, string[]>;

function inventorySkuLabel(attributes: Record<string, string>, fallback: string) {
  const labels = ["color", "talla", "detalle"]
    .map((key) => String(attributes[key] || "").trim())
    .filter(Boolean);
  return labels.length ? labels.join(" · ") : fallback;
}

function inventoryAttribute(sku: ProductInventorySku, key: string) {
  return String(sku.attributes?.[key] || "").trim();
}

function inventorySecondaryLabel(sku: ProductInventorySku) {
  const label = inventoryAttribute(sku, "talla") || inventoryAttribute(sku, "detalle");
  return label && label.toLocaleLowerCase("es") !== "no especificado" ? label : "Única";
}

function getOptionPriceDelta(value: ProductOptionValue, selectedVariant: ProductVariant | null) {
  if (
    selectedVariant?.id &&
    value.variantPriceDeltas &&
    Object.prototype.hasOwnProperty.call(value.variantPriceDeltas, selectedVariant.id)
  ) {
    return Number(value.variantPriceDeltas[selectedVariant.id] || 0);
  }

  return Number(value.priceDeltaUsd || 0);
}

function buildSelectedOptions(
  product: Product,
  selections: SelectionMap,
  selectedVariant: ProductVariant | null
) {
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
          priceDeltaUsd: getOptionPriceDelta(value, selectedVariant),
        } satisfies SelectedCartOption;
      })
      .filter(Boolean) as SelectedCartOption[];
  });
}

function getVariantPlaceholder(product: Product) {
  const variantNames = product.variants?.map((variant) => variant.name.toLowerCase()) || [];
  return variantNames.some((name) => name.includes("oz")) ? "Elige tamaño" : "Elige";
}

function getProductStartingPrice(product: Product) {
  const variantPrices = (product.variants || [])
    .filter((variant) => variant.isAvailable !== false)
    .map((variant) => product.priceUsd + Number(variant.priceDeltaUsd || 0));

  if (!variantPrices.length) {
    return { price: product.priceUsd, hasRange: false };
  }

  const minPrice = Math.min(...variantPrices);
  const maxPrice = Math.max(...variantPrices);
  return { price: minPrice, hasRange: Math.abs(maxPrice - minPrice) > 0.009 };
}

function ProductOptionsSheet({
  product,
  storeSlug,
  usdToBs,
  baseCurrency,
  showPricesInBs,
  quantity,
  selectedVariant,
  baseUnitPrice,
  isLoadingOptions = false,
  optionsMessage = "",
  onRetryLoadOptions,
  onClose,
  onAdded,
  isStoreOpen = true,
}: {
  product: Product;
  storeSlug: string;
  usdToBs: number;
  baseCurrency: "USD" | "EUR" | string;
  showPricesInBs: boolean;
  quantity: number;
  selectedVariant: ProductVariant | null;
  baseUnitPrice: number;
  isLoadingOptions?: boolean;
  optionsMessage?: string;
  onRetryLoadOptions?: () => void;
  onClose: () => void;
  onAdded: () => void;
  isStoreOpen?: boolean;
}) {
  const initialSelections = useMemo(() => {
    return {};
  }, []);
  const [selections, setSelections] = useState<SelectionMap>(initialSelections);
  const requiredInventoryUnits = product.inventoryManaged
    ? Math.max(1, selectedVariant?.inventoryUnits || 1)
    : 0;
  const [inventorySkuIds, setInventorySkuIds] = useState<string[]>(
    () => Array(requiredInventoryUnits).fill("")
  );
  const [inventoryColors, setInventoryColors] = useState<string[]>(
    () => Array(requiredInventoryUnits).fill("")
  );
  const [purchaseQuantity, setPurchaseQuantity] = useState(quantity);
  const [message, setMessage] = useState("");
  const hasLoadedOptions = Boolean(product.optionGroups?.length);

  useEffect(() => {
    setInventorySkuIds(Array(requiredInventoryUnits).fill(""));
    setInventoryColors(Array(requiredInventoryUnits).fill(""));
    setPurchaseQuantity(quantity);
  }, [quantity, requiredInventoryUnits, selectedVariant?.id]);

  const availableInventorySkus = useMemo(
    () => (product.inventorySkus || []).filter((sku) => sku.isAvailable && sku.stock > 0),
    [product.inventorySkus]
  );

  const maximumInventoryQuantity = useMemo(() => {
    if (!requiredInventoryUnits || inventorySkuIds.some((skuId) => !skuId)) return 0;
    const unitsPerSku = inventorySkuIds.reduce<Record<string, number>>((totals, skuId) => {
      totals[skuId] = (totals[skuId] || 0) + 1;
      return totals;
    }, {});
    return Math.min(...Object.entries(unitsPerSku).map(([skuId, units]) => {
      const sku = availableInventorySkus.find((item) => item.id === skuId);
      return sku ? Math.floor(sku.stock / units) : 0;
    }));
  }, [availableInventorySkus, inventorySkuIds, requiredInventoryUnits]);

  useEffect(() => {
    if (maximumInventoryQuantity > 0) {
      setPurchaseQuantity((current) => Math.min(Math.max(1, current), maximumInventoryQuantity));
    }
  }, [maximumInventoryQuantity]);

  const selectedOptions = useMemo(
    () => buildSelectedOptions(product, selections, selectedVariant),
    [product, selections, selectedVariant]
  );
  const extrasUsd = selectedOptions.reduce(
    (sum, option) => sum + option.priceDeltaUsd,
    0
  );
  const unitPrice = baseUnitPrice + extrasUsd;
  const totalUsd = unitPrice * purchaseQuantity;

  function remainingSkuStock(sku: ProductInventorySku, currentIndex: number) {
    const reservedByOtherPieces = inventorySkuIds.reduce(
      (total, skuId, index) => total + (index !== currentIndex && skuId === sku.id ? 1 : 0),
      0
    );
    return Math.max(0, sku.stock - reservedByOtherPieces);
  }

  function selectInventoryColor(index: number, color: string) {
    const candidates = availableInventorySkus.filter(
      (sku) => inventoryAttribute(sku, "color") === color && remainingSkuStock(sku, index) > 0
    );
    const currentSku = availableInventorySkus.find((sku) => sku.id === inventorySkuIds[index]);
    const onlyColorChoice = candidates.length === 1
      && !inventoryAttribute(candidates[0], "talla")
      && !inventoryAttribute(candidates[0], "detalle");
    const nextColors = [...inventoryColors];
    const nextSkuIds = [...inventorySkuIds];
    nextColors[index] = color;
    nextSkuIds[index] = currentSku && inventoryAttribute(currentSku, "color") === color
      ? currentSku.id
      : onlyColorChoice
        ? candidates[0].id
        : "";
    setInventoryColors(nextColors);
    setInventorySkuIds(nextSkuIds);
    setPurchaseQuantity(1);
    setMessage("");
  }

  function selectInventorySku(index: number, skuId: string) {
    const next = [...inventorySkuIds];
    next[index] = skuId;
    setInventorySkuIds(next);
    setPurchaseQuantity(1);
    setMessage("");
  }

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
        setMessage(`Puedes seleccionar hasta ${maxSelect} opciones en ${group.name}.`);
        return current;
      }

      return { ...current, [groupId]: nextIds };
    });
  }

  function validateSelections() {
    if (requiredInventoryUnits > 0 && inventorySkuIds.some((skuId) => !skuId)) {
      return requiredInventoryUnits === 1
        ? "Selecciona el color y la talla disponibles."
        : `Selecciona las ${requiredInventoryUnits} piezas de la presentación.`;
    }

    for (const group of product.optionGroups || []) {
      const selectedCount = selections[group.id]?.length || 0;
      const minSelect = group.required ? Math.max(1, group.minSelect) : 0;

      if (selectedCount < minSelect) {
        return minSelect === 1
          ? `Selecciona una opción para continuar en ${group.name}.`
          : `Selecciona ${minSelect} opciones para continuar en ${group.name}.`;
      }

      if (group.maxSelect > 0 && selectedCount > group.maxSelect) {
        return `Reduce la selección en ${group.name}.`;
      }
    }

    return "";
  }

  function addCustomizedProduct() {
    if (!isStoreOpen) {
      setMessage("El comercio esta cerrado por horario. Puedes revisar el catalogo, pero no hacer pedidos ahora.");
      return;
    }

    const validation = validateSelections();
    if (validation) {
      setMessage(validation);
      return;
    }

    const inventoryQuantities = inventorySkuIds.reduce<Record<string, number>>(
      (totals, skuId) => {
        if (skuId) totals[skuId] = (totals[skuId] || 0) + 1;
        return totals;
      },
      {}
    );

    addToCart(storeSlug, {
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImageUrl: product.imageUrl,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name,
      quantity: purchaseQuantity,
      unitPriceUsd: unitPrice,
      selectedOptions,
      inventorySelections: Object.entries(inventoryQuantities).map(([skuId, selectedQuantity]) => ({
        skuId,
        quantity: selectedQuantity * purchaseQuantity,
        label: inventorySkuLabel(
          product.inventorySkus?.find((sku) => sku.id === skuId)?.attributes || {},
          product.inventorySkus?.find((sku) => sku.id === skuId)?.code || "Selección"
        ),
      })),
    });

    onAdded();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-[#25262B]/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <section role="dialog" aria-modal="true" aria-label={`Opciones de ${product.name}`} className="max-h-[88vh] w-full overflow-y-auto rounded-[28px] bg-white p-4 pb-6 shadow-2xl sm:max-w-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
              Añade tu producto
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#25262B]">
              {product.name}
            </h2>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Base: {formatBaseCurrency(baseUnitPrice, baseCurrency)}
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
          {requiredInventoryUnits > 0 ? (
            <fieldset className="rounded-2xl bg-[#FFF8F0] p-3">
              <legend className="text-sm font-black text-[#25262B]">
                Elige tu combinación
                <span className="ml-2 rounded-full bg-[#FFB547] px-2.5 py-1 text-[11px]">Obligatorio</span>
              </legend>
              {requiredInventoryUnits > 1 ? (
                <p className="mt-2 text-xs font-bold text-[#746f69]">
                  Esta presentación incluye {requiredInventoryUnits} piezas. Elige cada una.
                </p>
              ) : null}
              <div className="mt-3 grid gap-4">
                {inventorySkuIds.map((selectedSkuId, index) => {
                  const hasColors = availableInventorySkus.some((sku) => inventoryAttribute(sku, "color"));
                  const colors = Array.from(new Set(
                    availableInventorySkus.map((sku) => inventoryAttribute(sku, "color")).filter(Boolean)
                  ));
                  const selectedSku = availableInventorySkus.find((sku) => sku.id === selectedSkuId);
                  const selectedColor = inventoryColors[index] || (selectedSku ? inventoryAttribute(selectedSku, "color") : "");
                  const secondarySkus = availableInventorySkus.filter((sku) => {
                    if (hasColors && inventoryAttribute(sku, "color") !== selectedColor) return false;
                    return remainingSkuStock(sku, index) > 0 || sku.id === selectedSkuId;
                  });

                  return (
                    <div key={index} className={requiredInventoryUnits > 1 ? "rounded-2xl bg-white p-3 ring-1 ring-[#25262B]/[0.07]" : ""}>
                      {requiredInventoryUnits > 1 ? <p className="mb-3 text-sm font-black text-[#25262B]">Pieza {index + 1}</p> : null}
                      {hasColors ? (
                        <div>
                          <p className="text-base font-black text-[#173f35]">1. Elige el color</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {colors.map((color) => {
                              const available = availableInventorySkus
                                .filter((sku) => inventoryAttribute(sku, "color") === color)
                                .reduce((sum, sku) => sum + remainingSkuStock(sku, index), 0);
                              const active = selectedColor === color;
                              return (
                                <button key={color} type="button" disabled={available === 0} onClick={() => selectInventoryColor(index, color)} className={[
                                  "min-h-11 rounded-2xl px-4 py-2.5 text-sm font-black ring-1 transition",
                                  active ? "bg-[var(--brand-primary)] text-white ring-[var(--brand-primary)]" : "bg-white text-[#25262B] ring-[#25262B]/15",
                                  "disabled:bg-slate-100 disabled:text-slate-400",
                                ].join(" ")}>
                                  {color} ({available})
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {(!hasColors || selectedColor) && secondarySkus.length ? (
                        <div className={hasColors ? "mt-4" : ""}>
                          <p className="text-base font-black text-[#173f35]">
                            {hasColors ? "2. Elige la talla" : secondarySkus.some((sku) => inventoryAttribute(sku, "talla")) ? "1. Elige la talla" : "1. Elige la opción"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {secondarySkus.map((sku) => {
                              const available = remainingSkuStock(sku, index);
                              const active = selectedSkuId === sku.id;
                              return (
                                <button key={sku.id} type="button" disabled={available === 0 && !active} onClick={() => selectInventorySku(index, sku.id)} className={[
                                  "min-h-11 rounded-2xl px-4 py-2.5 text-sm font-black ring-1 transition",
                                  active ? "bg-[var(--brand-primary)] text-white ring-[var(--brand-primary)]" : "bg-white text-[#25262B] ring-[#25262B]/15",
                                  "disabled:bg-slate-100 disabled:text-slate-400",
                                ].join(" ")}>
                                  {inventorySecondaryLabel(sku)} ({available})
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : hasColors ? <p className="mt-4 text-xs font-bold text-[#746f69]">Primero selecciona un color.</p> : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {requiredInventoryUnits > 0 && maximumInventoryQuantity > 0 ? (
            <div className="flex items-center justify-between rounded-2xl bg-[#F8F3E8] p-3">
              <div>
                <p className="text-sm font-black text-[#25262B]">Cantidad</p>
                <p className="text-xs font-bold text-[#746f69]">Hasta {maximumInventoryQuantity} disponibles</p>
              </div>
              <div className="flex items-center overflow-hidden rounded-xl bg-white ring-1 ring-[#25262B]/10">
                <button type="button" onClick={() => setPurchaseQuantity((current) => Math.max(1, current - 1))} disabled={purchaseQuantity <= 1} className="p-3 disabled:opacity-30" aria-label="Restar cantidad">−</button>
                <span className="min-w-8 text-center font-black">{purchaseQuantity}</span>
                <button type="button" onClick={() => setPurchaseQuantity((current) => Math.min(maximumInventoryQuantity, current + 1))} disabled={purchaseQuantity >= maximumInventoryQuantity} className="p-3 disabled:opacity-30" aria-label="Sumar cantidad">+</button>
              </div>
            </div>
          ) : null}
          {isLoadingOptions && !hasLoadedOptions ? (
            <div className="rounded-2xl bg-[#FFF8F0] p-4 ring-1 ring-[#25262B]/[0.06]">
              <p className="text-sm font-black text-[#25262B]">Cargando extras...</p>
              <p className="mt-1 text-xs font-bold text-[#746f69]">
                Estamos preparando las opciones de este producto.
              </p>
            </div>
          ) : null}
          {optionsMessage && !hasLoadedOptions ? (
            <div className="rounded-2xl bg-red-50 p-4 text-sm font-black text-red-700">
              <p>{optionsMessage}</p>
              {onRetryLoadOptions ? (
                <button
                  type="button"
                  onClick={onRetryLoadOptions}
                  className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-black text-red-700 ring-1 ring-red-100"
                >
                  Intentar de nuevo
                </button>
              ) : null}
            </div>
          ) : null}
          {(product.optionGroups || []).map((group) => {
            const selectedIds = selections[group.id] || [];
            const maxSelect = group.maxSelect > 0 ? group.maxSelect : group.values.length;
            const instruction =
              group.selectionType === "single"
                ? group.required
                  ? "Selecciona 1 opción"
                  : "Puedes seleccionar 1 opción"
                : group.required && group.minSelect > 0
                  ? group.minSelect === maxSelect
                    ? `Selecciona ${group.minSelect} opciones`
                    : `Selecciona al menos ${group.minSelect} y hasta ${maxSelect}`
                  : `Puedes seleccionar hasta ${maxSelect}`;

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
                    const priceDeltaUsd = getOptionPriceDelta(value, selectedVariant);
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
                          {priceDeltaUsd > 0
                            ? `+${formatBaseCurrency(priceDeltaUsd, baseCurrency)}`
                            : `+${formatBaseCurrency(0, baseCurrency)}`}
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
                {formatBaseCurrency(totalUsd, baseCurrency)}
              </p>
              {showPricesInBs ? (
                <p className="text-xs font-black text-[#746f69]">
                  {formatBs(totalUsd * usdToBs)}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={addCustomizedProduct}
            disabled={!isStoreOpen || isLoadingOptions || (product.hasOptionGroups && !hasLoadedOptions)}
            className={[
              "inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-black",
              !isStoreOpen || isLoadingOptions || (product.hasOptionGroups && !hasLoadedOptions)
                ? "bg-[#F8F3E8] text-[#746f69]"
                : "bg-[#FFB547] text-[#25262B]",
            ].join(" ")}
          >
            <Plus size={18} />
            {!isStoreOpen ? "Cerrado por horario" : "Añadir al carrito"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function ProductSuggestionCard({
  product,
  storeSlug,
  usdToBs = 600,
  baseCurrency = "USD",
  showPricesInBs = true,
  isStoreOpen = true,
  onUnavailable,
}: {
  product: Product;
  storeSlug: string;
  usdToBs?: number;
  baseCurrency?: "USD" | "EUR" | string;
  showPricesInBs?: boolean;
  isStoreOpen?: boolean;
  onUnavailable?: () => void;
}) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [isChoosingVariant, setIsChoosingVariant] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [loadedOptionGroups, setLoadedOptionGroups] = useState<ProductOptionGroup[] | null>(
    product.optionGroups?.length ? product.optionGroups : null
  );
  const optionGroupsRequestRef = useRef<Promise<ProductOptionGroup[]> | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [message, setMessage] = useState("");
  const [added, setAdded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const hasVariants = Boolean(product.variants?.length);
  const hasOptionGroups = Boolean(loadedOptionGroups?.length || product.hasOptionGroups);
  const hasInventory = product.inventoryManaged === true;
  const inventoryAvailable = !hasInventory || (product.inventorySkus || []).some((sku) => sku.isAvailable && sku.stock > 0);
  const availableVariants = (product.variants || []).filter((variant) => variant.isAvailable !== false);
  const startingPrice = getProductStartingPrice(product);
  const unitPrice = product.priceUsd + Number(selectedVariant?.priceDeltaUsd || 0);
  const productForOptions = useMemo(
    () => ({ ...product, optionGroups: loadedOptionGroups || product.optionGroups || [] }),
    [loadedOptionGroups, product]
  );

  async function loadOptionGroups() {
    if (loadedOptionGroups) return loadedOptionGroups;
    if (optionGroupsRequestRef.current) return optionGroupsRequestRef.current;

    setIsLoadingOptions(true);
    setMessage("");

    const request = (async () => {
      const params = new URLSearchParams({ storeSlug, productId: product.id });
      const response = await fetch(`/api/catalog/product-options?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los extras.");
      const optionGroups = Array.isArray(data.optionGroups) ? data.optionGroups : [];
      setLoadedOptionGroups(optionGroups);
      return optionGroups as ProductOptionGroup[];
    })();

    optionGroupsRequestRef.current = request;

    try {
      return await request;
    } finally {
      optionGroupsRequestRef.current = null;
      setIsLoadingOptions(false);
    }
  }

  function markAdded() {
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  async function addSimpleProduct(variant: ProductVariant | null) {
    setIsAdding(true);
    addToCart(storeSlug, {
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImageUrl: product.imageUrl,
      variantId: variant?.id,
      variantName: variant?.name,
      quantity: 1,
      unitPriceUsd: product.priceUsd + Number(variant?.priceDeltaUsd || 0),
    });
    markAdded();
    window.setTimeout(() => setIsAdding(false), 450);
  }

  async function addOrCustomize(variant: ProductVariant | null) {
    setSelectedVariant(variant);
    if (hasOptionGroups || hasInventory) {
      try {
        const optionGroups = hasOptionGroups ? await loadOptionGroups() : [];
        if (hasInventory || optionGroups.length) {
          setIsCustomizing(true);
          return;
        }
      } catch (error: any) {
        setMessage(error.message || "No se pudieron cargar los extras.");
        return;
      }
    }
    await addSimpleProduct(variant);
  }

  async function handleAdd() {
    if (isAdding || isLoadingOptions) return;
    setMessage("");

    if (!isStoreOpen || product.isAvailable === false || !inventoryAvailable) {
      setMessage("Este producto ya no esta disponible.");
      onUnavailable?.();
      return;
    }

    if (hasVariants && !selectedVariant) {
      setIsChoosingVariant(true);
      return;
    }

    await addOrCustomize(selectedVariant);
  }

  return (
    <article className="w-[156px] shrink-0 snap-start">
      <div className="relative aspect-square overflow-hidden rounded-[22px] bg-[#F8F3E8] shadow-sm ring-1 ring-[#25262B]/[0.06]">
        <OptimizedImage
          src={product.imageUrl}
          alt={product.imageAlt}
          width={220}
          height={220}
          sizes="156px"
          className="h-full w-full object-cover"
          fallback={
            <div className="grid h-full w-full place-items-center text-3xl font-black text-[#2E3A79]">
              {product.name.slice(0, 1).toUpperCase()}
            </div>
          }
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isAdding || isLoadingOptions || !isStoreOpen || !inventoryAvailable}
          className={[
            "absolute bottom-2 right-2 grid h-11 w-11 place-items-center rounded-full bg-white text-[#25262B] shadow-lg ring-1 ring-[#25262B]/10 transition",
            added ? "bg-[#6FA64F] text-white" : "",
            isAdding || isLoadingOptions || !isStoreOpen || !inventoryAvailable ? "opacity-70" : "active:scale-95",
          ].join(" ")}
          aria-label={`Agregar ${product.name}`}
        >
          {added ? <Check size={19} /> : <Plus size={21} />}
        </button>
      </div>
      <div className="mt-2 min-h-[76px]">
        <h3 className="line-clamp-2 text-sm font-black leading-tight text-[#25262B]">{product.name}</h3>
        <p className="mt-1 text-base font-black leading-tight text-[#25262B]">
          {startingPrice.hasRange || hasVariants ? "Desde " : ""}
          {formatBaseCurrency(startingPrice.price, baseCurrency)}
        </p>
        {showPricesInBs ? <p className="text-[11px] font-black text-[#746f69]">{formatBs(startingPrice.price * usdToBs)}</p> : null}
        {message ? <p className="mt-1 text-[11px] font-black text-red-600">{message}</p> : null}
      </div>

      {isChoosingVariant ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-[#25262B]/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
          <section role="dialog" aria-modal="true" aria-label={`Presentaciones de ${product.name}`} className="w-full rounded-[28px] bg-white p-4 shadow-2xl sm:max-w-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Elige presentacion</p>
                <h2 className="mt-1 text-xl font-black text-[#25262B]">{product.name}</h2>
              </div>
              <button type="button" onClick={() => setIsChoosingVariant(false)} className="grid h-10 w-10 place-items-center rounded-full bg-[#F8F3E8] text-[#2E3A79]" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {availableVariants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => {
                    setIsChoosingVariant(false);
                    void addOrCustomize(variant);
                  }}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-[#FFF8F0] px-4 py-3 text-left text-sm font-black text-[#25262B] ring-1 ring-[#25262B]/[0.06]"
                >
                  <span>{variant.name}</span>
                  <span>{formatBaseCurrency(product.priceUsd + Number(variant.priceDeltaUsd || 0), baseCurrency)}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {isCustomizing ? (
        <ProductOptionsSheet
          product={productForOptions}
          storeSlug={storeSlug}
          usdToBs={usdToBs}
          baseCurrency={baseCurrency}
          showPricesInBs={showPricesInBs}
          quantity={1}
          selectedVariant={selectedVariant}
          baseUnitPrice={unitPrice}
          isLoadingOptions={isLoadingOptions}
          optionsMessage={message}
          onRetryLoadOptions={() => {
            void loadOptionGroups().catch((error: any) => {
              setMessage(error.message || "No se pudieron cargar los extras.");
            });
          }}
          onClose={() => setIsCustomizing(false)}
          onAdded={markAdded}
          isStoreOpen={isStoreOpen}
        />
      ) : null}
    </article>
  );
}

export function ProductListItem({
  product,
  storeSlug,
  usdToBs = 600,
  baseCurrency = "USD",
  showPricesInBs = true,
  cartQuantity = 0,
  isStoreOpen = true,
  layout = "classic",
}: {
  product: Product;
  storeSlug: string;
  usdToBs?: number;
  baseCurrency?: "USD" | "EUR" | string;
  showPricesInBs?: boolean;
  cartQuantity?: number;
  isStoreOpen?: boolean;
  layout?: "classic" | "visual";
}) {
  const isVisualLayout = layout === "visual";
  const hasVariants = Boolean(product.variants?.length);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [added, setAdded] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [loadedOptionGroups, setLoadedOptionGroups] = useState<ProductOptionGroup[] | null>(
    product.optionGroups?.length ? product.optionGroups : null
  );
  const optionGroupsRequestRef = useRef<Promise<ProductOptionGroup[]> | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [optionsMessage, setOptionsMessage] = useState("");
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(product.imageUrl);
  const productImages = (product.imageUrls?.length ? product.imageUrls : [product.imageUrl]).slice(0, 2);
  const hasOptionGroups = Boolean(loadedOptionGroups?.length || product.hasOptionGroups);
  const hasInventory = product.inventoryManaged === true;
  const inventoryAvailable = !hasInventory || (product.inventorySkus || []).some((sku) => sku.isAvailable);
  const requiresCustomization = hasOptionGroups || hasInventory;
  const productForOptions = useMemo(
    () => ({
      ...product,
      optionGroups: loadedOptionGroups || product.optionGroups || [],
    }),
    [loadedOptionGroups, product]
  );

  const unitPrice = useMemo(() => {
    return product.priceUsd + (selectedVariant?.priceDeltaUsd || 0);
  }, [product.priceUsd, selectedVariant]);
  const originalUnitPrice = useMemo(() => {
    if (!product.discountPercent || product.discountPercent <= 0) return null;
    return selectedVariant?.originalPriceUsd || product.originalPriceUsd || null;
  }, [product.discountPercent, product.originalPriceUsd, selectedVariant]);
  const canAdd = isStoreOpen && inventoryAvailable && (!hasVariants || Boolean(selectedVariant));

  async function loadOptionGroups() {
    if (loadedOptionGroups) return loadedOptionGroups;
    if (optionGroupsRequestRef.current) return optionGroupsRequestRef.current;

    setIsLoadingOptions(true);
    setOptionsMessage("");

    const request = (async () => {
      const params = new URLSearchParams({
        storeSlug,
        productId: product.id,
      });
      const response = await fetch(`/api/catalog/product-options?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudieron cargar los extras.");
      }

      const nextOptionGroups = Array.isArray(data.optionGroups) ? data.optionGroups : [];
      setLoadedOptionGroups(nextOptionGroups);
      if (product.hasOptionGroups && !nextOptionGroups.length) {
        setOptionsMessage("No se pudieron cargar los extras de este producto. Intenta de nuevo.");
      }
      return nextOptionGroups as ProductOptionGroup[];
    })();

    optionGroupsRequestRef.current = request;

    try {
      return await request;
    } finally {
      optionGroupsRequestRef.current = null;
      setIsLoadingOptions(false);
    }
  }

  async function handleAdd() {
    if (!isStoreOpen) {
      setOptionsMessage("El comercio esta cerrado por horario. Puedes revisar el catalogo, pero no hacer pedidos ahora.");
      return;
    }

    if (!canAdd) {
      return;
    }

    if (requiresCustomization) {
      if (hasInventory && !hasOptionGroups) {
        setIsCustomizing(true);
        return;
      }
      try {
        const optionGroups = await loadOptionGroups();
        if (optionGroups.length) {
          setIsCustomizing(true);
        }
      } catch (error: any) {
        setOptionsMessage(error.message || "No se pudieron cargar los extras de este producto.");
      }
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

  function prefetchOptions() {
    if (!isStoreOpen || !canAdd || !hasOptionGroups || loadedOptionGroups || isLoadingOptions) return;
    void loadOptionGroups().catch(() => {
      // La apertura del modal muestra el error si el cliente intenta continuar.
    });
  }

  return (
    <article
      className={[
        isVisualLayout ? "overflow-hidden rounded-2xl p-2 shadow-sm ring-1" : "min-h-[128px] rounded-2xl p-2 shadow-sm ring-1",
        product.isFeatured
          ? "bg-[#FFF8F0] ring-[#FFB547]/55 shadow-[#FFB547]/10"
          : "bg-white ring-[#25262B]/[0.07]",
      ].join(" ")}
    >
      <div
        className={[
          isVisualLayout
            ? "flex h-full flex-col gap-2.5"
            : "grid min-h-[112px] grid-cols-[76px_minmax(0,1fr)] gap-2.5",
        ].join(" ")}
      >
        <button type="button" onClick={() => { setActiveImage(productImages[0]); setIsGalleryOpen(true); }} className={isVisualLayout ? "relative aspect-square w-full overflow-hidden rounded-xl text-left" : "relative text-left"} aria-label={`Ver fotos de ${product.name} en grande`}>
          <OptimizedImage src={product.imageUrl} alt={product.imageAlt} width={isVisualLayout ? 480 : 76} height={isVisualLayout ? 480 : 112} sizes={isVisualLayout ? "(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 240px" : "76px"} className={isVisualLayout ? "h-full w-full rounded-xl bg-[#F8F3E8] object-cover" : "h-[112px] w-[76px] rounded-xl bg-[#F8F3E8] object-cover"} fallback={<div className={isVisualLayout ? "grid h-full w-full place-items-center rounded-xl bg-[#F8F3E8] text-3xl font-black text-[#2E3A79]" : "grid h-[112px] w-[76px] place-items-center rounded-xl bg-[#F8F3E8] text-lg font-black text-[#2E3A79]"}>{product.name.slice(0, 1).toUpperCase()}</div>} />
          {product.discountPercent && product.discountPercent > 0 ? <span className="absolute left-1 top-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white shadow-sm">-{product.discountPercent}%</span> : null}
          {productImages.length > 1 ? <span className="absolute bottom-1 right-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-black text-white">2 fotos</span> : null}
        </button>
        <div className={isVisualLayout ? "flex min-w-0 flex-1 flex-col px-1 pb-1" : "flex min-w-0 flex-col"}>
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black leading-tight text-[#25262B]">{product.name}</h3>
            </div>
            {cartQuantity > 0 ? (
              <span className="shrink-0 rounded-full bg-[#2E3A79] px-2 py-1 text-[11px] font-black text-white">
                {cartQuantity}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-snug text-[#746f69]">
            {product.description}
          </p>

          <div className="mt-auto pt-1.5">
            {product.variants?.length ? (
              <select
                value={selectedVariant?.id || ""}
                onChange={(event) => {
                  setSelectedVariant(
                    product.variants?.find(
                      (variant) => variant.id === event.target.value
                    ) || null
                  );
                }}
                className="mb-1.5 h-8 w-full rounded-lg border border-[#25262B]/10 bg-[#FFF8F0] px-2.5 text-[11px] font-black text-[#746f69] outline-none"
              >
                <option value="">{getVariantPlaceholder(product)}</option>
                {product.variants.map((variant) => (
                  <option
                    key={variant.id}
                    value={variant.id}
                    disabled={!variant.isAvailable}
                  >
                    {variant.name}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0 leading-tight">
                {originalUnitPrice && originalUnitPrice > unitPrice ? (
                  <p className="text-[11px] font-black text-[#746f69] line-through">
                    {formatBaseCurrency(originalUnitPrice, baseCurrency)}
                  </p>
                ) : null}
                <p className="text-sm font-black text-[#25262B]">
                  {formatBaseCurrency(unitPrice, baseCurrency)}
                </p>
                {showPricesInBs ? (
                  <p className="text-[11px] font-black text-[#746f69]">
                    {formatBs(unitPrice * usdToBs)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleAdd}
                onMouseEnter={prefetchOptions}
                onFocus={prefetchOptions}
                disabled={!isStoreOpen || !canAdd}
                className={[
                  "inline-flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-center text-[11px] font-black leading-tight",
                  added
                    ? "bg-[#6FA64F] text-white"
                    : !isStoreOpen || !canAdd
                      ? "bg-[#F8F3E8] text-[#746f69]"
                    : "bg-[#FFB547] text-[#25262B]",
                ].join(" ")}
              >
                {added ? <Check size={15} /> : <Plus size={15} />}
                {!isStoreOpen ? "Cerrado" : !inventoryAvailable ? "Agotado" : isLoadingOptions ? "Cargando" : added ? "Listo" : "Añadir"}
              </button>
            </div>
            {optionsMessage ? (
              <p className="mt-1 text-[11px] font-black text-red-600">{optionsMessage}</p>
            ) : null}
          </div>
        </div>
      </div>
      {isCustomizing ? (
        <ProductOptionsSheet
          product={productForOptions}
          storeSlug={storeSlug}
          usdToBs={usdToBs}
          baseCurrency={baseCurrency}
          showPricesInBs={showPricesInBs}
          quantity={1}
          selectedVariant={selectedVariant}
          baseUnitPrice={unitPrice}
          isLoadingOptions={isLoadingOptions}
          optionsMessage={optionsMessage}
          onRetryLoadOptions={() => {
            void loadOptionGroups().catch((error: any) => {
              setOptionsMessage(error.message || "No se pudieron cargar los extras de este producto.");
            });
          }}
          onClose={() => setIsCustomizing(false)}
          onAdded={markAdded}
          isStoreOpen={isStoreOpen}
        />
      ) : null}
      {isGalleryOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-3" role="dialog" aria-modal="true" aria-label={`Fotos de ${product.name}`}>
          <button type="button" onClick={() => setIsGalleryOpen(false)} className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white text-[#25262B]" aria-label="Cerrar fotos"><X size={20} /></button>
          <div className="w-full max-w-3xl">
            <OptimizedImage src={activeImage} alt={product.imageAlt} width={1000} height={1000} sizes="100vw" className="max-h-[78vh] w-full rounded-2xl object-contain" />
            {productImages.length > 1 ? <div className="mt-3 flex justify-center gap-3">{productImages.map((url, index) => <button type="button" key={url} onClick={() => setActiveImage(url)} className={activeImage === url ? "rounded-xl ring-4 ring-[#FFB547]" : "rounded-xl opacity-70"}><OptimizedImage src={url} alt={`${product.name}, foto ${index + 1}`} width={72} height={72} sizes="72px" className="h-18 w-18 rounded-xl object-cover" /></button>)}</div> : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
