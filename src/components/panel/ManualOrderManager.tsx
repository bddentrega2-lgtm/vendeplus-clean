"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  Minus,
  Plus,
  Save,
  Search,
  Sparkles,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { formatUsd } from "@/lib/currency";
import type { ProductOptionGroup, SelectedCartOption } from "@/types";
import { PanelAccessGate, PanelModuleSkeleton } from "@/components/panel/PanelLoadingState";
import {
  getPanelAccessToken,
  getPanelAuthHeaders,
  getSavedPanelPin,
  hasSavedPanelAuth,
  savePanelPin,
  shouldShowPanelInitialAccessGate,
} from "@/lib/panel/client-auth";

type StoreRow = {
  id: string;
  slug: string;
  name: string;
  payment_methods: string[] | null;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
};

type CategoryRow = {
  id: string;
  store_id: string;
  name: string;
};

type ProductRow = {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  price_usd: number | string;
  is_available: boolean;
  categories?: { name?: string } | null;
};

type SelectedItem = {
  productId: string;
  quantity: number;
  notes: string;
  selectedOptions: SelectedCartOption[];
};

type FulfillmentType = "delivery" | "pickup" | "table" | "bar";

type InterpretDetails = {
  mode: "ai" | "local" | "";
  model?: string | null;
  confidence?: number | null;
  warnings: string[];
  error?: string | null;
};

const fallbackPaymentMethods = [
  "Pago móvil",
  "Transferencia",
  "Efectivo",
  "Binance",
  "Otro",
];

const ENABLE_ORDER_INTERPRETER = false;

function getPaymentMethods(store?: StoreRow) {
  return store?.payment_methods?.length ? store.payment_methods : fallbackPaymentMethods;
}

async function panelRequest(pin: string, url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getPanelAuthHeaders(pin)),
      ...(options?.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error en la solicitud.");
  }

  return data;
}

