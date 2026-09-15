"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  ChevronRight,
  Minus,
  Loader2,
  Trash2,
  PackagePlus,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";
import { fetchPanelJson } from "@/lib/panel/client-fetch-cache";
import { getPanelAuthHeaders } from "@/lib/panel/client-auth";

const SHIBUI_STORE_ID = "126f8168-f1ca-4a08-8eaf-c3816b9d9195";

type InventorySku = {
  id: string;
  code: string;
  attributes: Record<string, unknown>;
  stock_on_hand: number;
  is_active: boolean;
};

type Presentation = {
  id: string;
  name: string;
  price_usd: number | string;
  inventory_units?: number;
  is_available: boolean;
};

type InventoryProduct = {
  id: string;
  store_id: string;
  name: string;
  image_url?: string | null;
  is_available: boolean;
  categories?: { name?: string } | null;
  product_inventory_skus?: InventorySku[];
  product_variants?: Presentation[];
};

type CatalogResponse = {
  stores?: Array<{ id: string; slug: string; name: string; inventory_enabled?: boolean }>;
  products?: InventoryProduct[];
};

type InventoryMode = "none" | "simple" | "combinations";

function cleanLabel(value: unknown) {
  return String(value || "").trim();
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function combinationLabel(sku: InventorySku) {
  const values = Object.entries(sku.attributes || {})
    .map(([key, value]) => `${titleCase(key)}: ${cleanLabel(value)}`)
    .filter((value) => !value.endsWith(": "));
  return values.length ? values.join(" · ") : sku.code;
}

function isSimpleSku(sku: InventorySku) {
  return cleanLabel(sku.attributes?.detalle).toLocaleLowerCase("es") === "producto simple";
}

function isTemporarySku(sku: InventorySku) {
  return sku.id.startsWith("preview-");
}

function persistedCombinationSkus(product: InventoryProduct) {
  return (product.product_inventory_skus || []).filter(
    (sku) => sku.is_active !== false && !isSimpleSku(sku) && !isTemporarySku(sku),
  );
}

function inventoryAttributeNames(skus: InventorySku[]) {
  const names = Array.from(
    new Set(
      skus
        .flatMap((sku) => Object.keys(sku.attributes || {}))
        .filter((key) => key !== "referencia_interna"),
    ),
  );
  return names.length ? names : ["color", "talla"];
}

function productStock(product: InventoryProduct, stock: Record<string, number>) {
  return (product.product_inventory_skus || []).filter((sku) => sku.is_active !== false).reduce(
    (total, sku) => total + Math.max(0, Number(stock[sku.id] ?? sku.stock_on_hand ?? 0)),
    0,
  );
}

export function PremiumInventoryPreview({
  pin,
  onClose,
}: {
  pin: string;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [modes, setModes] = useState<Record<string, InventoryMode>>({});
  const [presentationUnits, setPresentationUnits] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "empty">("all");
  const [activeProductId, setActiveProductId] = useState("");
  const [newCombinationOpen, setNewCombinationOpen] = useState(false);
  const [newCombination, setNewCombination] = useState<Record<string, string>>({});
  const [newCombinationStock, setNewCombinationStock] = useState(1);
  const [extraAttributeName, setExtraAttributeName] = useState("");
  const [extraAttributeValue, setExtraAttributeValue] = useState("");
  const [dirtyChanges, setDirtyChanges] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadInventory() {
      try {
        const data = (await fetchPanelJson("/api/panel/catalogo", {
          headers: await getPanelAuthHeaders(pin),
        })) as CatalogResponse;
        const store = (data.stores || []).find(
          (item) => item.id === SHIBUI_STORE_ID && item.slug === "shibui" && item.inventory_enabled,
        );
        if (!store) throw new Error("El inventario Premium no está disponible para este comercio.");

        const nextProducts = (data.products || []).filter(
          (product) => product.store_id === SHIBUI_STORE_ID,
        );
        if (!active) return;
        setProducts(nextProducts);
        setStock(
          Object.fromEntries(
            nextProducts.flatMap((product) =>
              (product.product_inventory_skus || [])
                .filter((sku) => sku.is_active !== false)
                .map((sku) => [sku.id, Number(sku.stock_on_hand || 0)]),
            ),
          ),
        );
        setModes(
          Object.fromEntries(
            nextProducts.map((product) => [
              product.id,
              product.product_inventory_skus?.some((sku) => sku.is_active !== false)
                ? product.product_inventory_skus.filter((sku) => sku.is_active !== false).every(isSimpleSku)
                  ? "simple"
                  : "combinations"
                : "none",
            ]),
          ),
        );
        setPresentationUnits(
          Object.fromEntries(
            nextProducts.flatMap((product) =>
              (product.product_variants || []).map((variant) => [
                variant.id,
                Math.max(1, Number(variant.inventory_units || 1)),
              ]),
            ),
          ),
        );
      } catch (loadError: unknown) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el inventario.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadInventory();
    return () => {
      active = false;
    };
  }, [pin]);

  const activeProduct = products.find((product) => product.id === activeProductId) || null;
  const activeSkus = useMemo(
    () => (activeProduct?.product_inventory_skus || []).filter((sku) => sku.is_active !== false),
    [activeProduct],
  );
  const attributeNames = useMemo(
    () =>
      inventoryAttributeNames(activeSkus),
    [activeSkus],
  );

  const summary = useMemo(() => {
    const managed = products.filter((product) => modes[product.id] !== "none");
    return {
      managed: managed.length,
      units: managed.reduce((total, product) => total + productStock(product, stock), 0),
      low: managed.filter((product) => {
        const units = productStock(product, stock);
        return units > 0 && units <= 3;
      }).length,
      empty: managed.filter((product) => {
        const units = productStock(product, stock);
        return units === 0;
      }).length,
    };
  }, [modes, products, stock]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return products.filter((product) => {
      const units = productStock(product, stock);
      if (filter === "low" && !(units > 0 && units <= 3)) return false;
      if (filter === "empty" && units !== 0) return false;
      return !normalizedQuery || product.name.toLocaleLowerCase("es").includes(normalizedQuery);
    });
  }, [filter, products, query, stock]);

  function markChange() {
    setDirtyChanges((current) => current + 1);
  }

  function updateSkuStock(skuId: string, nextValue: number) {
    setStock((current) => ({ ...current, [skuId]: Math.max(0, Math.floor(nextValue || 0)) }));
    markChange();
  }

  function makeTemporarySimpleSku(stockValue = 0): InventorySku {
    return {
      id: `preview-simple-${Date.now()}`,
      code: "PRODUCTO-SIMPLE",
      attributes: { detalle: "Producto simple" },
      stock_on_hand: Math.max(0, Math.floor(stockValue || 0)),
      is_active: true,
    };
  }

  function changeMode(productId: string, mode: InventoryMode) {
    const product = products.find((item) => item.id === productId);
    if (mode === "simple" && product && persistedCombinationSkus(product).length) {
      setSaveMessage("Este producto ya tiene combinaciones guardadas. El cambio a producto simple queda bloqueado para evitar borrar stock por accidente.");
      return;
    }
    setModes((current) => ({ ...current, [productId]: mode }));
    setSaveMessage("");
    if (mode === "simple") {
      setProducts((current) =>
        current.map((product) => {
          if (product.id !== productId) return product;
          const active = (product.product_inventory_skus || []).filter((sku) => sku.is_active !== false);
          const simpleSku = active.find(isSimpleSku) || makeTemporarySimpleSku(productStock(product, stock));
          return { ...product, product_inventory_skus: [simpleSku] };
        }),
      );
    }
    if (mode === "combinations") {
      setProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? { ...product, product_inventory_skus: (product.product_inventory_skus || []).filter((sku) => !isSimpleSku(sku)) }
            : product,
        ),
      );
    }
    markChange();
  }

  function addCombination() {
    if (!activeProduct) return;
    const attributes = Object.fromEntries(
      Object.entries(newCombination)
        .map(([key, value]) => [key.trim().toLocaleLowerCase("es"), value.trim()])
        .filter(([key, value]) => key && value),
    );
    if (extraAttributeName.trim() && extraAttributeValue.trim()) {
      attributes[extraAttributeName.trim().toLocaleLowerCase("es")] = extraAttributeValue.trim();
    }
    if (!Object.keys(attributes).length || Object.keys(attributes).some((key) => key === "detalle" && attributes[key] === "Producto simple")) return;
    const duplicate = activeSkus.some(
      (sku) => JSON.stringify(sku.attributes) === JSON.stringify(attributes),
    );
    if (duplicate) return;

    const temporarySku: InventorySku = {
      id: `preview-${Date.now()}`,
      code: "NUEVA-COMBINACION",
      attributes,
      stock_on_hand: Math.max(0, Math.floor(newCombinationStock || 0)),
      is_active: true,
    };
    setProducts((current) =>
      current.map((product) =>
        product.id === activeProduct.id
          ? {
              ...product,
              product_inventory_skus: [...(product.product_inventory_skus || []), temporarySku],
            }
          : product,
      ),
    );
    setStock((current) => ({ ...current, [temporarySku.id]: temporarySku.stock_on_hand }));
    setNewCombination({});
    setExtraAttributeName("");
    setExtraAttributeValue("");
    setNewCombinationStock(1);
    setNewCombinationOpen(false);
    markChange();
  }

  function removeCombination(skuId: string) {
    setProducts((current) =>
      current.map((product) =>
        product.id === activeProduct?.id
          ? {
              ...product,
              product_inventory_skus: (product.product_inventory_skus || []).filter((sku) => sku.id !== skuId),
            }
          : product,
      ),
    );
    setStock((current) => {
      const next = { ...current };
      delete next[skuId];
      return next;
    });
    markChange();
  }

  async function saveProductInventory() {
    if (!activeProduct || modes[activeProduct.id] === "none" || !dirtyChanges) return;
    if (modes[activeProduct.id] === "combinations" && !activeSkus.filter((sku) => !isSimpleSku(sku)).length) {
      setSaveMessage("Agrega al menos una combinación antes de guardar este tipo de control.");
      return;
    }
    setIsSaving(true);
    setSaveMessage("");
    try {
      const response = await fetchPanelJson("/api/panel/inventory", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getPanelAuthHeaders(pin)),
        },
        body: JSON.stringify({
          store_id: SHIBUI_STORE_ID,
          product_id: activeProduct.id,
          skus: activeSkus.map((sku) => ({
            id: sku.id,
            code: sku.code,
            attributes: sku.attributes,
            stock_on_hand: Math.max(0, Number(stock[sku.id] ?? sku.stock_on_hand ?? 0)),
          })),
          presentations: (activeProduct.product_variants || [])
            .filter((variant) => variant.is_available !== false)
            .map((variant) => ({
              id: variant.id,
              inventory_units: presentationUnits[variant.id] || 1,
            })),
        }),
      }) as { result?: { skus?: InventorySku[] } };
      const savedSkus = response.result?.skus || [];
      if (savedSkus.length) {
        setProducts((current) => current.map((product) => product.id === activeProduct.id
          ? { ...product, product_inventory_skus: savedSkus }
          : product));
        setStock((current) => ({
          ...current,
          ...Object.fromEntries(savedSkus.map((sku) => [sku.id, Number(sku.stock_on_hand || 0)])),
        }));
      }
      setDirtyChanges(0);
      setSaveMessage("Inventario guardado correctamente.");
    } catch (saveError: unknown) {
      setSaveMessage(saveError instanceof Error ? saveError.message : "No se pudo guardar el inventario.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-3xl bg-white p-6 text-center shadow-lg ring-1 ring-[#25262B]/[0.06]">
        <Boxes className="mx-auto h-8 w-8 animate-pulse text-[#2E3A79]" />
        <p className="mt-3 text-sm font-black">Cargando inventario de SHIBUI...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-3xl bg-red-50 p-5 ring-1 ring-red-200">
        <p className="font-black text-red-800">{error}</p>
        <button type="button" onClick={onClose} className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-black text-red-700">Volver</button>
      </section>
    );
  }

  if (activeProduct) {
    const mode = modes[activeProduct.id] || "none";
    const combinationStockTotal = productStock(activeProduct, stock);
    const presentations = (activeProduct.product_variants || []).filter((variant) => variant.is_available !== false);
    const simpleSku = activeSkus.find(isSimpleSku) || null;
    const simpleStock = simpleSku ? Math.max(0, Number(stock[simpleSku.id] ?? simpleSku.stock_on_hand ?? 0)) : 0;
    const hasPersistedCombinations = persistedCombinationSkus(activeProduct).length > 0;
    const hasCombinationRows = activeSkus.some((sku) => !isSimpleSku(sku));
    const canSave = dirtyChanges && mode !== "none" && !isSaving && (mode !== "combinations" || hasCombinationRows);
    return (
      <section className="rounded-3xl bg-white p-4 shadow-xl ring-1 ring-[#25262B]/[0.06] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <button type="button" onClick={() => setActiveProductId("")} className="inline-flex items-center gap-1 text-xs font-black text-[#2E3A79]"><ArrowLeft size={15} /> Volver al inventario</button>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.14em] text-[#F27533]">Inventario Premium</p>
            <h2 className="mt-1 text-2xl font-black">{activeProduct.name}</h2>
          </div>
          <span className="rounded-full bg-[#E8F2EE] px-3 py-1.5 text-xs font-black text-[#1F464C]">Stock total: {combinationStockTotal}</span>
        </div>

        <div className="mt-5 rounded-2xl bg-[#F8F3E8] p-4">
          <p className="text-sm font-black">Tipo de control</p>
          <p className="mt-1 text-xs font-bold text-[#746f69]">Usa producto simple cuando solo necesitas una existencia total. Usa combinaciones cuando el stock depende de atributos como color, talla, sabor, tamaño o presentación.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => changeMode(activeProduct.id, "simple")} disabled={hasPersistedCombinations && mode !== "simple"} title={hasPersistedCombinations && mode !== "simple" ? "Este producto ya tiene combinaciones guardadas." : undefined} className={`rounded-2xl px-4 py-3 text-left text-sm font-black ring-1 disabled:cursor-not-allowed disabled:opacity-50 ${mode === "simple" ? "bg-[#1F464C] text-white ring-[#1F464C]" : "bg-white text-[#1F464C] ring-[#25262B]/10"}`}>Producto simple</button>
            <button type="button" onClick={() => changeMode(activeProduct.id, "combinations")} className={`rounded-2xl px-4 py-3 text-left text-sm font-black ring-1 ${mode === "combinations" ? "bg-[#1F464C] text-white ring-[#1F464C]" : "bg-white text-[#1F464C] ring-[#25262B]/10"}`}>Con combinaciones</button>
          </div>
          {hasPersistedCombinations && mode !== "simple" ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#746f69]">Este producto ya tiene combinaciones guardadas. Para proteger el stock, no se puede convertir a producto simple desde esta pantalla.</p> : null}
        </div>

        {mode === "simple" ? (
          <div className="mt-4 rounded-2xl border border-[#25262B]/10 bg-[#FFF8F0] p-4">
            <p className="text-sm font-black">Existencia del producto</p>
            <p className="mt-1 text-xs font-bold text-[#746f69]">Este producto descuenta una sola existencia, sin pedir color, talla u otra característica.</p>
            <div className="mt-3 flex w-fit items-center overflow-hidden rounded-xl bg-white ring-1 ring-[#25262B]/10">
              <button type="button" aria-label="Restar stock" onClick={() => simpleSku ? updateSkuStock(simpleSku.id, simpleStock - 1) : null} disabled={!simpleSku || simpleStock === 0} className="p-3 disabled:opacity-30"><Minus size={16} /></button>
              <input type="number" min="0" value={simpleStock} onChange={(event) => simpleSku ? updateSkuStock(simpleSku.id, Number(event.target.value || 0)) : null} aria-label="Stock del producto" className="w-16 bg-transparent text-center text-sm font-black outline-none" />
              <button type="button" aria-label="Sumar stock" onClick={() => simpleSku ? updateSkuStock(simpleSku.id, simpleStock + 1) : null} disabled={!simpleSku} className="p-3 disabled:opacity-30"><Plus size={16} /></button>
            </div>
          </div>
        ) : null}

        {mode === "combinations" ? (
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black">Combinaciones disponibles</p>
                  <span className="rounded-full bg-[#1F464C] px-3 py-1 text-xs font-black text-white">Stock total: {combinationStockTotal}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">{attributeNames.map((attribute) => <span key={attribute} className="rounded-full bg-[#E8F2EE] px-3 py-1 text-xs font-black text-[#1F464C]">{titleCase(attribute)}</span>)}</div>
              </div>
              <button type="button" onClick={() => setNewCombinationOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-[#FFB547] px-4 py-2.5 text-xs font-black"><PackagePlus size={16} /> Agregar combinación</button>
            </div>

            <div className="mt-4 space-y-2">
              {activeSkus.map((sku) => {
                const currentStock = Math.max(0, Number(stock[sku.id] ?? sku.stock_on_hand ?? 0));
                return (
                  <div key={sku.id} className="flex flex-col gap-3 rounded-2xl bg-[#FFF8F0] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-black">{combinationLabel(sku)}</p>
                      <p className={`mt-1 text-xs font-bold ${currentStock === 0 ? "text-red-600" : currentStock <= 1 ? "text-amber-700" : "text-[#746f69]"}`}>{currentStock === 0 ? "Agotado" : currentStock === 1 ? "Última unidad" : `${currentStock} disponibles`}</p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <div className="flex items-center overflow-hidden rounded-xl bg-white ring-1 ring-[#25262B]/10">
                        <button type="button" aria-label={`Restar stock de ${combinationLabel(sku)}`} onClick={() => updateSkuStock(sku.id, currentStock - 1)} disabled={currentStock === 0} className="p-3 disabled:opacity-30"><Minus size={16} /></button>
                        <input type="number" min="0" value={currentStock} onChange={(event) => updateSkuStock(sku.id, Number(event.target.value || 0))} aria-label={`Stock de ${combinationLabel(sku)}`} className="w-12 bg-transparent text-center text-sm font-black outline-none" />
                        <button type="button" aria-label={`Sumar stock de ${combinationLabel(sku)}`} onClick={() => updateSkuStock(sku.id, currentStock + 1)} className="p-3"><Plus size={16} /></button>
                      </div>
                      <button type="button" onClick={() => removeCombination(sku.id)} aria-label={`Eliminar combinación ${combinationLabel(sku)}`} className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-3 text-xs font-black text-red-700 ring-1 ring-red-100"><Trash2 size={16} /> Eliminar</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {newCombinationOpen ? (
              <div className="mt-4 rounded-2xl border border-[#2E3A79]/15 bg-[#F8F3E8] p-4">
                <div className="flex items-center justify-between gap-3"><p className="text-sm font-black">Nueva combinación</p><button type="button" onClick={() => setNewCombinationOpen(false)} aria-label="Cerrar nueva combinación" className="rounded-full bg-white p-2"><X size={16} /></button></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {attributeNames.map((attribute) => <input key={attribute} value={newCombination[attribute] || ""} onChange={(event) => setNewCombination((current) => ({ ...current, [attribute]: event.target.value }))} placeholder={titleCase(attribute)} className="rounded-xl border border-[#25262B]/10 px-3 py-3 text-sm font-bold outline-none" />)}
                  <input value={extraAttributeName} onChange={(event) => setExtraAttributeName(event.target.value)} placeholder="Otra característica (opcional)" className="rounded-xl border border-[#25262B]/10 px-3 py-3 text-sm font-bold outline-none" />
                  <input value={extraAttributeValue} onChange={(event) => setExtraAttributeValue(event.target.value)} placeholder="Valor de esa característica" className="rounded-xl border border-[#25262B]/10 px-3 py-3 text-sm font-bold outline-none" />
                  <input type="number" min="0" value={newCombinationStock} onChange={(event) => setNewCombinationStock(Math.max(0, Number(event.target.value || 0)))} placeholder="Cantidad inicial" className="rounded-xl border border-[#25262B]/10 px-3 py-3 text-sm font-bold outline-none" />
                </div>
                <button type="button" onClick={addCombination} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#2E3A79] px-4 py-2.5 text-xs font-black text-white"><Plus size={15} /> Añadir combinación</button>
              </div>
            ) : null}
          </div>
        ) : null}

        {presentations.length ? (
          <div className="mt-5 rounded-2xl border border-[#25262B]/10 p-4">
            <p className="text-sm font-black">Presentaciones de venta</p>
            <p className="mt-1 text-xs font-bold text-[#746f69]">Indica cuántas unidades físicas descuenta cada presentación.</p>
            <div className="mt-3 space-y-2">
              {presentations.map((presentation) => (
                <div key={presentation.id} className="grid gap-2 rounded-xl bg-[#FFF8F0] p-3 sm:grid-cols-[1fr_130px] sm:items-center">
                  <div><p className="text-sm font-black">{presentation.name}</p><p className="text-xs font-bold text-[#746f69]">${Number(presentation.price_usd || 0).toFixed(2)}</p></div>
                  <label className="text-xs font-black">Descuenta <input type="number" min="1" max="50" value={presentationUnits[presentation.id] || 1} onChange={(event) => { setPresentationUnits((current) => ({ ...current, [presentation.id]: Math.max(1, Number(event.target.value || 1)) })); markChange(); }} className="ml-1 w-12 rounded-lg border border-[#25262B]/10 bg-white px-2 py-1.5 text-center outline-none" /> unidad(es)</label>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-amber-900">{dirtyChanges ? <><strong>Tienes cambios sin guardar.</strong> Revisa las cantidades y presiona Guardar cambios.</> : "Las cantidades están guardadas."}</p>
          <button type="button" disabled={!canSave} onClick={saveProductInventory} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-4 py-2 text-xs font-black text-white disabled:opacity-40">{isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar cambios</button>
        </div>
        {saveMessage ? <p className={`mt-3 text-sm font-black ${saveMessage.includes("correctamente") ? "text-emerald-700" : "text-red-600"}`}>{saveMessage}</p> : null}
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-4 shadow-xl ring-1 ring-[#25262B]/[0.06] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#1F464C] text-white"><Boxes size={20} /></span><h2 className="mt-4 text-2xl font-black">Inventario Premium</h2><p className="mt-1 max-w-2xl text-sm font-bold text-[#746f69]">Controla existencias sin mezclar las combinaciones físicas con las presentaciones de venta.</p></div>
        <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-full bg-[#F8F3E8] px-4 py-2 text-xs font-black text-[#2E3A79]"><X size={15} /> Cerrar</button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[["Productos", summary.managed], ["Unidades", summary.units], ["Stock bajo", summary.low], ["Agotados", summary.empty]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-[#F8F3E8] p-3"><p className="text-xs font-black text-[#746f69]">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_auto]">
        <label className="flex items-center gap-2 rounded-2xl bg-[#F8F3E8] px-4 py-3"><Search size={17} className="text-[#746f69]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto..." className="w-full bg-transparent text-sm font-bold outline-none" /></label>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#F8F3E8] p-1">{([["all", "Todos"], ["low", "Stock bajo"], ["empty", "Agotados"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-xl px-3 py-2 text-xs font-black ${filter === value ? "bg-white text-[#2E3A79] shadow-sm" : "text-[#746f69]"}`}>{label}</button>)}</div>
      </div>

      <div className="mt-4 space-y-2">
        {filteredProducts.map((product) => {
          const mode = modes[product.id] || "none";
          const units = productStock(product, stock);
          return <button key={product.id} type="button" onClick={() => setActiveProductId(product.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-[#25262B]/[0.07] p-3 text-left transition hover:border-[#2E3A79]/30 sm:grid-cols-[1fr_150px_auto]">
            <div className="min-w-0"><p className="truncate text-sm font-black">{product.name}</p><p className="mt-1 truncate text-xs font-bold text-[#746f69]">{product.categories?.name || "Sin categoría"} · {mode === "combinations" ? `${(product.product_inventory_skus || []).filter((sku) => sku.is_active !== false && !isSimpleSku(sku)).length} combinaciones` : mode === "simple" ? "Producto simple" : "Sin control"}</p></div>
            <div className="hidden sm:block"><p className={`text-sm font-black ${units === 0 ? "text-red-600" : units <= 3 ? "text-amber-700" : "text-[#1F464C]"}`}>{units} unidades</p>{mode !== "none" ? <p className="text-[11px] font-bold text-[#746f69]">{units === 0 ? "Agotado" : units <= 3 ? "Reponer pronto" : "Disponible"}</p> : null}</div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F2EE] px-3 py-2 text-xs font-black text-[#1F464C]">Administrar <ChevronRight size={14} /></span>
          </button>;
        })}
      </div>

      <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-xs font-bold text-emerald-900">Los cambios de inventario quedan guardados y registrados en el historial.</p>
    </section>
  );
}
