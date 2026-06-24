"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  Lock,
  PackageCheck,
  Plus,
  Save,
  Search,
  Settings2,
  Trash2,
  Wand2,
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

type StoreRow = {
  id: string;
  slug: string;
  name: string;
};

type ProductRow = {
  id: string;
  store_id: string;
  name: string;
  price_usd: number | string;
  image_url: string | null;
  is_available: boolean;
  categories?: { name?: string } | null;
};

type OptionValueRow = {
  id: string;
  name: string;
  description: string | null;
  price_delta_usd: number | string;
  sort_order: number;
  is_active: boolean;
};

type OptionGroupRow = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  selection_type: "single" | "multiple";
  required: boolean;
  min_select: number;
  max_select: number;
  sort_order: number;
  is_active: boolean;
  product_option_values?: OptionValueRow[];
  product_option_group_products?: Array<{ product_id: string; sort_order: number }>;
};

type Template = {
  key: string;
  label: string;
  name: string;
  description: string;
  selection_type: "single" | "multiple";
  required: boolean;
  min_select: number;
  max_select: number;
  options: string[];
};

const quickTemplates: Template[] = [
  {
    key: "sizes",
    label: "Tallas",
    name: "Talla",
    description: "El cliente elige una talla.",
    selection_type: "single",
    required: true,
    min_select: 1,
    max_select: 1,
    options: ["S", "M", "L", "XL"],
  },
  {
    key: "colors",
    label: "Colores",
    name: "Color",
    description: "El cliente elige un color.",
    selection_type: "single",
    required: true,
    min_select: 1,
    max_select: 1,
    options: ["Negro", "Blanco", "Azul", "Rojo"],
  },
  {
    key: "sauces",
    label: "Salsas",
    name: "Salsas",
    description: "Salsas opcionales para acompañar.",
    selection_type: "multiple",
    required: false,
    min_select: 0,
    max_select: 3,
    options: ["Ajo", "Tartara", "Picante"],
  },
  {
    key: "extras",
    label: "Extras",
    name: "Extras",
    description: "Adicionales que pueden sumar precio.",
    selection_type: "multiple",
    required: false,
    min_select: 0,
    max_select: 3,
    options: ["Queso", "Tocineta", "Aguacate"],
  },
  {
    key: "drinks",
    label: "Bebidas",
    name: "Bebida",
    description: "Bebida para acompanar el pedido.",
    selection_type: "single",
    required: false,
    min_select: 0,
    max_select: 1,
    options: ["Agua", "Refresco", "Malta"],
  },
  {
    key: "flavors",
    label: "Sabores",
    name: "Sabor",
    description: "El cliente elige un sabor.",
    selection_type: "single",
    required: true,
    min_select: 1,
    max_select: 1,
    options: ["Chocolate", "Vainilla", "Fresa"],
  },
  {
    key: "fillings",
    label: "Rellenos",
    name: "Relleno",
    description: "El cliente elige un relleno.",
    selection_type: "single",
    required: true,
    min_select: 1,
    max_select: 1,
    options: ["Carne", "Pollo", "Queso"],
  },
  {
    key: "toppings",
    label: "Toppings",
    name: "Toppings",
    description: "Toppings opcionales.",
    selection_type: "multiple",
    required: false,
    min_select: 0,
    max_select: 4,
    options: ["Chocolate", "Mani", "Lluvia de colores"],
  },
];

