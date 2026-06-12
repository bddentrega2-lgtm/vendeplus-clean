"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  Pencil,
  PlusCircle,
  RefreshCcw,
  Search,
} from "lucide-react";
import {
  getPanelAuthHeaders,
  getSavedPanelToken,
  hasSavedPanelAuth,
} from "@/lib/panel/client-auth";

type StoreRow = {
  id: string;
  slug: string;
  name: string;
  business_type: string | null;
  whatsapp: string | null;
  is_active: boolean;
  product_count: number;
  order_count: number;
  user_count: number;
};

async function apiRequest(pin: string) {
  const response = await fetch("/api/admin/stores", {
    headers: await getPanelAuthHeaders(pin),
  });
  const data = await response.json();

  if (!response.ok) throw new Error(data.error || "Error cargando comercios.");

  return data;
}

export function AdminStoresManager() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [query, setQuery] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => hasSavedPanelAuth());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const filteredStores = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return stores;

    return stores.filter((store) =>
      [store.name, store.slug, store.business_type, store.whatsapp]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [query, stores]);

  async function loadStores() {
    setIsLoading(true);
    setError("");

    try {
      const data = await apiRequest("");
      setStores(data.stores || []);
      setIsUnlocked(true);
    } catch (error: any) {
      setError(error.message || "No se pudo cargar comercios.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }

  useEffect(() => {
    const savedToken = getSavedPanelToken();

    if (savedToken) {
      loadStores();
    } else {
      setIsCheckingAccess(false);
    }
  }, []);

  if (isCheckingAccess) {
    return (
      <section className="rounded-[34px] bg-white p-6 text-center shadow-xl shadow-[#2E3A79]/[0.07]">
        <Loader2 size={22} className="mx-auto animate-spin text-[#25262B]" />
        <p className="mt-3 text-sm font-black text-[#746f69]">Validando acceso...</p>
      </section>
    );
  }

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#25262B] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso fundador</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesión con un email fundador para administrar comercios.
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
      <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
              Directorio comercial
            </p>
            <h2 className="mt-1 text-3xl font-black">{stores.length} comercios</h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex items-center gap-2 rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3">
              <Search size={17} className="text-[#746f69]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar comercio"
                className="w-full bg-transparent text-sm font-bold outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => loadStores()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F8F3E8] px-4 py-3 text-sm font-black text-[#2E3A79]"
            >
              <RefreshCcw size={16} />
              Actualizar
            </button>
            <Link
              href="/admin/comercios/nuevo"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B]"
            >
              <PlusCircle size={16} />
              Nuevo
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        {filteredStores.map((store) => (
          <article
            key={store.id}
            className="rounded-[28px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06] ring-1 ring-[#25262B]/[0.06]"
          >
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Building2 size={19} className="text-[#2E3A79]" />
                  <h3 className="text-2xl font-black">{store.name}</h3>
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-xs font-black",
                      store.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700",
                    ].join(" ")}
                  >
                    {store.is_active ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold text-[#746f69]">
                  /{store.slug} · {store.business_type || "general"} · {store.whatsapp || "sin WhatsApp"}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[320px]">
                <div className="rounded-2xl bg-[#F8F3E8] px-3 py-2">
                  <p className="text-lg font-black">{store.product_count}</p>
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">Productos</p>
                </div>
                <div className="rounded-2xl bg-[#F8F3E8] px-3 py-2">
                  <p className="text-lg font-black">{store.order_count}</p>
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">Pedidos</p>
                </div>
                <div className="rounded-2xl bg-[#F8F3E8] px-3 py-2">
                  <p className="text-lg font-black">{store.user_count}</p>
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">Usuarios</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/comercios/${store.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25262B] px-4 py-3 text-sm font-black text-white"
                >
                  <Pencil size={16} />
                  Editar
                </Link>
                <a
                  href={`/${store.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-4 py-3 text-sm font-black text-white"
                >
                  <ExternalLink size={16} />
                  Catálogo
                </a>
              </div>
            </div>
          </article>
        ))}

        {filteredStores.length === 0 && (
          <section className="rounded-[28px] bg-white p-6 text-sm font-bold text-[#746f69] shadow-xl shadow-[#2E3A79]/[0.06]">
            No hay comercios que coincidan con la búsqueda.
          </section>
        )}
      </section>
    </div>
  );
}
