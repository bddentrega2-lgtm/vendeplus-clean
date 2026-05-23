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
  sort_order?: number;
  is_active?: boolean;
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
  stores?: { name?: string } | null;
  categories?: { name?: string } | null;
};

function getSavedPin() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("vendeplus_panel_pin") || "";
}

async function apiRequest(pin: string, options?: RequestInit) {
  const response = await fetch("/api/panel/products", {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-panel-pin": pin,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error en la solicitud.");
  }

  return data;
}

function ProductEditor({
  product,
  stores,
  categories,
  pin,
  onSaved,
}: {
  product: ProductRow;
  stores: StoreRow[];
  categories: CategoryRow[];
  pin: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    store_id: product.store_id,
    category_id: product.category_id || "",
    name: product.name,
    description: product.description || "",
    price_usd: String(product.price_usd || 0),
    image_url: product.image_url || "",
    is_available: product.is_available,
    is_featured: product.is_featured,
    sort_order: product.sort_order || 0,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const filteredCategories = categories.filter(
    (category) => category.store_id === draft.store_id
  );

  async function saveProduct() {
    setIsSaving(true);
    setMessage("");

    try {
      await apiRequest(pin, {
        method: "PATCH",
        body: JSON.stringify({
          id: product.id,
          ...draft,
          price_usd: Number(draft.price_usd || 0),
        }),
      });

      setMessage("Producto guardado correctamente.");
      onSaved();
    } catch (error: any) {
      setMessage(error.message || "Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="rounded-[32px] bg-white p-4 shadow-xl shadow-[#2E3A79]/[0.06] ring-1 ring-[#25262B]/[0.06]">
      <div className="grid gap-4 xl:grid-cols-[220px_1fr]">
        <div className="overflow-hidden rounded-[28px] bg-[#F8F3E8]">
          {draft.image_url ? (
            <img
              src={draft.image_url}
              alt={draft.name}
              className="h-48 w-full object-cover xl:h-full"
            />
          ) : (
            <div className="grid h-48 place-items-center text-[#746f69]">
              <ImageIcon size={34} />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Nombre del producto"
              className="w-full rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />

            <input
              type="number"
              step="0.01"
              value={draft.price_usd}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  price_usd: event.target.value,
                }))
              }
              placeholder="Precio USD"
              className="w-full rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />
          </div>

          <textarea
            value={draft.description}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Descripción"
            rows={2}
            className="w-full rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />

          <input
            value={draft.image_url}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                image_url: event.target.value,
              }))
            }
            placeholder="URL de imagen"
            className="w-full rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={draft.store_id}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  store_id: event.target.value,
                  category_id: "",
                }))
              }
              className="w-full rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>

            <select
              value={draft.category_id}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  category_id: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            >
              <option value="">Sin categoría</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    is_available: !current.is_available,
                  }))
                }
                className={[
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black",
                  draft.is_available
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700",
                ].join(" ")}
              >
                {draft.is_available ? <Eye size={14} /> : <EyeOff size={14} />}
                {draft.is_available ? "Activo" : "Oculto"}
              </button>

              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    is_featured: !current.is_featured,
                  }))
                }
                className={[
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black",
                  draft.is_featured
                    ? "bg-[#FFB547] text-[#25262B]"
                    : "bg-[#F8F3E8] text-[#746f69]",
                ].join(" ")}
              >
                <Sparkles size={14} />
                {draft.is_featured ? "Destacado" : "Normal"}
              </button>
            </div>

            <button
              type="button"
              onClick={saveProduct}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Guardar
            </button>
          </div>

          {message && (
            <p className="text-xs font-black text-[#2E3A79]">{message}</p>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductManager() {
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [newProduct, setNewProduct] = useState({
    store_id: "",
    category_id: "",
    name: "",
    description: "",
    price_usd: "0",
    image_url: "",
    is_available: true,
    is_featured: false,
    sort_order: 99,
  });

  const filteredNewCategories = useMemo(
    () =>
      categories.filter((category) => category.store_id === newProduct.store_id),
    [categories, newProduct.store_id]
  );

  async function loadData(currentPin: string) {
    setIsLoading(true);
    setError("");

    try {
      const data = await apiRequest(currentPin);

      setStores(data.stores || []);
      setCategories(data.categories || []);
      setProducts(data.products || []);

      if (!newProduct.store_id && data.stores?.[0]?.id) {
        setNewProduct((current) => ({
          ...current,
          store_id: data.stores[0].id,
        }));
      }

      setIsUnlocked(true);
      sessionStorage.setItem("vendeplus_panel_pin", currentPin);
    } catch (error: any) {
      setError(error.message || "No se pudo abrir el panel.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function createProduct() {
    setIsLoading(true);
    setError("");

    try {
      await apiRequest(pin, {
        method: "POST",
        body: JSON.stringify({
          ...newProduct,
          price_usd: Number(newProduct.price_usd || 0),
        }),
      });

      setNewProduct((current) => ({
        ...current,
        category_id: "",
        name: "",
        description: "",
        price_usd: "0",
        image_url: "",
        is_available: true,
        is_featured: false,
      }));

      await loadData(pin);
    } catch (error: any) {
      setError(error.message || "No se pudo crear el producto.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const savedPin = getSavedPin();

    if (savedPin) {
      setPin(savedPin);
      loadData(savedPin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso del panel</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Ingresa el PIN temporal de administración para editar productos.
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
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <CheckCircle2 size={18} />
          )}
          Entrar al panel
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
            <h2 className="text-2xl font-black">Crear producto</h2>
            <p className="text-sm font-bold text-[#746f69]">
              Crea un producto y aparecerá en el catálogo público del comercio.
            </p>
          </div>
          <button
            type="button"
            onClick={createProduct}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Plus size={17} />
            )}
            Crear producto
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <select
            value={newProduct.store_id}
            onChange={(event) =>
              setNewProduct((current) => ({
                ...current,
                store_id: event.target.value,
                category_id: "",
              }))
            }
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>

          <select
            value={newProduct.category_id}
            onChange={(event) =>
              setNewProduct((current) => ({
                ...current,
                category_id: event.target.value,
              }))
            }
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          >
            <option value="">Sin categoría</option>
            {filteredNewCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <input
            value={newProduct.name}
            onChange={(event) =>
              setNewProduct((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="Nombre"
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />

          <input
            type="number"
            step="0.01"
            value={newProduct.price_usd}
            onChange={(event) =>
              setNewProduct((current) => ({
                ...current,
                price_usd: event.target.value,
              }))
            }
            placeholder="Precio USD"
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <input
            value={newProduct.description}
            onChange={(event) =>
              setNewProduct((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Descripción"
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />

          <input
            value={newProduct.image_url}
            onChange={(event) =>
              setNewProduct((current) => ({
                ...current,
                image_url: event.target.value,
              }))
            }
            placeholder="URL de imagen"
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </div>

        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-black">Productos editables</h2>
            <p className="text-sm font-bold text-[#746f69]">
              {products.length} productos conectados a Supabase.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadData(pin)}
            className="rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white"
          >
            Actualizar lista
          </button>
        </div>

        {products.map((product) => (
          <ProductEditor
            key={product.id}
            product={product}
            stores={stores}
            categories={categories}
            pin={pin}
            onSaved={() => loadData(pin)}
          />
        ))}
      </section>
    </div>
  );
}
