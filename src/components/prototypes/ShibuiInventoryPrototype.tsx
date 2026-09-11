"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Check,
  Minus,
  PackageCheck,
  PackagePlus,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";

type CatalogProduct = {
  product_id: string;
  nombre: string;
  categoria: string;
  precio_usd: number | string | null;
  stock_total: number;
  imagen: string;
  estado_importacion: string;
  observaciones: string;
};

type CatalogVariant = {
  product_id: string;
  color: string;
  talla: string;
  detalle: string;
  cantidad: number;
};

type CatalogData = {
  products: CatalogProduct[];
  variants: CatalogVariant[];
};

type Selection = {
  color: string;
  size: string;
  detail: string;
};

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "Única"];
const CURRENT_PRODUCT_NOTES: Record<string, string> = {
  "SHB-007": "Revisar precio: en Somos está a $16 y el archivo indica $18.",
  "SHB-008": "Ya existe en Somos: se fusionaría sin duplicarlo.",
  "SHB-012": "Ya existe en Somos: se fusionaría sin duplicarlo.",
};

function variantKey(variant: CatalogVariant) {
  return [variant.product_id, variant.color, variant.talla, variant.detalle].join("::");
}

function normalizedLabel(value: string, fallback: string) {
  const clean = value.trim();
  return clean && clean !== "No especificado" ? clean : fallback;
}

function numericPrice(price: CatalogProduct["precio_usd"]) {
  if (price === null || price === "") return null;
  const value = typeof price === "number" ? price : Number(price);
  return Number.isFinite(value) ? value : null;
}

function formatPrice(price: CatalogProduct["precio_usd"]) {
  const value = numericPrice(price);
  return value === null ? "Precio pendiente" : `$${value.toFixed(2)}`;
}

function imagePath(product: CatalogProduct) {
  return product.imagen
    ? `/catalog-previews/shibui/${product.product_id}.jpg`
    : null;
}

function sortSizes(left: string, right: string) {
  const leftIndex = SIZE_ORDER.indexOf(left);
  const rightIndex = SIZE_ORDER.indexOf(right);
  const normalizedLeft = leftIndex === -1 ? SIZE_ORDER.length : leftIndex;
  const normalizedRight = rightIndex === -1 ? SIZE_ORDER.length : rightIndex;
  return normalizedLeft - normalizedRight || left.localeCompare(right, "es");
}