async function apiRequest(pin: string, options?: RequestInit) {
  const response = await fetch("/api/panel/options", {
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

function formatUsd(value: number | string) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getSelectionLabel(group: Pick<OptionGroupRow, "selection_type">) {
  return group.selection_type === "single" ? "Una sola opcion" : "Varias opciones";
}

function getRangeText(group: Pick<OptionGroupRow, "selection_type" | "required" | "min_select" | "max_select">) {
  if (group.selection_type === "single") {
    return group.required ? "El cliente debe elegir 1 opcion." : "El cliente puede elegir 1 opcion.";
  }

  if (Number(group.max_select || 0) > 0) {
    return `El cliente puede elegir hasta ${group.max_select}.`;
  }

  return "El cliente puede elegir varias opciones.";
}

function GroupEditor({
  group,
  products,
  pin,
  onSaved,
}: {
  group: OptionGroupRow;
  products: ProductRow[];
  pin: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    name: group.name,
    description: group.description || "",
    selection_type: group.selection_type,
    required: group.required,
    min_select: String(group.min_select || 0),
    max_select: String(group.max_select || 0),
    sort_order: String(group.sort_order || 0),
    is_active: group.is_active,
  });
  const [valueDraft, setValueDraft] = useState({ name: "", price_delta_usd: "" });
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState({
    name: "",
    price_delta_usd: "",
    sort_order: "",
    is_active: true,
  });
  const [selectedProducts, setSelectedProducts] = useState(
    () =>
      new Set(
        (group.product_option_group_products || []).map((assignment) => assignment.product_id)
      )
  );
  const [productQuery, setProductQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const values = useMemo(
    () =>
      [...(group.product_option_values || [])].sort(
        (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
      ),
    [group.product_option_values]
  );
  const activeValuesCount = values.filter((value) => value.is_active).length;
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(products.map((product) => product.categories?.name || "Sin categoria"))
      ).sort(),
    [products]
  );
  const filteredProducts = useMemo(() => {
    const needle = productQuery.trim().toLowerCase();

    return products.filter((product) => {
      const category = product.categories?.name || "Sin categoria";
      const matchesCategory = categoryFilter === "all" || category === categoryFilter;
      const matchesSearch =
        !needle ||
        [product.name, category].join(" ").toLowerCase().includes(needle);

      return matchesCategory && matchesSearch;
    });
  }, [products, productQuery, categoryFilter]);

  useEffect(() => {
    setSelectedProducts(
      new Set(
        (group.product_option_group_products || []).map(
          (assignment) => assignment.product_id
        )
      )
    );
  }, [group.product_option_group_products]);

  function updateSelectedProduct(productId: string) {
    setSelectedProducts((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function startEditValue(value: OptionValueRow) {
    setEditingValueId(value.id);
    setEditingValue({
      name: value.name,
      price_delta_usd: String(value.price_delta_usd || 0),
      sort_order: String(value.sort_order || 0),
      is_active: value.is_active,
    });
  }

  async function saveGroup() {
    setIsSaving(true);
    setMessage("");

    try {
      await apiRequest(pin, {
        method: "PATCH",
        body: JSON.stringify({
          action: "update_group",
          id: group.id,
          ...draft,
          min_select: Number(draft.min_select || 0),
          max_select: Number(draft.max_select || 0),
          sort_order: Number(draft.sort_order || 0),
        }),
      });

      setMessage("Grupo de opciones actualizado.");
      onSaved();
    } catch (error: any) {
      setMessage(error.message || "No se pudo guardar el grupo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addValue() {
    if (!valueDraft.name.trim()) return;
    setIsSaving(true);
    setMessage("");

    try {
      await apiRequest(pin, {
        method: "POST",
        body: JSON.stringify({
          action: "create_value",
          group_id: group.id,
          name: valueDraft.name,
          price_delta_usd: Number(valueDraft.price_delta_usd || 0),
          sort_order: values.length + 1,
        }),
      });

      setValueDraft({ name: "", price_delta_usd: "" });
      setMessage("Opcion agregada.");
      onSaved();
    } catch (error: any) {
      setMessage(error.message || "No se pudo agregar la opcion.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveValue(value: OptionValueRow, nextActive = editingValue.is_active) {
    setIsSaving(true);
    setMessage("");

    try {
      await apiRequest(pin, {
        method: "PATCH",
        body: JSON.stringify({
          action: "update_value",
          id: value.id,
          name: editingValueId === value.id ? editingValue.name : value.name,
          description: value.description || "",
          price_delta_usd:
            editingValueId === value.id
              ? Number(editingValue.price_delta_usd || 0)
              : Number(value.price_delta_usd || 0),
          sort_order:
            editingValueId === value.id
              ? Number(editingValue.sort_order || 0)
              : Number(value.sort_order || 0),
          is_active: nextActive,
        }),
      });

      setEditingValueId(null);
      setMessage("Opcion actualizada.");
      onSaved();
    } catch (error: any) {
      setMessage(error.message || "No se pudo actualizar la opcion.");
    } finally {
      setIsSaving(false);
    }
  }

  async function moveValue(value: OptionValueRow, direction: -1 | 1) {
    await saveValueWithPatch(value, {
      sort_order: Number(value.sort_order || 0) + direction,
    });
  }

  async function saveValueWithPatch(
    value: OptionValueRow,
    patch: Partial<{
      name: string;
      price_delta_usd: number;
      sort_order: number;
      is_active: boolean;
    }>
  ) {
    setIsSaving(true);
    setMessage("");

    try {
      await apiRequest(pin, {
        method: "PATCH",
        body: JSON.stringify({
          action: "update_value",
          id: value.id,
          name: patch.name ?? value.name,
          description: value.description || "",
          price_delta_usd:
            patch.price_delta_usd ?? Number(value.price_delta_usd || 0),
          sort_order: patch.sort_order ?? Number(value.sort_order || 0),
          is_active: patch.is_active ?? value.is_active,
        }),
      });

      setMessage("Orden actualizado.");
      onSaved();
    } catch (error: any) {
      setMessage(error.message || "No se pudo ordenar la opcion.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveProducts() {
    setIsSaving(true);
    setMessage("");

    try {
      await apiRequest(pin, {
        method: "POST",
        body: JSON.stringify({
          action: "apply_products",
          group_id: group.id,
          product_ids: Array.from(selectedProducts),
        }),
      });

      setMessage("Productos seleccionados guardados.");
      onSaved();
    } catch (error: any) {
      setMessage(error.message || "No se pudieron guardar los productos.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteGroup() {
    if (
      !window.confirm(
        `Eliminar "${group.name}"? Se quitara de los productos y no afectara pedidos anteriores.`
      )
    ) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      await apiRequest(pin, {
        method: "DELETE",
        body: JSON.stringify({
          action: "delete_group",
          id: group.id,
        }),
      });

      setMessage("Grupo eliminado.");
      onSaved();
    } catch (error: any) {
      setMessage(error.message || "No se pudo eliminar el grupo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteValue(value: OptionValueRow) {
    if (!window.confirm(`Eliminar la opcion "${value.name}"?`)) return;

    setIsSaving(true);
    setMessage("");

    try {
      await apiRequest(pin, {
        method: "DELETE",
        body: JSON.stringify({
          action: "delete_value",
          id: value.id,
        }),
      });

      setMessage("Opcion eliminada.");
      onSaved();
    } catch (error: any) {
      setMessage(error.message || "No se pudo eliminar la opcion.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#25262B]/[0.06]">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black text-[#25262B]">{group.name}</h3>
            <span
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black",
                draft.is_active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-600",
              ].join(" ")}
            >
              {draft.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
              {draft.is_active ? "Activo" : "Pausado"}
            </span>
            <span className="rounded-full bg-[#F8F3E8] px-3 py-1 text-[11px] font-black text-[#746f69]">
              {draft.required ? "Obligatorio" : "Opcional"}
            </span>
            <span className="rounded-full bg-[#F8F3E8] px-3 py-1 text-[11px] font-black text-[#746f69]">
              {draft.selection_type === "single" ? "Una sola opcion" : "Varias opciones"}
            </span>
          </div>
          <p className="mt-2 text-sm font-bold text-[#746f69]">
            {activeValuesCount} opciones activas de {values.length} · Aplicado a{" "}
            {selectedProducts.size} productos
          </p>
          <p className="mt-1 text-sm font-bold text-[#2E3A79]">{getRangeText(group)}</p>
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button
            type="button"
            onClick={() =>
              setDraft((current) => ({ ...current, is_active: !current.is_active }))
            }
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F8F3E8] px-4 py-2 text-xs font-black text-[#2E3A79]"
          >
            {draft.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
            {draft.is_active ? "Pausar" : "Activar"}
          </button>
          <button
            type="button"
            onClick={deleteGroup}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-red-50 px-4 py-2 text-xs font-black text-red-700 disabled:opacity-60"
          >
            <Trash2 size={15} />
            Eliminar
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="space-y-3 rounded-2xl bg-[#F8F3E8] p-3">
          <div className="flex items-center gap-2">
            <Settings2 size={17} className="text-[#2E3A79]" />
            <h4 className="text-sm font-black">Editar grupo de opciones</h4>
          </div>
          <input
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
          />
          <input
            value={draft.description}
            onChange={(event) =>
              setDraft((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Descripcion opcional para orientar al cliente"
            className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={draft.selection_type}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  selection_type: event.target.value as "single" | "multiple",
                  max_select: event.target.value === "single" ? "1" : current.max_select,
                }))
              }
              className="rounded-2xl border border-[#25262B]/10 px-3 py-3 text-sm font-black outline-none"
            >
              <option value="single">El cliente elige una sola opcion</option>
              <option value="multiple">El cliente puede elegir varias</option>
            </select>
            <button
              type="button"
              onClick={() =>
                setDraft((current) => ({ ...current, required: !current.required }))
              }
              className={[
                "rounded-full px-4 py-3 text-sm font-black",
                draft.required
                  ? "bg-[#FFB547] text-[#25262B]"
                  : "bg-white text-[#746f69]",
              ].join(" ")}
            >
              {draft.required ? "Si, debe elegir" : "No, puede continuar"}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase text-[#746f69]">
                Minimo
              </span>
              <input
                type="number"
                value={draft.min_select}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, min_select: event.target.value }))
                }
                className="w-full rounded-2xl border border-[#25262B]/10 px-3 py-3 text-sm font-black outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase text-[#746f69]">
                Maximo
              </span>
              <input
                type="number"
                value={draft.max_select}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, max_select: event.target.value }))
                }
                className="w-full rounded-2xl border border-[#25262B]/10 px-3 py-3 text-sm font-black outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase text-[#746f69]">
                Orden
              </span>
              <input
                type="number"
                value={draft.sort_order}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, sort_order: event.target.value }))
                }
                className="w-full rounded-2xl border border-[#25262B]/10 px-3 py-3 text-sm font-black outline-none"
              />
            </label>
          </div>
          <p className="text-xs font-bold text-[#746f69]">
            Talla y color suelen ser obligatorios. Extras, toppings y salsas suelen ser opcionales.
          </p>
          <button
            type="button"
            onClick={saveGroup}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-full bg-[#2E3A79] px-4 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar grupo
          </button>
        </section>

        <section className="rounded-2xl bg-[#F8F3E8] p-3">
          <div className="flex items-center gap-2">
            <Layers3 size={17} className="text-[#2E3A79]" />
            <h4 className="text-sm font-black">Opciones</h4>
          </div>
          <p className="mt-1 text-xs font-bold text-[#746f69]">
            Pausar una opcion evita que el cliente la seleccione y no afecta pedidos anteriores.
          </p>

          <div className="mt-3 space-y-2">
            {values.map((value) => {
              const isEditing = editingValueId === value.id;

              return (
                <div key={value.id} className="rounded-2xl bg-white p-3">
                  {isEditing ? (
                    <div className="grid gap-2 sm:grid-cols-[1fr_120px_90px_auto]">
                      <input
                        value={editingValue.name}
                        onChange={(event) =>
                          setEditingValue((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-[#25262B]/10 px-3 py-2 text-sm font-bold outline-none"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={editingValue.price_delta_usd}
                        onChange={(event) =>
                          setEditingValue((current) => ({
                            ...current,
                            price_delta_usd: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-[#25262B]/10 px-3 py-2 text-sm font-bold outline-none"
                        placeholder="Precio adicional"
                      />
                      <input
                        type="number"
                        value={editingValue.sort_order}
                        onChange={(event) =>
                          setEditingValue((current) => ({
                            ...current,
                            sort_order: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-[#25262B]/10 px-3 py-2 text-sm font-bold outline-none"
                        placeholder="Orden"
                      />
                      <button
                        type="button"
                        onClick={() => saveValue(value)}
                        disabled={isSaving}
                        className="rounded-full bg-[#2E3A79] px-4 py-2 text-xs font-black text-white disabled:opacity-60"
                      >
                        Guardar
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{value.name}</p>
                        <p className="text-xs font-bold text-[#746f69]">
                          Precio adicional: {formatUsd(value.price_delta_usd)} · Orden{" "}
                          {value.sort_order}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditValue(value)}
                          className="rounded-full bg-[#F8F3E8] px-3 py-1 text-[11px] font-black text-[#2E3A79]"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => moveValue(value, -1)}
                          className="rounded-full bg-[#F8F3E8] px-3 py-1 text-[11px] font-black text-[#2E3A79]"
                        >
                          Subir
                        </button>
                        <button
                          type="button"
                          onClick={() => moveValue(value, 1)}
                          className="rounded-full bg-[#F8F3E8] px-3 py-1 text-[11px] font-black text-[#2E3A79]"
                        >
                          Bajar
                        </button>
                        <button
                          type="button"
                          onClick={() => saveValue(value, !value.is_active)}
                          className={[
                            "rounded-full px-3 py-1 text-[11px] font-black",
                            value.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-zinc-100 text-zinc-600",
                          ].join(" ")}
                        >
                          {value.is_active ? "Activa" : "Pausada"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteValue(value)}
                          disabled={isSaving}
                          className="rounded-full bg-red-50 px-3 py-1 text-[11px] font-black text-red-700 disabled:opacity-60"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_130px_auto]">
            <input
              value={valueDraft.name}
              onChange={(event) =>
                setValueDraft((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Nueva opcion"
              className="rounded-2xl border border-[#25262B]/10 px-3 py-2 text-sm font-bold outline-none"
            />
            <input
              type="number"
              step="0.01"
              value={valueDraft.price_delta_usd}
              onChange={(event) =>
                setValueDraft((current) => ({
                  ...current,
                  price_delta_usd: event.target.value,
                }))
              }
              placeholder="Precio adicional"
              className="rounded-2xl border border-[#25262B]/10 px-3 py-2 text-sm font-bold outline-none"
            />
            <button
              type="button"
              onClick={addValue}
              disabled={isSaving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#FFB547] px-4 text-xs font-black text-[#25262B] disabled:opacity-60"
            >
              <Plus size={15} />
              Agregar
            </button>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-2xl bg-[#F8F3E8] p-3">
        <button
          type="button"
          onClick={() => setIsProductsOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div>
            <h4 className="text-sm font-black">A que productos aplica este grupo?</h4>
            <p className="mt-1 text-xs font-bold text-[#746f69]">
              Selecciona los productos donde el cliente vera estas opciones.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-[#2E3A79]">
            Seleccionados: {selectedProducts.size}
            <ChevronDown size={15} />
          </span>
        </button>

        {isProductsOpen ? (
          <div className="mt-3">
            <div className="grid gap-2 lg:grid-cols-[1fr_220px_auto]">
              <label className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2">
                <Search size={16} className="text-[#746f69]" />
                <input
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  placeholder="Buscar producto..."
                  className="w-full bg-transparent text-sm font-bold outline-none"
                />
              </label>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded-2xl border border-[#25262B]/10 bg-white px-3 py-2 text-sm font-black outline-none"
              >
                <option value="all">Todas las categorias</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={saveProducts}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-4 py-2 text-xs font-black text-white disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar productos seleccionados
              </button>
            </div>
            <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {filteredProducts.map((product) => (
                <label
                  key={product.id}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(product.id)}
                    onChange={() => updateSelectedProduct(product.id)}
                    className="h-4 w-4 accent-[#2E3A79]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black">{product.name}</span>
                    <span className="block truncate text-xs font-bold text-[#746f69]">
                      {product.categories?.name || "Sin categoria"} · {formatUsd(product.price_usd)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {message && <p className="mt-3 text-xs font-black text-[#2E3A79]">{message}</p>}
    </article>
  );
}

export function OptionsManager() {
  const [pin, setPin] = useState("");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [groups, setGroups] = useState<OptionGroupRow[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [query, setQuery] = useState("");
  const [isCheckingAccess, setIsCheckingAccess] = useState(() =>
    shouldShowPanelInitialAccessGate()
  );
  const [isLoading, setIsLoading] = useState(() => hasSavedPanelAuth());
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    selection_type: "single" as "single" | "multiple",
    required: false,
    min_select: "",
    max_select: "",
    templateOptions: [] as string[],
  });

  const storeProducts = products.filter((product) => product.store_id === selectedStoreId);
  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groups
      .filter((group) => group.store_id === selectedStoreId)
      .filter((group) => {
        if (!needle) return true;
        return [group.name, group.description || ""]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      });
  }, [groups, query, selectedStoreId]);

  async function loadData(currentPin: string) {
    setIsLoading(true);
    setMessage("");

    try {
      const data = await apiRequest(currentPin);
      setStores(data.stores || []);
      setProducts(data.products || []);
      setGroups(data.groups || []);
      setSelectedStoreId((current) => current || data.stores?.[0]?.id || "");
      setIsUnlocked(true);
      savePanelPin(currentPin);
    } catch (error: any) {
      setMessage(error.message || "No se pudieron cargar las opciones.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }

  function applyTemplate(template: Template) {
    setNewGroup({
      name: template.name,
      description: template.description,
      selection_type: template.selection_type,
      required: template.required,
      min_select: String(template.min_select),
      max_select: String(template.max_select),
      templateOptions: template.options,
    });
    setMessage(`Plantilla "${template.label}" cargada. Puedes ajustarla y crearla.`);
  }

  async function createGroup() {
    if (!selectedStoreId || !newGroup.name.trim()) return;
    setIsLoading(true);
    setMessage("");

    try {
      const created = await apiRequest(pin, {
        method: "POST",
        body: JSON.stringify({
          action: "create_group",
          store_id: selectedStoreId,
          name: newGroup.name,
          description: newGroup.description,
          selection_type: newGroup.selection_type,
          required: newGroup.required,
          min_select: Number(newGroup.min_select || 0),
          max_select: Number(newGroup.max_select || 0),
          sort_order: visibleGroups.length + 1,
        }),
      });

      const groupId = created.group?.id;
      if (groupId && newGroup.templateOptions.length) {
        for (const [index, option] of newGroup.templateOptions.entries()) {
          await apiRequest(pin, {
            method: "POST",
            body: JSON.stringify({
              action: "create_value",
              group_id: groupId,
              name: option,
              price_delta_usd: 0,
              sort_order: index + 1,
            }),
          });
        }
      }

      setNewGroup({
        name: "",
        description: "",
        selection_type: "single",
        required: false,
        min_select: "",
        max_select: "",
        templateOptions: [],
      });
      await loadData(pin);
    } catch (error: any) {
      setMessage(error.message || "No se pudo crear el grupo de opciones.");
    } finally {
      setIsLoading(false);
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

  if (isCheckingAccess) {
    return <PanelAccessGate />;
  }

  if (!isUnlocked && isLoading) {
    return <PanelModuleSkeleton label="Cargando opciones y extras..." />;
  }

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso del panel</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesion con tu usuario autorizado para continuar.
        </p>
        <a
          href="/panel/login"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
        >
          <CheckCircle2 size={18} />
          Iniciar sesion
        </a>
        {message && <p className="mt-3 text-sm font-black text-red-600">{message}</p>}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white p-4 shadow-lg shadow-[#2E3A79]/[0.05] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
              Opciones reutilizables
            </p>
            <h2 className="mt-1 text-2xl font-black">Opciones y extras</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-relaxed text-[#746f69]">
              Crea tallas, colores, salsas, bebidas, sabores o extras y aplicalos a varios productos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadData(pin)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Settings2 size={16} />}
            Actualizar
          </button>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {[
            ["1", "Crea un grupo"],
            ["2", "Agrega opciones"],
            ["3", "Aplicalo a productos"],
            ["4", "El cliente personaliza"],
          ].map(([step, label]) => (
            <div key={step} className="rounded-2xl bg-[#F8F3E8] p-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#2E3A79] text-xs font-black text-white">
                {step}
              </span>
              <p className="mt-2 text-sm font-black text-[#25262B]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#25262B]/[0.06]">
        <div className="flex items-center gap-2">
          <Wand2 size={18} className="text-[#2E3A79]" />
          <h2 className="text-lg font-black">Plantillas rapidas</h2>
        </div>
        <p className="mt-1 text-sm font-bold text-[#746f69]">
          Elige una plantilla para precargar el formulario. Luego puedes cambiar nombres y precios.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {quickTemplates.map((template) => (
            <button
              key={template.key}
              type="button"
              onClick={() => applyTemplate(template)}
              className="rounded-2xl bg-[#F8F3E8] p-3 text-left transition hover:bg-[#FFB547]/25"
            >
              <p className="text-sm font-black">{template.label}</p>
              <p className="mt-1 text-xs font-bold text-[#746f69]">
                {getSelectionLabel(template)} · {template.required ? "Obligatorio" : "Opcional"}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#25262B]/[0.06]">
        <div className="grid gap-3 xl:grid-cols-[220px_1fr] xl:items-end">
          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
              Comercio
            </span>
            <select
              value={selectedStoreId}
              onChange={(event) => setSelectedStoreId(event.target.value)}
              className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl bg-[#F8F3E8] px-4 py-3">
            <Search size={18} className="text-[#746f69]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar grupo de opciones..."
              className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-[#746f69]/70"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#25262B]/[0.06]">
        <h2 className="text-lg font-black">Nuevo grupo de opciones</h2>
        <p className="mt-1 text-sm font-bold text-[#746f69]">
          Usa una sola opcion para tallas, colores o tamanos. Usa varias opciones para extras, toppings o salsas.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
          <input
            value={newGroup.name}
            onChange={(event) =>
              setNewGroup((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Ej: Salsas, Extras, Talla, Color, Bebidas"
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none"
          />
          <input
            value={newGroup.description}
            onChange={(event) =>
              setNewGroup((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Descripcion opcional"
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none"
          />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_120px_120px_auto]">
          <select
            value={newGroup.selection_type}
            onChange={(event) =>
              setNewGroup((current) => ({
                ...current,
                selection_type: event.target.value as "single" | "multiple",
                max_select: event.target.value === "single" ? "" : current.max_select,
              }))
            }
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none"
          >
            <option value="single">El cliente elige una sola opcion</option>
            <option value="multiple">El cliente puede elegir varias</option>
          </select>
          <button
            type="button"
            onClick={() =>
              setNewGroup((current) => ({
                ...current,
                required: !current.required,
                min_select: !current.required ? "1" : "",
              }))
            }
            className={[
              "rounded-full px-4 py-3 text-sm font-black",
              newGroup.required
                ? "bg-[#FFB547] text-[#25262B]"
                : "bg-[#F8F3E8] text-[#746f69]",
            ].join(" ")}
          >
            {newGroup.required ? "Si, debe elegir" : "No, puede continuar"}
          </button>
          <input
            type="number"
            value={newGroup.min_select}
            onChange={(event) =>
              setNewGroup((current) => ({ ...current, min_select: event.target.value }))
            }
            placeholder="Minimo"
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none"
          />
          <input
            type="number"
            value={newGroup.max_select}
            onChange={(event) =>
              setNewGroup((current) => ({ ...current, max_select: event.target.value }))
            }
            placeholder="Maximo"
            className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none"
          />
          <button
            type="button"
            onClick={createGroup}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            <Plus size={16} />
            Crear grupo
          </button>
        </div>
        {newGroup.templateOptions.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {newGroup.templateOptions.map((option) => (
              <span
                key={option}
                className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black text-[#746f69]"
              >
                {option}
              </span>
            ))}
          </div>
        ) : null}
        {message && <p className="mt-3 text-sm font-black text-[#2E3A79]">{message}</p>}
      </section>

      <section className="space-y-3">
        {visibleGroups.length ? (
          visibleGroups.map((group) => (
            <GroupEditor
              key={group.id}
              group={group}
              products={storeProducts}
              pin={pin}
              onSaved={() => loadData(pin)}
            />
          ))
        ) : (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#25262B]/[0.06]">
            <PackageCheck className="mx-auto text-[#2E3A79]" size={34} />
            <h3 className="mt-3 text-xl font-black">Todavia no tienes opciones creadas.</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm font-bold text-[#746f69]">
              Crea opciones como tallas, colores, salsas, sabores o extras para que tus clientes personalicen productos.
            </p>
            <button
              type="button"
              onClick={() => applyTemplate(quickTemplates[0])}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
            >
              <Wand2 size={16} />
              Crear mi primera opcion
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
