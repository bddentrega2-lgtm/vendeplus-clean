"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Lock, RefreshCcw, Settings } from "lucide-react";

type StoreRow = {
  id: string;
  slug: string;
  name: string;
  whatsapp?: string | null;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  is_active?: boolean;
  accepts_delivery?: boolean;
  accepts_pickup?: boolean;
};

function getSavedToken() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("vendeplus_panel_token") || "";
}

function getSavedPin() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("vendeplus_panel_pin") || "";
}

async function apiRequest(pin: string) {
  const token = getSavedToken();

  const response = await fetch("/api/panel/products", {
    headers: token
      ? { Authorization: `Bearer ${token}` }
      : { "x-panel-pin": pin },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error cargando configuración.");
  }

  return data;
}

export function ConfigManager() {
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadConfig(currentPin: string) {
    setIsLoading(true);
    setError("");

    try {
      const data = await apiRequest(currentPin);
      setStores(data.stores || []);
      setIsUnlocked(true);

      if (currentPin) {
        sessionStorage.setItem("vendeplus_panel_pin", currentPin);
      }
    } catch (error: any) {
      setError(error.message || "No se pudo cargar la configuración.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const savedPin = getSavedPin();
    const savedToken = getSavedToken();

    if (savedPin || savedToken) {
      setPin(savedPin);
      loadConfig(savedPin);
    }
  }, []);

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso a configuración</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesión o usa el PIN temporal para ver los comercios asignados.
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
          onClick={() => loadConfig(pin)}
          disabled={isLoading}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          Entrar
        </button>

        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[34px] bg-[#25262B] p-5 text-white shadow-xl shadow-[#25262B]/20">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
              Configuración por comercio
            </p>
            <h2 className="mt-2 text-3xl font-black">Comercios asignados</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-white/70">
              Esta vista ahora muestra solo los comercios vinculados al usuario conectado.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadConfig(pin)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
          >
            <RefreshCcw size={16} />
            Actualizar
          </button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {stores.map((store) => (
          <section key={store.id} className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">{store.name}</h2>
                <p className="mt-2 text-sm font-bold text-[#746f69]">{store.address || "Sin dirección"}</p>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-3xl bg-[#FFB547]/20 text-[#2E3A79]">
                <Settings size={22} />
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm font-bold">
              <div className="rounded-3xl bg-[#F8F3E8] p-4">
                WhatsApp: {store.whatsapp || "No configurado"}
              </div>
              <div className="rounded-3xl bg-[#F8F3E8] p-4">
                Coordenadas: {store.latitude || "—"}, {store.longitude || "—"}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-green-100 px-3 py-2 text-xs font-black text-green-700">
                  {store.accepts_delivery ? "Delivery activo" : "Sin delivery"}
                </span>
                <span className="rounded-full bg-blue-100 px-3 py-2 text-xs font-black text-blue-700">
                  {store.accepts_pickup ? "Pickup activo" : "Sin pickup"}
                </span>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