export function ManualOrderManager() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => shouldShowPanelInitialAccessGate());
  const [isLoading, setIsLoading] = useState(() => hasSavedPanelAuth());
  const [isSaving, setIsSaving] = useState(false);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [originalMessage, setOriginalMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");
  const [orderDetails, setOrderDetails] = useState("");
  const [deliveryType, setDeliveryType] = useState<FulfillmentType>("delivery");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [deliveryUsd, setDeliveryUsd] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [optionGroupsByProduct, setOptionGroupsByProduct] = useState<Record<string, ProductOptionGroup[]>>({});
  const [loadingOptionsFor, setLoadingOptionsFor] = useState("");
  const [interpretDetails, setInterpretDetails] = useState<InterpretDetails>({
    mode: "",
    warnings: [],
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedStore = stores.find((store) => store.id === selectedStoreId);

  const storeProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.store_id === selectedStoreId && product.is_available !== false
      ),
    [products, selectedStoreId]
  );

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return storeProducts;

    return storeProducts.filter((product) => {
      const category = categories.find((item) => item.id === product.category_id);
      return `${product.name} ${category?.name || ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [categories, query, storeProducts]);

  const selectedRows = useMemo(
    () =>
      items
        .map((item) => {
          const product = products.find((row) => row.id === item.productId);
          if (!product) return null;

          const optionExtraUsd = (item.selectedOptions || []).reduce(
            (sum, option) => sum + Number(option.priceDeltaUsd || 0),
            0
          );
          const unitPriceUsd = Number(product.price_usd || 0) + optionExtraUsd;
          return {
            ...item,
            product,
            unitPriceUsd,
            totalUsd: unitPriceUsd * item.quantity,
          };
        })
        .filter(Boolean) as Array<
        SelectedItem & {
          product: ProductRow;
          unitPriceUsd: number;
          totalUsd: number;
        }
      >,
    [items, products]
  );

  const subtotalUsd = selectedRows.reduce((sum, item) => sum + item.totalUsd, 0);
  const safeDeliveryUsd = deliveryType === "delivery" ? Math.max(0, Number(deliveryUsd || 0)) : 0;
  const totalUsd = subtotalUsd + safeDeliveryUsd;
  const totalQuantity = selectedRows.reduce((sum, item) => sum + item.quantity, 0);

  async function loadData(currentPin: string) {
    setIsLoading(true);
    setError("");

    try {
      const data = await panelRequest(currentPin, "/api/panel/catalogo");
      const nextStores = data.stores || [];
      setStores(nextStores);
      setCategories(data.categories || []);
      setProducts(data.products || []);
      setSelectedStoreId((current) => current || nextStores[0]?.id || "");
      setPaymentMethod((current) => current || getPaymentMethods(nextStores[0])[0] || "");
      setIsUnlocked(true);
      savePanelPin(currentPin);
    } catch (error: any) {
      setError(error.message || "No se pudo cargar la información.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
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
  }, []);

  useEffect(() => {
    const methods = getPaymentMethods(selectedStore);
    setPaymentMethod((current) =>
      current && methods.includes(current) ? current : methods[0] || ""
    );
    setItems((current) =>
      current.filter((item) =>
        products.some(
          (product) => product.id === item.productId && product.store_id === selectedStoreId
        )
      )
    );
  }, [products, selectedStore, selectedStoreId]);

  async function addProduct(product: ProductRow) {
    setItems((current) => {
      const existing = current.find((item) => item.productId === product.id);

      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...current, { productId: product.id, quantity: 1, notes: "", selectedOptions: [] }];
    });

    if (!selectedStore?.slug || optionGroupsByProduct[product.id]) return;

    setLoadingOptionsFor(product.id);
    try {
      const params = new URLSearchParams({
        storeSlug: selectedStore.slug,
        productId: product.id,
      });
      const response = await fetch(`/api/catalog/product-options?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      setOptionGroupsByProduct((current) => ({
        ...current,
        [product.id]: response.ok && Array.isArray(data.optionGroups) ? data.optionGroups : [],
      }));
    } catch {
      setOptionGroupsByProduct((current) => ({ ...current, [product.id]: [] }));
    } finally {
      setLoadingOptionsFor("");
    }
  }

  function toggleOption(productId: string, group: ProductOptionGroup, valueId: string) {
    const value = group.values.find((option) => option.id === valueId);
    if (!value) return;

    setItems((current) => current.map((item) => {
      if (item.productId !== productId) return item;
      const withoutGroup = item.selectedOptions.filter((option) => option.groupId !== group.id);
      const currentGroup = item.selectedOptions.filter((option) => option.groupId === group.id);
      const alreadySelected = currentGroup.some((option) => option.valueId === value.id);

      if (alreadySelected) {
        return {
          ...item,
          selectedOptions: item.selectedOptions.filter((option) => option.valueId !== value.id),
        };
      }

      const nextOption: SelectedCartOption = {
        groupId: group.id,
        groupName: group.name,
        valueId: value.id,
        valueName: value.name,
        priceDeltaUsd: Number(value.priceDeltaUsd || 0),
      };
      const maxSelect = group.selectionType === "single" ? 1 : Number(group.maxSelect || 0);
      const nextGroup = maxSelect > 0 && currentGroup.length >= maxSelect
        ? [...currentGroup.slice(1), nextOption]
        : [...currentGroup, nextOption];

      return { ...item, selectedOptions: [...withoutGroup, ...nextGroup] };
    }));
  }

  function updateQuantity(productId: string, delta: number) {
    setItems((current) =>
      current
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeProduct(productId: string) {
    setItems((current) => current.filter((item) => item.productId !== productId));
  }

  function updateItemNotes(productId: string, notes: string) {
    setItems((current) => current.map((item) =>
      item.productId === productId ? { ...item, notes } : item
    ));
  }

  async function interpretMessage() {
    setError("");
    setSuccess("");
    setInterpretDetails({ mode: "", warnings: [] });

    if (!selectedStoreId) {
      setError("Selecciona un comercio.");
      return;
    }

    if (!originalMessage.trim()) {
      setError("Pega primero el mensaje recibido.");
      return;
    }

    setIsInterpreting(true);

    try {
      const data = await panelRequest(pin, "/api/panel/orders/interpret", {
        method: "POST",
        body: JSON.stringify({
          storeId: selectedStoreId,
          message: originalMessage,
        }),
      });
      const interpretation = data.interpretation || {};
      const nextItems = Array.isArray(interpretation.items)
        ? interpretation.items
            .filter((item: any) =>
              products.some(
                (product) =>
                  product.id === item.productId && product.store_id === selectedStoreId
              )
            )
            .map((item: any) => ({
              productId: String(item.productId),
              quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
              notes: String(item.notes || ""),
              selectedOptions: [],
            }))
        : [];

      if (interpretation.customerName) setCustomerName(interpretation.customerName);
      if (interpretation.customerPhone) setCustomerPhone(interpretation.customerPhone);
      if (interpretation.deliveryReference) {
        setDeliveryReference(interpretation.deliveryReference);
      }
      if (interpretation.orderDetails) setOrderDetails(interpretation.orderDetails);
      if (interpretation.deliveryType === "pickup" || interpretation.deliveryType === "delivery") {
        setDeliveryType(interpretation.deliveryType);
      }
      if (interpretation.paymentMethod) setPaymentMethod(interpretation.paymentMethod);
      if (Number(interpretation.deliveryUsd) > 0) {
        setDeliveryUsd(String(interpretation.deliveryUsd));
      }
      if (nextItems.length) setItems(nextItems);

      const warnings = Array.isArray(interpretation.warnings)
        ? interpretation.warnings.filter(Boolean)
        : [];
      setInterpretDetails({
        mode: data.mode === "ai" ? "ai" : "local",
        model: data.ai?.model || null,
        confidence:
          typeof data.ai?.confidence === "number"
            ? data.ai.confidence
            : typeof interpretation.confidence === "number"
              ? interpretation.confidence
              : null,
        warnings,
        error: data.ai?.error || null,
      });
      setSuccess(
        data.mode === "ai"
          ? "Pedido interpretado con IA. Revisa antes de guardar."
          : `Pedido interpretado en modo basico. ${
              data.ai?.error
                ? `OpenAI: ${data.ai.error}`
                : warnings[0] || "Revisa antes de guardar."
            }`
      );
    } catch (error: any) {
      setError(error.message || "No se pudo interpretar el mensaje.");
    } finally {
      setIsInterpreting(false);
    }
  }

  async function saveManualOrder() {
    setError("");
    setSuccess("");

    if (!selectedStoreId) {
      setError("Selecciona un comercio.");
      return;
    }

    const isOnPremise = deliveryType === "table" || deliveryType === "bar";

    if (!isOnPremise && !customerName.trim()) {
      setError("Escribe el nombre del cliente.");
      return;
    }

    if (!isOnPremise && !customerPhone.trim()) {
      setError("Escribe el teléfono del cliente.");
      return;
    }

    if (deliveryType === "table" && !deliveryReference.trim()) {
      setError("Indica el número o nombre de la mesa.");
      return;
    }

    if (!paymentMethod) {
      setError("Selecciona un método de pago.");
      return;
    }

    if (!items.length) {
      setError("Agrega al menos un producto.");
      return;
    }

    for (const item of items) {
      for (const group of optionGroupsByProduct[item.productId] || []) {
        const selectedCount = item.selectedOptions.filter((option) => option.groupId === group.id).length;
        const minSelect = group.required ? Math.max(1, Number(group.minSelect || 1)) : 0;
        if (selectedCount < minSelect) {
          setError(minSelect === 1
            ? `Selecciona una opción para ${group.name}.`
            : `Selecciona ${minSelect} opciones para ${group.name}.`);
          return;
        }
      }
    }

    setIsSaving(true);

    try {
      const data = await panelRequest(pin, "/api/panel/orders", {
        method: "POST",
        body: JSON.stringify({
          storeId: selectedStoreId,
          customerName: customerName.trim() || (deliveryType === "table" ? "Cliente de mesa" : "Cliente de barra"),
          customerPhone,
          deliveryType,
          paymentMethod,
          deliveryReference,
          orderDetails,
          originalMessage,
          deliveryUsd: safeDeliveryUsd,
          items,
        }),
      });

      setSuccess(`Pedido ${data.order?.public_code || ""} creado correctamente.`);
      window.setTimeout(() => router.push("/panel/pedidos"), 700);
    } catch (error: any) {
      setError(error.message || "No se pudo guardar el pedido.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isCheckingAccess) {
    return <PanelAccessGate />;
  }

  if (!isUnlocked && isLoading) {
    return <PanelModuleSkeleton label="Cargando pedido manual..." />;
  }

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso a pedidos</h2>
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
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-black">Pedido manual</h2>
              <p className="mt-1 text-sm font-bold text-[#746f69]">
                Registra ventas recibidas por WhatsApp, Instagram, llamada o atención directa.
              </p>
            </div>
            <Link
              href="/panel/pedidos"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F8F3E8] px-5 py-3 text-sm font-black text-[#2E3A79]"
            >
              <ArrowLeft size={16} />
              Volver a pedidos
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Comercio
              </span>
              <select
                value={selectedStoreId}
                onChange={(event) => setSelectedStoreId(event.target.value)}
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Método de pago
              </span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              >
                {getPaymentMethods(selectedStore).map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {ENABLE_ORDER_INTERPRETER ? (
          <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-black">Mensaje recibido</h2>
                <p className="mt-1 text-sm font-bold text-[#746f69]">
                  Pega el chat y Somos intentara llenar el pedido.
                </p>
              </div>
              <button
                type="button"
                onClick={interpretMessage}
                disabled={isInterpreting || !originalMessage.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {isInterpreting ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Sparkles size={17} />
                )}
                Interpretar
              </button>
            </div>
            <textarea
              value={originalMessage}
              onChange={(event) => setOriginalMessage(event.target.value)}
              placeholder="Ejemplo: Hola, quiero 2 pizzas margarita y 1 refresco con entrega en Base Aragua."
              rows={4}
              className="mt-4 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />
          </section>
        ) : null}

        <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <h2 className="text-xl font-black">Cliente y modalidad</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder={deliveryType === "table" || deliveryType === "bar" ? "Nombre (opcional)" : "Nombre del cliente"}
              className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />
            <input
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder={deliveryType === "table" || deliveryType === "bar" ? "Teléfono (opcional)" : "Teléfono"}
              className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />
          </div>

          <div className="mt-4">
            <input
              value={orderDetails}
              onChange={(event) => setOrderDetails(event.target.value)}
              placeholder="Nota del pedido"
              className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setDeliveryType("delivery")}
              className={[
                "rounded-2xl px-4 py-3 text-left text-sm font-black",
                deliveryType === "delivery"
                  ? "bg-[#2E3A79] text-white"
                  : "bg-[#F8F3E8] text-[#746f69]",
              ].join(" ")}
            >
              Delivery
            </button>
            <button
              type="button"
              onClick={() => setDeliveryType("pickup")}
              className={[
                "rounded-2xl px-4 py-3 text-left text-sm font-black",
                deliveryType === "pickup"
                  ? "bg-[#2E3A79] text-white"
                  : "bg-[#F8F3E8] text-[#746f69]",
              ].join(" ")}
            >
              Retiro
            </button>
            <button
              type="button"
              onClick={() => setDeliveryType("table")}
              className={[
                "rounded-2xl px-4 py-3 text-left text-sm font-black",
                deliveryType === "table"
                  ? "bg-[#2E3A79] text-white"
                  : "bg-[#F8F3E8] text-[#746f69]",
              ].join(" ")}
            >
              Mesa
            </button>
            <button
              type="button"
              onClick={() => setDeliveryType("bar")}
              className={[
                "rounded-2xl px-4 py-3 text-left text-sm font-black",
                deliveryType === "bar"
                  ? "bg-[#2E3A79] text-white"
                  : "bg-[#F8F3E8] text-[#746f69]",
              ].join(" ")}
            >
              Barra
            </button>
          </div>

          <label className="mt-4 block space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
              {deliveryType === "table" ? "Número o nombre de la mesa" : deliveryType === "bar" ? "Referencia en barra" : deliveryType === "pickup" ? "Referencia del retiro" : "Dirección o referencia"}
            </span>
            <input
              value={deliveryReference}
              onChange={(event) => setDeliveryReference(event.target.value)}
              placeholder={deliveryType === "table" ? "Ej: Mesa 4" : deliveryType === "bar" ? "Ej: Puesto 2 (opcional)" : deliveryType === "pickup" ? "Ej: Retira Carlos (opcional)" : "Dirección y punto de referencia"}
              className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />
          </label>

          {deliveryType === "delivery" && (
            <input
              value={deliveryUsd}
              onChange={(event) => setDeliveryUsd(event.target.value)}
              type="number"
              step="0.01"
              placeholder="Costo de entrega"
              className="mt-4 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
            />
          )}
        </section>

        <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-black">Productos</h2>
              <p className="text-sm font-bold text-[#746f69]">
                Busca productos activos del comercio seleccionado.
              </p>
            </div>
            <div className="relative md:w-80">
              <Search
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#746f69]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar producto..."
                className="w-full rounded-2xl border border-[#25262B]/10 py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {isLoading && (
              <div className="rounded-2xl bg-[#F8F3E8] p-4 text-sm font-black text-[#746f69]">
                Cargando productos...
              </div>
            )}

            {!isLoading && filteredProducts.length === 0 && (
              <div className="rounded-2xl bg-[#F8F3E8] p-4 text-sm font-bold text-[#746f69]">
                No hay productos disponibles para este comercio.
              </div>
            )}

            {filteredProducts.map((product) => {
              const category = categories.find((item) => item.id === product.category_id);

              return (
                <article
                  key={product.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-[#25262B]/10 p-4 md:flex-row md:items-center"
                >
                  <div>
                    <p className="font-black">{product.name}</p>
                    <p className="text-xs font-bold text-[#746f69]">
                      {category?.name || "Sin categoría"} · {formatUsd(Number(product.price_usd || 0))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addProduct(product)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
                  >
                    <Plus size={16} />
                    Agregar
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
        <section className="rounded-[34px] bg-[#25262B] p-5 text-white shadow-xl shadow-[#25262B]/20">
          <div className="flex items-center gap-3">
            <ShoppingCart size={22} className="text-[#FFB547]" />
            <div>
              <h2 className="text-2xl font-black">Resumen</h2>
              <p className="text-sm font-bold text-white/65">
                {totalQuantity} productos · {deliveryType === "delivery" ? "Delivery" : deliveryType === "pickup" ? "Retiro" : deliveryType === "table" ? "Mesa" : "Barra"}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {selectedRows.length === 0 ? (
              <div className="rounded-2xl bg-white/10 p-4 text-sm font-bold text-white/70">
                Agrega productos para guardar el pedido.
              </div>
            ) : (
              selectedRows.map((item) => (
                <div key={item.productId} className="rounded-2xl bg-white p-4 text-[#25262B]">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-black">{item.product.name}</p>
                      <p className="text-xs font-bold text-[#746f69]">
                        {formatUsd(item.unitPriceUsd)} unitario
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProduct(item.productId)}
                      className="grid h-9 w-9 place-items-center rounded-full bg-red-50 text-red-600"
                      aria-label="Quitar producto"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="grid h-9 w-9 place-items-center rounded-full bg-[#F8F3E8]"
                      >
                        <Minus size={15} />
                      </button>
                      <span className="w-8 text-center font-black">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="grid h-9 w-9 place-items-center rounded-full bg-[#F8F3E8]"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                    <p className="font-black">{formatUsd(item.totalUsd)}</p>
                  </div>
                  {loadingOptionsFor === item.productId ? (
                    <p className="mt-3 text-xs font-bold text-[#746f69]">Cargando opciones...</p>
                  ) : null}
                  {(optionGroupsByProduct[item.productId] || []).map((group) => (
                    <div key={group.id} className="mt-3 rounded-2xl bg-[#F8F3E8] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black">{group.name}</p>
                        <span className="text-[10px] font-black uppercase text-[#746f69]">
                          {group.required ? "Obligatorio" : "Opcional"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.values.filter((value) => value.isActive !== false).map((value) => {
                          const selected = item.selectedOptions.some((option) => option.valueId === value.id);
                          return (
                            <button
                              key={value.id}
                              type="button"
                              onClick={() => toggleOption(item.productId, group, value.id)}
                              className={[
                                "rounded-full px-3 py-2 text-xs font-black ring-1",
                                selected
                                  ? "bg-[#2E3A79] text-white ring-[#2E3A79]"
                                  : "bg-white text-[#25262B] ring-[#25262B]/10",
                              ].join(" ")}
                            >
                              {value.name}{Number(value.priceDeltaUsd || 0) > 0 ? ` +${formatUsd(Number(value.priceDeltaUsd))}` : ""}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <input
                    value={item.notes}
                    onChange={(event) => updateItemNotes(item.productId, event.target.value)}
                    placeholder="Nota para cocina (opcional)"
                    className="mt-3 w-full rounded-2xl border border-[#25262B]/10 px-3 py-2 text-xs font-bold outline-none focus:border-[#2E3A79]"
                  />
                </div>
              ))
            )}
          </div>

          <div className="mt-5 space-y-2 rounded-3xl bg-white/10 p-4 text-sm font-bold">
            <div className="flex justify-between">
              <span className="text-white/70">Subtotal</span>
              <span>{formatUsd(subtotalUsd)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Entrega</span>
              <span>{formatUsd(safeDeliveryUsd)}</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-3 text-lg font-black">
              <span>Total</span>
              <span className="text-[#FFB547]">{formatUsd(totalUsd)}</span>
            </div>
          </div>

          {customerName && (
            <p className="mt-4 rounded-2xl bg-white/10 p-3 text-sm font-bold text-white/75">
              Cliente: <span className="text-white">{customerName}</span>
            </p>
          )}

          {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-black text-red-700">{error}</p>}
          {success && <p className="mt-4 rounded-2xl bg-green-50 p-3 text-sm font-black text-green-700">{success}</p>}

          {ENABLE_ORDER_INTERPRETER && interpretDetails.mode ? (
            <div className="mt-4 rounded-2xl bg-white/10 p-3 text-xs font-bold text-white/75">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Modo:{" "}
                  <strong className="text-white">
                    {interpretDetails.mode === "ai" ? "IA" : "Local"}
                  </strong>
                </span>
                {interpretDetails.confidence !== null &&
                interpretDetails.confidence !== undefined ? (
                  <span>
                    Confianza:{" "}
                    <strong className="text-[#FFB547]">
                      {Math.round(interpretDetails.confidence * 100)}%
                    </strong>
                  </span>
                ) : null}
              </div>
              {interpretDetails.model ? (
                <p className="mt-2 text-white/60">Modelo: {interpretDetails.model}</p>
              ) : null}
              {interpretDetails.error ? (
                <p className="mt-2 text-[#FFB547]">{interpretDetails.error}</p>
              ) : null}
              {interpretDetails.warnings.length ? (
                <ul className="mt-2 space-y-1">
                  {interpretDetails.warnings.slice(0, 4).map((warning) => (
                    <li key={warning}>- {warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={saveManualOrder}
            disabled={isSaving || selectedRows.length === 0}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isSaving ? "Guardando pedido..." : "Guardar pedido"}
          </button>
        </section>
      </aside>
    </div>
  );
}
