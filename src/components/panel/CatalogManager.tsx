"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";

type StoreRow = {
  id: string;
  slug: string;
  name: string;
};

type CategoryRow = {
  id: string;
  store_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type ProductRow = {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_usd: number | string;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
  stores?: { name?: string; slug?: string } | null;
  categories?: { name?: string } | null;
};

function getSavedToken() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("vendeplus_panel_token") || "";
}

function getSavedPin() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("vendeplus_panel_pin") || "";
}

async function apiRequest(pin: string, options?: RequestInit) {
  const response = await fetch("/api/panel/catalogo", {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(getSavedToken()
        ? { Authorization: `Bearer ${getSavedToken()}` }
        : { "x-panel-pin": pin }),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error en la solicitud.");
  }

  return data;
}

function CategoryEditor({
  category,
  productCount,
  pin,
  onSaved,
}: {
  category: CategoryRow;
  productCount: number;
  pin: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    name: category.name,
    sort_order: category.sort_order || 0,
    is_active: category.is_active !== false,
  });
  const [isSaving, setIsSaving] = useState(false);

  async function saveCategory() {
    setIsSaving(true);

    try {
      await apiRequest(pin, {
        method: "PATCH",
        body: JSON.stringify({
          resource: "category",
          id: category.id,
          ...draft,
        }),
      });

      onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="rounded-[28px] bg-white p-4 shadow-lg shadow-[#2E3A79]/[0.05] ring-1 ring-[#25262B]/[0.06]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1">
          <input
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
          />

          <p className="mt-2 text-xs font-bold text-[#746f69]">
            {productCount} productos dentro de esta categoría.
          </p>
        </div>

        <input
          type="number"
          value={draft.sort_order}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              sort_order: Number(event.target.value || 0),
            }))
          }
          className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79] lg:w-28"
          placeholder="Orden visual"
        />

        <button
          type="button"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              is_active: !current.is_active,
            }))
          }
          className={[
            "inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-xs font-black",
            draft.is_active
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700",
          ].join(" ")}
        >
          {draft.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
          {draft.is_active ? "Activa" : "Oculta"}
        </button>

        <button
          type="button"
          onClick={saveCategory}
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar
        </button>
      </div>
    </article>
  );
}