export function ShibuiInventoryPrototype({ catalog }: { catalog: CatalogData }) {
  const initialStock = useMemo(
    () => Object.fromEntries(catalog.variants.map((variant) => [variantKey(variant), variant.cantidad])),
    [catalog.variants],
  );
  const [stock, setStock] = useState<Record<string, number>>(initialStock);
  const [extraVariants, setExtraVariants] = useState<CatalogVariant[]>([]);
  const [view, setView] = useState<"customer" | "stock">("customer");
  const [stockProduct, setStockProduct] = useState<CatalogProduct | null>(null);
  const [showNewCombination, setShowNewCombination] = useState(false);
  const [newColor, setNewColor] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newStock, setNewStock] = useState(1);
  const [category, setCategory] = useState("Todos");
  const [query, setQuery] = useState("");
  const [activeProduct, setActiveProduct] = useState<CatalogProduct | null>(null);
  const [selection, setSelection] = useState<Selection>({ color: "", size: "", detail: "" });
  const [quantity, setQuantity] = useState(1);
  const [confirmation, setConfirmation] = useState("");

  const categories = useMemo(
    () => ["Todos", ...Array.from(new Set(catalog.products.map((product) => product.categoria)))],
    [catalog.products],
  );

  const products = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return catalog.products.filter((product) => {
      const matchesCategory = category === "Todos" || product.categoria === category;
      const matchesQuery = !normalizedQuery || product.nombre.toLocaleLowerCase("es").includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [catalog.products, category, query]);

  const allVariants = useMemo(
    () => [...catalog.variants, ...extraVariants],
    [catalog.variants, extraVariants],
  );

  const activeVariants = useMemo(
    () => allVariants.filter((variant) => variant.product_id === activeProduct?.product_id),
    [activeProduct?.product_id, allVariants],
  );

  const colors = useMemo(
    () => Array.from(new Set(activeVariants.map((variant) => normalizedLabel(variant.color, "Sin color")))).sort((a, b) => a.localeCompare(b, "es")),
    [activeVariants],
  );

  const sizes = useMemo(() => {
    if (!selection.color) return [];
    return Array.from(
      new Set(
        activeVariants
          .filter((variant) => normalizedLabel(variant.color, "Sin color") === selection.color)
          .map((variant) => normalizedLabel(variant.talla, "Única")),
      ),
    ).sort(sortSizes);
  }, [activeVariants, selection.color]);

  const details = useMemo(() => {
    if (!selection.color || !selection.size) return [];
    return Array.from(
      new Set(
        activeVariants
          .filter(
            (variant) =>
              normalizedLabel(variant.color, "Sin color") === selection.color &&
              normalizedLabel(variant.talla, "Única") === selection.size,
          )
          .map((variant) => normalizedLabel(variant.detalle, "Sin detalle")),
      ),
    );
  }, [activeVariants, selection.color, selection.size]);

  const selectedVariant = useMemo(() => {
    if (!selection.color || !selection.size) return null;
    return (
      activeVariants.find(
        (variant) =>
          normalizedLabel(variant.color, "Sin color") === selection.color &&
          normalizedLabel(variant.talla, "Única") === selection.size &&
          (details.length <= 1 || normalizedLabel(variant.detalle, "Sin detalle") === selection.detail),
      ) ?? null
    );
  }, [activeVariants, details.length, selection]);

  const selectedStock = selectedVariant ? stock[variantKey(selectedVariant)] ?? 0 : 0;
  const productStock = (productId: string) =>
    allVariants
      .filter((variant) => variant.product_id === productId)
      .reduce((sum, variant) => sum + (stock[variantKey(variant)] ?? 0), 0);

  const stockProductVariants = useMemo(
    () => allVariants.filter((variant) => variant.product_id === stockProduct?.product_id),
    [allVariants, stockProduct?.product_id],
  );

  function openProduct(product: CatalogProduct) {
    setActiveProduct(product);
    setSelection({ color: "", size: "", detail: "" });
    setQuantity(1);
    setConfirmation("");
  }

  function selectColor(color: string) {
    setSelection({ color, size: "", detail: "" });
    setQuantity(1);
    setConfirmation("");
  }

  function selectSize(size: string) {
    const matchingDetails = activeVariants
      .filter(
        (variant) =>
          normalizedLabel(variant.color, "Sin color") === selection.color &&
          normalizedLabel(variant.talla, "Única") === size,
      )
      .map((variant) => normalizedLabel(variant.detalle, "Sin detalle"));
    setSelection({ color: selection.color, size, detail: matchingDetails.length === 1 ? matchingDetails[0] : "" });
    setQuantity(1);
    setConfirmation("");
  }

  function simulatePurchase() {
    if (!selectedVariant || quantity < 1 || quantity > selectedStock) return;
    const key = variantKey(selectedVariant);
    setStock((current) => ({ ...current, [key]: current[key] - quantity }));
    const detail = normalizedLabel(selectedVariant.detalle, "");
    setConfirmation(
      `${quantity} × ${activeProduct?.nombre} · ${selection.color} · Talla ${selection.size}${detail ? ` · ${detail}` : ""}`,
    );
    setQuantity(1);
  }

  function resetDemo() {
    setStock(initialStock);
    setExtraVariants([]);
    setConfirmation("");
    setQuantity(1);
  }

  function adjustCombination(variant: CatalogVariant, delta: number) {
    const key = variantKey(variant);
    setStock((current) => ({ ...current, [key]: Math.max(0, (current[key] ?? 0) + delta) }));
  }

  function addCombination() {
    if (!stockProduct || !newColor.trim() || !newSize.trim() || newStock < 0) return;
    const variant: CatalogVariant = {
      product_id: stockProduct.product_id,
      color: newColor.trim(),
      talla: newSize.trim(),
      detalle: "",
      cantidad: newStock,
    };
    if (allVariants.some((item) => variantKey(item) === variantKey(variant))) return;
    setExtraVariants((current) => [...current, variant]);
    setStock((current) => ({ ...current, [variantKey(variant)]: newStock }));
    setNewColor("");
    setNewSize("");
    setNewStock(1);
    setShowNewCombination(false);
  }

  const brandStyle = {
    "--brand-primary": "#1F464C",
    "--brand-accent": "#F27533",
    "--brand-button-text": "#25262B",
  } as CSSProperties;

  return (
    <main style={brandStyle} className="vp-public-store vp-container min-h-screen pb-32 pt-5 text-[#25262B]">
      <section className="mx-auto mb-5 max-w-6xl">
        <div className="relative h-64 overflow-hidden rounded-[36px] bg-[#F8F3E8] shadow-2xl shadow-[#2E3A79]/20 md:h-72">
          <Image
            src="/brand/new-somos-preview/somos-logo-preview.png"
            alt="Somos"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 1080px"
            className="object-contain p-10 md:p-12"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#143D42]/90 via-[#143D42]/15 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white md:p-7">
            <div className="flex items-end gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl border-4 border-white bg-[#1F464C] text-3xl font-black text-[#F27533] shadow-xl">S</div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">Comercio aliado</p>
                <h1 className="mt-1 text-3xl font-black leading-tight md:text-5xl">SHIBUI C.A</h1>
                <p className="mt-1 text-sm font-bold text-white/80">Catálogo de prueba en Somos</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-4 flex items-start gap-2 rounded-[24px] bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p><strong>Vista de prueba:</strong> se ve como un catálogo Somos, pero no guarda pedidos ni modifica inventario real.</p>
      </section>

      <nav className="mb-4 grid grid-cols-2 gap-2 rounded-[24px] bg-white p-2 shadow-sm ring-1 ring-[#25262B]/[0.07]" aria-label="Vistas de la demostración">
        <button type="button" onClick={() => { setView("customer"); setStockProduct(null); }} className={`rounded-2xl px-3 py-3 text-sm font-black ${view === "customer" ? "bg-[#2E3A79] text-white" : "bg-[#FFF8F0] text-[#746f69]"}`}>Vista del cliente</button>
        <button type="button" onClick={() => { setView("stock"); setActiveProduct(null); }} className={`rounded-2xl px-3 py-3 text-sm font-black ${view === "stock" ? "bg-[#2E3A79] text-white" : "bg-[#FFF8F0] text-[#746f69]"}`}>Gestionar stock</button>
      </nav>

      {view === "stock" ? (
        <section>
          <div className="mb-4 rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-[#25262B]/[0.07]">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><Boxes size={22} /></span>
              <div><h2 className="text-lg font-black">Inventario de SHIBUI</h2><p className="mt-1 text-sm font-bold text-[#746f69]">Entras por producto y ajustas únicamente sus combinaciones. Todo aquí es una simulación.</p></div>
            </div>
          </div>
          <div className="grid gap-2">
            {catalog.products.filter((product) => numericPrice(product.precio_usd) !== null).map((product) => {
              const total = productStock(product.product_id);
              return (
                <article key={product.product_id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#25262B]/[0.07]">
                  <div className="min-w-0"><h3 className="truncate text-sm font-black">{product.nombre}</h3><p className={`mt-1 text-xs font-black ${total <= 1 ? "text-red-600" : "text-[#746f69]"}`}>{total === 0 ? "Agotado" : `Stock total: ${total}`}</p></div>
                  <button type="button" onClick={() => { setStockProduct(product); setShowNewCombination(false); }} className="shrink-0 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-900 ring-1 ring-emerald-100">Gestionar stock</button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className={view === "customer" ? "" : "hidden"}>

      <section className="mb-4 rounded-3xl bg-white/90 p-3 shadow-lg shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.07]">
        <label className="flex items-center gap-3 rounded-2xl bg-[#FFF8F0] px-4 py-2.5 ring-1 ring-[#25262B]/[0.06]">
          <Search aria-hidden="true" size={18} className="text-[#746f69]" />
          <span className="sr-only">Buscar productos</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar productos" className="w-full bg-transparent text-sm font-bold text-[#25262B] outline-none placeholder:text-[#746f69]/70" />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda"><X size={17} /></button> : null}
        </label>
      </section>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((item) => (
          <button key={item} type="button" onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-black shadow-sm ring-1 ${category === item ? "bg-[#2E3A79] text-white ring-[#2E3A79]" : "bg-white text-[#746f69] ring-[#25262B]/[0.07]"}`}>
            {item}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Catálogo</p>
          <h2 className="text-xl font-black">Productos</h2>
        </div>
        <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#746f69] shadow-sm">{products.length} productos</span>
      </div>

      <div className="grid gap-2">
        {products.map((product) => {
          const available = productStock(product.product_id);
          const pending = numericPrice(product.precio_usd) === null;
          const path = imagePath(product);
          return (
            <article key={product.product_id} className="min-h-[128px] rounded-2xl bg-white p-2 shadow-sm ring-1 ring-[#25262B]/[0.07]">
              <div className="grid min-h-[112px] grid-cols-[76px_minmax(0,1fr)] gap-2.5">
                <button type="button" onClick={() => openProduct(product)} className="relative h-[112px] overflow-hidden rounded-xl bg-[#F8F3E8] text-left" aria-label={`Ver ${product.nombre}`}>
                  {path ? <Image src={path} alt={product.nombre} fill sizes="76px" className="object-cover" /> : <span className="grid h-full place-items-center px-2 text-center text-xs font-black text-[#2E3A79]">Imagen pendiente</span>}
                </button>
                <div className="flex min-w-0 flex-col">
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#746f69]">{product.categoria}</p>
                  <h3 className="truncate text-sm font-black leading-tight">{product.nombre}</h3>
                  <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug text-[#746f69]">Elige el color y la talla disponibles.</p>
                  <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
                    <div className="min-w-0">
                      <p className={`text-sm font-black ${pending ? "text-amber-700" : "text-[#25262B]"}`}>{formatPrice(product.precio_usd)}</p>
                      <p className={`text-[11px] font-black ${available <= 1 ? "text-red-600" : "text-[#746f69]"}`}>{available > 0 ? `${available} disponibles` : "Agotado"}</p>
                    </div>
                    <button type="button" onClick={() => openProduct(product)} disabled={available === 0 || pending} className="inline-flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-full bg-[#FFB547] px-3 text-[11px] font-black disabled:bg-[#F8F3E8] disabled:text-[#746f69]">
                      <Plus size={15} /> {pending ? "Pendiente" : available === 0 ? "Agotado" : "Añadir"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!products.length ? (
        <div className="rounded-[28px] bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-black">No encontramos productos</p>
          <button type="button" onClick={() => { setQuery(""); setCategory("Todos"); }} className="mt-2 text-sm font-black text-[#2E3A79] underline">Ver todo el catálogo</button>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-[24px] bg-[#2E3A79] p-3 text-white shadow-2xl">
          <div className="flex min-w-0 items-center gap-2">
            <ShoppingBag className="shrink-0 text-[#FFB547]" size={20} />
            <div className="min-w-0"><p className="text-sm font-black">Compra simulada</p><p className="truncate text-[11px] font-bold text-white/70">No se enviará ningún pedido</p></div>
          </div>
          <button type="button" onClick={resetDemo} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-black text-[#2E3A79]"><RotateCcw size={14} /> Reiniciar</button>
        </div>
      </div>

      {activeProduct ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-[#25262B]/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label={`Opciones de ${activeProduct.nombre}`}>
          <section className="max-h-[88vh] w-full overflow-y-auto rounded-[28px] bg-white p-4 pb-6 shadow-2xl sm:max-w-xl">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Añade tu producto</p><h2 className="mt-1 text-2xl font-black">{activeProduct.nombre}</h2><p className="mt-1 text-sm font-bold text-[#746f69]">{formatPrice(activeProduct.precio_usd)} · {productStock(activeProduct.product_id)} disponibles</p></div>
              <button type="button" onClick={() => setActiveProduct(null)} aria-label="Cerrar personalización" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F8F3E8] text-[#2E3A79]"><X size={18} /></button>
            </div>

            {CURRENT_PRODUCT_NOTES[activeProduct.product_id] ? <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900 ring-1 ring-amber-200">{CURRENT_PRODUCT_NOTES[activeProduct.product_id]}</div> : null}
            {activeProduct.estado_importacion === "REVISAR" ? <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">Este producto requiere revisión antes de importarse{numericPrice(activeProduct.precio_usd) === null ? " porque no tiene precio" : " porque no tiene imagen"}.</div> : null}

            <fieldset className="mt-4 rounded-2xl bg-[#FFF8F0] p-3" disabled={numericPrice(activeProduct.precio_usd) === null}>
              <legend className="text-sm font-black">Color <span className="ml-1 rounded-full bg-[#FFB547] px-2 py-1 text-[10px]">Obligatorio</span></legend>
              <p className="mt-1 text-xs font-bold text-[#746f69]">Selecciona un color para ver sus tallas.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">{colors.map((color) => { const available = activeVariants.filter((variant) => normalizedLabel(variant.color, "Sin color") === color).reduce((sum, variant) => sum + (stock[variantKey(variant)] ?? 0), 0); return <button key={color} type="button" disabled={available === 0} onClick={() => selectColor(color)} className={`rounded-2xl px-3 py-3 text-sm font-black ring-1 disabled:bg-slate-100 disabled:text-slate-400 ${selection.color === color ? "bg-[#2E3A79] text-white ring-[#2E3A79]" : "bg-white ring-[#25262B]/[0.07]"}`}>{color} ({available})</button>; })}</div>
            </fieldset>

            <fieldset className="mt-4 rounded-2xl bg-[#FFF8F0] p-3" disabled={!selection.color || numericPrice(activeProduct.precio_usd) === null}>
              <legend className="text-sm font-black">Talla <span className="ml-1 rounded-full bg-[#FFB547] px-2 py-1 text-[10px]">Obligatorio</span></legend>
              {!selection.color ? <p className="mt-1 text-xs font-bold text-[#746f69]">Primero selecciona un color.</p> : null}
              <div className="mt-3 grid grid-cols-3 gap-2">{sizes.map((size) => { const available = activeVariants.filter((variant) => normalizedLabel(variant.color, "Sin color") === selection.color && normalizedLabel(variant.talla, "Única") === size).reduce((sum, variant) => sum + (stock[variantKey(variant)] ?? 0), 0); return <button key={size} type="button" disabled={available === 0} onClick={() => selectSize(size)} className={`rounded-2xl px-3 py-3 text-sm font-black ring-1 disabled:bg-slate-100 disabled:text-slate-400 ${selection.size === size ? "bg-[#2E3A79] text-white ring-[#2E3A79]" : "bg-white ring-[#25262B]/[0.07]"}`}>{size} ({available})</button>; })}</div>
            </fieldset>

            {details.length > 1 ? <fieldset className="mt-4 rounded-2xl bg-[#FFF8F0] p-3" disabled={!selection.size}><legend className="text-sm font-black">Detalle</legend><div className="mt-3 grid gap-2">{details.map((detail) => { const variant = activeVariants.find((item) => normalizedLabel(item.color, "Sin color") === selection.color && normalizedLabel(item.talla, "Única") === selection.size && normalizedLabel(item.detalle, "Sin detalle") === detail); const available = variant ? stock[variantKey(variant)] ?? 0 : 0; return <button key={detail} type="button" disabled={available === 0} onClick={() => { setSelection((current) => ({ ...current, detail })); setQuantity(1); setConfirmation(""); }} className={`rounded-2xl px-3 py-3 text-sm font-black ring-1 disabled:bg-slate-100 disabled:text-slate-400 ${selection.detail === detail ? "bg-[#2E3A79] text-white ring-[#2E3A79]" : "bg-white ring-[#25262B]/[0.07]"}`}>{detail} ({available})</button>; })}</div></fieldset> : null}

            {selectedVariant ? <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#F8F3E8] p-3"><div><p className="text-sm font-bold text-[#746f69]">Cantidad</p><p className={`text-sm font-black ${selectedStock <= 1 ? "text-red-600" : ""}`}>{selectedStock === 0 ? "Agotado" : selectedStock === 1 ? "Última unidad" : `${selectedStock} disponibles`}</p></div><div className="flex items-center overflow-hidden rounded-xl bg-white ring-1 ring-[#25262B]/10"><button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={quantity <= 1} className="p-3 disabled:opacity-30" aria-label="Restar cantidad"><Minus size={16} /></button><span className="min-w-8 text-center font-black">{quantity}</span><button type="button" onClick={() => setQuantity((current) => Math.min(selectedStock, current + 1))} disabled={quantity >= selectedStock} className="p-3 disabled:opacity-30" aria-label="Sumar cantidad"><Plus size={16} /></button></div></div> : null}

            {confirmation ? <div className="mt-4 flex items-start gap-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900"><PackageCheck className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>Compra simulada:</strong> {confirmation}. Solo cambió esta demostración.</p></div> : null}

            <button type="button" onClick={simulatePurchase} disabled={!selectedVariant || selectedStock === 0 || numericPrice(activeProduct.precio_usd) === null} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:bg-[#F8F3E8] disabled:text-[#746f69]">
              {confirmation ? <Check size={18} /> : <Plus size={18} />}
              {numericPrice(activeProduct.precio_usd) === null ? "Pendiente por definir precio" : selectedStock === 0 && selectedVariant ? "Combinación agotada" : "Añadir al carrito (simulado)"}
            </button>
          </section>
        </div>
      ) : null}
      </div>

      {stockProduct ? (
        <div className="fixed inset-0 z-[80] flex items-end bg-[#25262B]/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label={`Stock de ${stockProduct.nombre}`}>
          <section className="max-h-[88vh] w-full overflow-y-auto rounded-[28px] bg-white p-4 pb-6 shadow-2xl sm:max-w-xl">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Gestionar stock</p><h2 className="mt-1 text-2xl font-black">{stockProduct.nombre}</h2><p className="mt-1 text-sm font-bold text-[#746f69]">Stock total: {productStock(stockProduct.product_id)}</p></div>
              <button type="button" onClick={() => setStockProduct(null)} aria-label="Cerrar gestión de stock" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F8F3E8] text-[#2E3A79]"><X size={18} /></button>
            </div>

            <div className="mt-4 grid gap-2">
              {stockProductVariants.map((variant) => {
                const current = stock[variantKey(variant)] ?? 0;
                const label = [normalizedLabel(variant.color, "Sin color"), normalizedLabel(variant.talla, "Única")].join(" · ");
                return (
                  <div key={variantKey(variant)} className="flex items-center justify-between gap-3 rounded-2xl bg-[#FFF8F0] p-3">
                    <div><p className="text-sm font-black">{label}</p><p className={`text-xs font-bold ${current <= 1 ? "text-red-600" : "text-[#746f69]"}`}>{current === 0 ? "Agotado" : current === 1 ? "Última unidad" : `${current} disponibles`}</p></div>
                    <div className="flex items-center overflow-hidden rounded-xl bg-white ring-1 ring-[#25262B]/10">
                      <button type="button" onClick={() => adjustCombination(variant, -1)} disabled={current === 0} className="p-3 disabled:opacity-30" aria-label={`Restar stock de ${label}`}><Minus size={16} /></button>
                      <span className="min-w-9 text-center font-black">{current}</span>
                      <button type="button" onClick={() => adjustCombination(variant, 1)} className="p-3" aria-label={`Sumar stock de ${label}`}><Plus size={16} /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            {showNewCombination ? (
              <div className="mt-4 grid gap-3 rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
                <p className="text-sm font-black text-emerald-950">Nueva combinación</p>
                <div className="grid grid-cols-2 gap-2"><input value={newColor} onChange={(event) => setNewColor(event.target.value)} placeholder="Color" className="h-11 rounded-xl bg-white px-3 text-sm font-bold outline-none ring-1 ring-[#25262B]/10" /><input value={newSize} onChange={(event) => setNewSize(event.target.value)} placeholder="Talla" className="h-11 rounded-xl bg-white px-3 text-sm font-bold outline-none ring-1 ring-[#25262B]/10" /></div>
                <label className="grid gap-1 text-xs font-black text-[#746f69]">Cantidad inicial<input type="number" min="0" value={newStock} onChange={(event) => setNewStock(Math.max(0, Number(event.target.value) || 0))} className="h-11 rounded-xl bg-white px-3 text-sm font-black text-[#25262B] outline-none ring-1 ring-[#25262B]/10" /></label>
                <div className="flex gap-2"><button type="button" onClick={() => setShowNewCombination(false)} className="flex-1 rounded-full bg-white px-3 py-3 text-xs font-black text-[#746f69]">Cancelar</button><button type="button" onClick={addCombination} disabled={!newColor.trim() || !newSize.trim()} className="flex-1 rounded-full bg-[#2E3A79] px-3 py-3 text-xs font-black text-white disabled:opacity-40">Agregar</button></div>
              </div>
            ) : (
              <button type="button" onClick={() => setShowNewCombination(true)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-900 ring-1 ring-emerald-100"><PackagePlus size={17} /> Agregar combinación</button>
            )}
            <p className="mt-3 text-center text-xs font-bold text-[#746f69]">Los cambios son solo para probar la experiencia; no se guardan.</p>
          </section>
        </div>
      ) : null}
    </main>
  );
}
