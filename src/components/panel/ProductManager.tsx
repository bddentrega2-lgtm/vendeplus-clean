"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Grid2X2,
  ImageIcon,
  LayoutList,
  Loader2,
  Lock,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { PanelAccessGate, PanelModuleSkeleton } from "@/components/panel/PanelLoadingState";
import {
  getPanelAccessToken,
  getPanelAuthHeaders,
  getSavedPanelPin,
  hasSavedPanelAuth,
  savePanelPin,
  shouldShowPanelInitialAccessGate,
} from "@/lib/panel/client-auth";
import { compressImageForUpload } from "@/lib/images/client-compress";

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
  product_option_group_products?: Array<{
    product_option_groups?: {
      id: string;
      name: string;
    } | null;
  }>;
};

function getProductOptionGroups(product: ProductRow) {
  return (product.product_option_group_products || [])
    .map((assignment) => assignment.product_option_groups)
    .filter(Boolean) as Array<{ id: string; name: string }>;
}

async function apiRequest(pin: string, options?: RequestInit & { url?: string }) {
  const { url = "/api/panel/products", ...requestOptions } = options || {};
  const response = await fetch(url, {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...(await getPanelAuthHeaders(pin)),
      ...(requestOptions.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error en la solicitud.");
  }

  return data;
}

async function uploadProductImage(
  file: File,
  storeId: string,
  productId?: string,
  pin?: string
) {
  const uploadFile = await compressImageForUpload(file);
  const formData = new FormData();
  formData.append("file", uploadFile);
  formData.append("store_id", storeId);
  formData.append("product_id", productId || "new-product");

  const response = await fetch("/api/panel/uploads", {
    method: "POST",
    headers: await getPanelAuthHeaders(pin || ""),
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "No se pudo subir la imagen.");
  }

  return data as { path: string; publicUrl: string };
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
    price_usd: product.price_usd ? String(product.price_usd) : "",
    image_url: product.image_url || "",
    is_available: product.is_available,
    is_featured: product.is_featured,
    sort_order: product.sort_order ? String(product.sort_order) : "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredCategories = categories.filter(
    (category) => category.store_id === draft.store_id
  );
  const optionGroups = getProductOptionGroups(product);

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
          sort_order: Number(draft.sort_order || 0),
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

  async function handleImageUpload(file?: File) {
    if (!file) return;

    setIsUploadingImage(true);
    setMessage("Subiendo imagen...");

    try {
      const data = await uploadProductImage(file, draft.store_id, product.id, pin);
      setDraft((current) => ({ ...current, image_url: data.publicUrl }));
      setMessage("Imagen subida. Presiona Guardar para aplicar.");
    } catch (error: any) {
      setMessage(error.message || "No se pudo subir la imagen.");
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deleteProduct() {
    const confirmed = window.confirm(
      `¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    setMessage("");

    try {
      await apiRequest(pin, {
        method: "DELETE",
        body: JSON.stringify({ id: product.id }),
      });

      setMessage("Producto eliminado correctamente.");
      onSaved();
    } catch (error: any) {
      setMessage(error.message || "No se pudo eliminar el producto.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <article className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#25262B]/[0.06]">
      <div className="grid gap-3 xl:grid-cols-[124px_1fr]">
        <div className="aspect-square overflow-hidden rounded-2xl bg-[#F8F3E8]">
          {draft.image_url ? (
            <img
              src={draft.image_url}
              alt={draft.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-[#746f69]">
              <ImageIcon size={26} />
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

          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleImageUpload(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
            >
              {isUploadingImage ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              Subir imagen
            </button>
            {draft.image_url && (
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    image_url: "",
                  }))
                }
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F8F3E8] px-5 py-3 text-sm font-black text-[#2E3A79]"
              >
                Quitar imagen
              </button>
            )}
          </div>

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

          <input
            type="number"
            value={draft.sort_order}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                sort_order: event.target.value,
              }))
            }
            placeholder="Orden en catálogo"
            className="w-full rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />

          <div className="flex flex-col gap-3 rounded-2xl bg-[#F8F3E8] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black">Opciones y extras</p>
              <p className="text-xs font-bold text-[#746f69]">
                {optionGroups.length
                  ? `Opciones: ${optionGroups.map((group) => group.name).join(", ")}`
                  : "Este producto todavía no tiene opciones aplicadas."}
              </p>
            </div>
            <Link
              href="/panel/opciones"
              className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-black text-[#2E3A79]"
            >
              Gestionar opciones
            </Link>
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
              disabled={isSaving || isDeleting}
              className="inline-flex items-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Guardar
            </button>

            <button
              type="button"
              onClick={deleteProduct}
              disabled={isSaving || isDeleting}
              className="inline-flex items-center gap-2 rounded-full bg-red-100 px-5 py-3 text-sm font-black text-red-700 disabled:opacity-60"
            >
              {isDeleting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              Eliminar
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
  const [page, setPage] = useState({ limit: 120, offset: 0, hasMore: false });
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => shouldShowPanelInitialAccessGate());
  const [isLoading, setIsLoading] = useState(() => hasSavedPanelAuth());
  const [isUploadingNewImage, setIsUploadingNewImage] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productView, setProductView] = useState<"comfortable" | "compact">(
    "compact"
  );
  const [error, setError] = useState("");
  const [newProductMessage, setNewProductMessage] = useState("");
  const newProductFileInputRef = useRef<HTMLInputElement>(null);

  const [newProduct, setNewProduct] = useState({
    store_id: "",
    category_id: "",
    name: "",
    description: "",
    price_usd: "",
    image_url: "",
    is_available: true,
    is_featured: false,
    sort_order: "",
  });

  const filteredNewCategories = useMemo(
    () =>
      categories.filter((category) => category.store_id === newProduct.store_id),
    [categories, newProduct.store_id]
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = productQuery.trim().toLowerCase();

    if (!normalizedQuery) return products;

    return products.filter((product) => {
      const haystack = [
        product.name,
        product.description || "",
        product.categories?.name || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [productQuery, products]);

  async function loadData(currentPin: string, nextOffset = 0) {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        limit: String(page.limit),
        offset: String(nextOffset),
      });
      const data = await apiRequest(currentPin, { url: `/api/panel/products?${params}` });

      setStores(data.stores || []);
      setCategories(data.categories || []);
      setProducts((current) =>
        nextOffset > 0 ? [...current, ...(data.products || [])] : data.products || []
      );
      setPage(data.page || { limit: page.limit, offset: nextOffset, hasMore: false });

      if (!newProduct.store_id && data.stores?.[0]?.id) {
        setNewProduct((current) => ({
          ...current,
          store_id: data.stores[0].id,
        }));
      }

      setIsUnlocked(true);
      savePanelPin(currentPin);
    } catch (error: any) {
      setError(error.message || "No se pudo abrir el panel.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
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
          sort_order: Number(newProduct.sort_order || 99),
        }),
      });

      setNewProduct((current) => ({
        ...current,
        category_id: "",
        name: "",
        description: "",
        price_usd: "",
        image_url: "",
        is_available: true,
        is_featured: false,
      }));
      setNewProductMessage("");
      setIsCreateOpen(false);

      await loadData(pin);
    } catch (error: any) {
      setError(error.message || "No se pudo crear el producto.");
    } finally {
      setIsLoading(false);
    }
  }

  async function uploadNewProductImage(file?: File) {
    if (!file) return;

    if (!newProduct.store_id) {
      setNewProductMessage("Selecciona un comercio antes de subir la imagen.");
      if (newProductFileInputRef.current) newProductFileInputRef.current.value = "";
      return;
    }

    setIsUploadingNewImage(true);
    setNewProductMessage("Subiendo imagen...");

    try {
      const data = await uploadProductImage(
        file,
        newProduct.store_id,
        "new-product",
        pin
      );
      setNewProduct((current) => ({ ...current, image_url: data.publicUrl }));
      setNewProductMessage(
        "Imagen subida. Completa el producto y presiona Crear producto."
      );
    } catch (error: any) {
      setNewProductMessage(error.message || "No se pudo subir la imagen.");
    } finally {
      setIsUploadingNewImage(false);
      if (newProductFileInputRef.current) newProductFileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    let active = true;

    async function bootPanel() {
      const savedPin = getSavedPanelPin();
      const savedToken = await getPanelAccessToken();

      if (!active) return;

      if (savedPin || savedToken) {
        setPin(savedPin);
        loadData(savedPin);
      } else {
        setIsCheckingAccess(false);
        setIsLoading(false);
      }
    }

    bootPanel();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const savedView = localStorage.getItem("vendeplus_panel_products_view");
    if (savedView === "comfortable" || savedView === "compact") {
      setProductView(savedView);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("vendeplus_panel_products_view", productView);
  }, [productView]);

  if (isCheckingAccess) {
    return <PanelAccessGate />;
  }

  if (!isUnlocked && isLoading) {
    return <PanelModuleSkeleton label="Cargando productos..." />;
  }

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso del panel</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesión con tu usuario autorizado para continuar.
        </p>

        <a
          href="/panel/login"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
        >
          <CheckCircle2 size={18} />
          Iniciar sesión
        </a>

        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white p-4 shadow-lg shadow-[#2E3A79]/[0.05] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <h2 className="text-xl font-black">Productos</h2>
            <p className="text-sm font-bold text-[#746f69]">
              Gestiona tu inventario sin abrir formularios hasta que los necesites.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen((current) => !current)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
          >
            {isCreateOpen ? <X size={17} /> : <Plus size={17} />}
            {isCreateOpen ? "Cancelar" : "Crear producto"}
          </button>
        </div>

        {isCreateOpen ? (
          <>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
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

          <input
            type="number"
            value={newProduct.sort_order}
            onChange={(event) =>
              setNewProduct((current) => ({
                ...current,
                sort_order: event.target.value,
              }))
            }
            placeholder="Orden en catálogo"
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </div>

        <div className="mt-3">
          <input
            value={newProduct.description}
            onChange={(event) =>
              setNewProduct((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Descripción"
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
        </div>

        <div className="mt-3 rounded-2xl bg-[#F8F3E8] p-3 ring-1 ring-[#25262B]/[0.06]">
          <div className="grid gap-4 md:grid-cols-[144px_1fr] md:items-center">
            <div className="aspect-square w-36 overflow-hidden rounded-2xl bg-white">
              {newProduct.image_url ? (
                <img
                  src={newProduct.image_url}
                  alt={newProduct.name || "Imagen del producto"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center text-[#746f69]">
                  <ImageIcon size={34} />
                </div>
              )}
            </div>

            <div>
              <h3 className="text-base font-black">Imagen del producto</h3>
              <p className="mt-1 text-xs font-bold text-[#746f69]">
                Sube una foto cuadrada desde tu equipo para que se vea bien en todas las vistas.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <input
                  ref={newProductFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) =>
                    uploadNewProductImage(event.target.files?.[0])
                  }
                />
                <button
                  type="button"
                  onClick={() => newProductFileInputRef.current?.click()}
                  disabled={isUploadingNewImage}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
                >
                  {isUploadingNewImage ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  Subir imagen
                </button>

                {newProduct.image_url && (
                  <button
                    type="button"
                    onClick={() =>
                      setNewProduct((current) => ({
                        ...current,
                        image_url: "",
                      }))
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#2E3A79]"
                  >
                    Quitar imagen
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {newProductMessage && (
          <p className="mt-3 text-sm font-black text-[#2E3A79]">
            {newProductMessage}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setIsCreateOpen(false)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F8F3E8] px-5 py-3 text-sm font-black text-[#2E3A79]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={createProduct}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Save size={17} />
            )}
            Guardar producto
          </button>
        </div>

        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
          </>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-black">Productos editables</h2>
            <p className="text-sm font-bold text-[#746f69]">
              {filteredProducts.length} de {products.length} productos en tus catálogos.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => loadData(pin)}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
              Actualizar lista
            </button>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#25262B]/[0.06] lg:grid-cols-[1fr_auto]">
          <label className="flex items-center gap-3 rounded-2xl bg-[#F8F3E8] px-4 py-3">
            <Search size={18} className="text-[#746f69]" />
            <input
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              placeholder="Buscar producto..."
              className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-[#746f69]/70"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F8F3E8] p-1">
            <button
              type="button"
              onClick={() => setProductView("comfortable")}
              className={[
                "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black",
                productView === "comfortable"
                  ? "bg-white text-[#2E3A79] shadow-sm"
                  : "text-[#746f69]",
              ].join(" ")}
            >
              <Grid2X2 size={15} />
              Vista completa
            </button>
            <button
              type="button"
              onClick={() => setProductView("compact")}
              className={[
                "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black",
                productView === "compact"
                  ? "bg-white text-[#2E3A79] shadow-sm"
                  : "text-[#746f69]",
              ].join(" ")}
            >
              <LayoutList size={15} />
              Vista compacta
            </button>
          </div>
        </div>

        {filteredProducts.length ? (
          productView === "compact" ? (
            <div className="space-y-2">
              {filteredProducts.map((product) => (
                <article
                  key={product.id}
                  className="relative rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-[#25262B]/[0.06]"
                >
                  <div className="grid gap-3 sm:grid-cols-[56px_1fr_150px_auto] sm:items-center">
                    <div className="h-14 w-14 overflow-hidden rounded-xl bg-[#F8F3E8]">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-[#746f69]">
                          <ImageIcon size={22} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black text-[#25262B]">
                        {product.name}
                      </h3>
                      <p className="mt-1 truncate text-xs font-bold text-[#746f69]">
                        ${Number(product.price_usd || 0).toFixed(2)} ·{" "}
                        {product.categories?.name || "Sin categoría"}
                      </p>
                    </div>
                    <div className="min-w-0 text-left sm:text-right">
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-1 text-[11px] font-black",
                          product.is_available
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700",
                        ].join(" ")}
                      >
                        {product.is_available ? "Disponible" : "No disponible"}
                      </span>
                      {getProductOptionGroups(product).length ? (
                        <p className="mt-1 truncate text-[11px] font-black text-[#2E3A79]">
                          Opciones:{" "}
                          {getProductOptionGroups(product)
                            .map((group) => group.name)
                            .join(", ")}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] font-bold text-[#746f69]">
                          Sin opciones aplicadas
                        </p>
                      )}
                    </div>
                    <details className="sm:min-w-[260px]">
                      <summary className="inline-flex cursor-pointer list-none items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-4 py-2 text-xs font-black text-white">
                        Editar
                      </summary>
                      <div className="mt-3">
                        <ProductEditor
                          product={product}
                          stores={stores}
                          categories={categories}
                          pin={pin}
                          onSaved={() => loadData(pin)}
                        />
                      </div>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 2xl:grid-cols-2">
              {filteredProducts.map((product) => (
                <ProductEditor
                  key={product.id}
                  product={product}
                  stores={stores}
                  categories={categories}
                  pin={pin}
                  onSaved={() => loadData(pin)}
                />
              ))}
            </div>
          )
        ) : (
          <div className="rounded-[28px] bg-white p-6 text-center text-sm font-bold text-[#746f69] ring-1 ring-[#25262B]/[0.06]">
            No encontramos productos con esa búsqueda.
          </div>
        )}

        {page.hasMore ? (
          <button
            type="button"
            onClick={() => loadData(pin, products.length)}
            disabled={isLoading}
            className="mx-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            Cargar más productos
          </button>
        ) : null}
      </section>
    </div>
  );
}