function ProductCatalogCard({
  product,
  categories,
  pin,
  onSaved,
}: {
  product: ProductRow;
  categories: CategoryRow[];
  pin: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    category_id: product.category_id || "",
    sort_order: product.sort_order || 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  async function updateProduct(patch: Record<string, unknown>) {
    setIsSaving(true);

    try {
      await apiRequest(pin, {
        method: "PATCH",
        body: JSON.stringify({
          resource: "product",
          id: product.id,
          ...patch,
        }),
      });

      onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="rounded-[28px] bg-white p-4 shadow-lg shadow-[#2E3A79]/[0.05] ring-1 ring-[#25262B]/[0.06]">
      <div className="grid gap-4 md:grid-cols-[110px_1fr]">
        <div className="overflow-hidden rounded-3xl bg-[#F8F3E8]">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-32 w-full object-cover md:h-full"
            />
          ) : (
            <div className="grid h-32 place-items-center text-[#746f69]">
              <ImageIcon size={30} />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-col justify-between gap-2 lg:flex-row lg:items-start">
            <div>
              <h3 className="text-lg font-black">{product.name}</h3>
              <p className="text-sm font-bold text-[#746f69]">
                ${Number(product.price_usd || 0).toFixed(2)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  updateProduct({ is_available: !product.is_available })
                }
                disabled={isSaving}
                className={[
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black",
                  product.is_available
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700",
                ].join(" ")}
              >
                {product.is_available ? <Eye size={14} /> : <EyeOff size={14} />}
                {product.is_available ? "Disponible" : "Oculto"}
              </button>

              <button
                type="button"
                onClick={() =>
                  updateProduct({ is_featured: !product.is_featured })
                }
                disabled={isSaving}
                className={[
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black",
                  product.is_featured
                    ? "bg-[#FFB547] text-[#25262B]"
                    : "bg-[#F8F3E8] text-[#746f69]",
                ].join(" ")}
              >
                <Sparkles size={14} />
                {product.is_featured ? "Destacado" : "Normal"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_110px_auto]">
            <select
              value={draft.category_id}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  category_id: event.target.value,
                }))
              }
              className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            >
              <option value="">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              value={draft.sort_order}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  sort_order: Number(event.target.value || 0),
                }))
              }
              className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              placeholder="Orden visual"
            />

            <button
              type="button"
              onClick={() => updateProduct(draft)}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function CatalogManager() {
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryOrder, setNewCategoryOrder] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  async function loadData(currentPin: string) {
    setIsLoading(true);
    setError("");

    try {
      const data = await apiRequest(currentPin);

      setStores(data.stores || []);
      setCategories(data.categories || []);
      setProducts(data.products || []);

      const firstStoreId = data.stores?.[0]?.id || "";
      setSelectedStoreId((current) => current || firstStoreId);

      setIsUnlocked(true);
      sessionStorage.setItem("vendeplus_panel_pin", currentPin);
    } catch (error: any) {
      setError(error.message || "No se pudo abrir el catálogo.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function createCategory() {
    if (!selectedStoreId) {
      setError("Selecciona un comercio.");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      await apiRequest(pin, {
        method: "POST",
        body: JSON.stringify({
          store_id: selectedStoreId,
          name: newCategoryName,
          sort_order: newCategoryOrder,
          is_active: true,
        }),
      });

      setNewCategoryName("");
      setNewCategoryOrder(0);
      await loadData(pin);
    } catch (error: any) {
      setError(error.message || "No se pudo crear la categoría.");
    } finally {
      setIsCreating(false);
    }
  }

  useEffect(() => {
    const savedPin = getSavedPin();
    const savedToken = getSavedToken();

    if (savedPin || savedToken) {
      setPin(savedPin);
      loadData(savedPin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedStore = stores.find((store) => store.id === selectedStoreId);

  const storeCategories = useMemo(
    () =>
      categories
        .filter((category) => category.store_id === selectedStoreId)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [categories, selectedStoreId]
  );

  const storeProducts = useMemo(
    () =>
      products
        .filter((product) => product.store_id === selectedStoreId)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [products, selectedStoreId]
  );

  const uncategorizedProducts = storeProducts.filter(
    (product) => !product.category_id
  );

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso del catálogo</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Ingresa el PIN temporal o entra con una sesión autorizada para administrar el catálogo.
        </p>

        <input
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="PIN de acceso"
          type="password"
          className="mt-5 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-center text-lg font-black outline-none focus:border-[#2E3A79]"
        />

        <button
          type="button"
          onClick={() => loadData(pin)}
          disabled={isLoading}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          Entrar al catálogo
        </button>

        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <h2 className="text-2xl font-black">Centro de catálogo</h2>
            <p className="text-sm font-bold text-[#746f69]">
              Administra categorías, orden visual, disponibilidad y productos destacados.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadData(pin)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
            Actualizar
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_160px_160px]">
          <select
            value={selectedStoreId}
            onChange={(event) => setSelectedStoreId(event.target.value)}
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>

          <div className="rounded-2xl bg-[#F8F3E8] px-4 py-3">
            <p className="text-xs font-black text-[#746f69]">Categorías creadas</p>
            <p className="text-xl font-black text-[#2E3A79]">{storeCategories.length}</p>
          </div>

          <div className="rounded-2xl bg-[#F8F3E8] px-4 py-3">
            <p className="text-xs font-black text-[#746f69]">Productos cargados</p>
            <p className="text-xl font-black text-[#2E3A79]">{storeProducts.length}</p>
          </div>
        </div>

        {selectedStore && (
          <p className="mt-3 text-xs font-bold text-[#746f69]">
            Comercio activo: <span className="font-black text-[#25262B]">{selectedStore.name}</span>
          </p>
        )}
      </section>

      <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <h2 className="text-2xl font-black">Crear categoría</h2>
            <p className="text-sm font-bold text-[#746f69]">
              Organiza el catálogo por secciones claras. La cantidad de productos se calcula automáticamente según los productos asignados a cada categoría.
            </p>
          </div>

          <button
            type="button"
            onClick={createCategory}
            disabled={isCreating}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
          >
            {isCreating ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
            Crear categoría
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_140px]">
          <input
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="Nombre de la categoría"
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />

          <input
            type="number"
            value={newCategoryOrder}
            onChange={(event) => setNewCategoryOrder(Number(event.target.value || 0))}
            placeholder="Orden visual"
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </div>

        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-black">Categorías del comercio</h2>
          <p className="text-sm font-bold text-[#746f69]">
            Puedes cambiar nombre, orden y visibilidad de cada categoría.
          </p>
        </div>

        {storeCategories.length ? (
          storeCategories.map((category) => (
            <CategoryEditor
              key={category.id}
              category={category}
              productCount={
                storeProducts.filter((product) => product.category_id === category.id).length
              }
              pin={pin}
              onSaved={() => loadData(pin)}
            />
          ))
        ) : (
          <div className="rounded-[30px] bg-white p-6 text-center font-bold text-[#746f69] ring-1 ring-[#25262B]/[0.06]">
            Este comercio todavía no tiene categorías.
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-black">Productos agrupados</h2>
          <p className="text-sm font-bold text-[#746f69]">
            Control rápido de categoría, orden, disponibilidad y destacados.
          </p>
        </div>

        {storeCategories.map((category) => {
          const categoryProducts = storeProducts.filter(
            (product) => product.category_id === category.id
          );

          return (
            <div key={category.id} className="space-y-3">
              <div className="flex items-center justify-between rounded-3xl bg-[#2E3A79] px-5 py-4 text-white">
                <h3 className="font-black">{category.name}</h3>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">
                  {categoryProducts.length} productos
                </span>
              </div>

              {categoryProducts.length ? (
                categoryProducts.map((product) => (
                  <ProductCatalogCard
                    key={product.id}
                    product={product}
                    categories={storeCategories}
                    pin={pin}
                    onSaved={() => loadData(pin)}
                  />
                ))
              ) : (
                <div className="rounded-[28px] bg-white p-5 text-sm font-bold text-[#746f69] ring-1 ring-[#25262B]/[0.06]">
                  No hay productos en esta categoría.
                </div>
              )}
            </div>
          );
        })}

        {uncategorizedProducts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-3xl bg-[#25262B] px-5 py-4 text-white">
              <h3 className="font-black">Sin categoría</h3>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">
                {uncategorizedProducts.length} productos
              </span>
            </div>

            {uncategorizedProducts.map((product) => (
              <ProductCatalogCard
                key={product.id}
                product={product}
                categories={storeCategories}
                pin={pin}
                onSaved={() => loadData(pin)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

