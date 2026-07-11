"use client";

import { useEffect, useState } from "react";
import {
  getPanelAccessToken,
  getPanelAuthHeaders,
  getSavedPanelPin,
} from "@/lib/panel/client-auth";

type StoreIdentity = {
  name: string;
  slug: string;
  logo_url: string | null;
  cover_image_url: string | null;
  subscription_status?: string | null;
  subscription_ends_at?: string | null;
  next_payment_due_at?: string | null;
};

function isExpired(store: StoreIdentity) {
  if (store.subscription_status === "expired" || store.subscription_status === "past_due") return true;
  const due = store.subscription_ends_at || store.next_payment_due_at;
  return Boolean(due && new Date(due).getTime() < Date.now());
}

export function PanelStoreIdentity() {
  const [store, setStore] = useState<StoreIdentity | null>(null);

  useEffect(() => {
    let active = true;

    async function loadIdentity() {
      const savedPin = getSavedPanelPin();
      const savedToken = await getPanelAccessToken();

      if (!savedPin && !savedToken) return;

      try {
        const response = await fetch("/api/panel/settings", {
          headers: await getPanelAuthHeaders(savedPin),
        });
        const data = await response.json();
        const firstStore = data.stores?.[0];

        if (active && firstStore) {
          setStore({
            name: firstStore.name || "Tu negocio",
            slug: firstStore.slug || "",
            logo_url: firstStore.logo_url || null,
            cover_image_url: firstStore.cover_image_url || null,
            subscription_status: firstStore.subscription_status || null,
            subscription_ends_at: firstStore.subscription_ends_at || null,
            next_payment_due_at: firstStore.next_payment_due_at || null,
          });
        }
      } catch {
        if (active) setStore(null);
      }
    }

    loadIdentity();

    return () => {
      active = false;
    };
  }, []);

  if (!store) {
    return (
      <div className="mt-8 rounded-[32px] bg-[#25262B] p-5 text-white">
        <p className="text-sm font-black text-[#FFB547]">Panel de ventas</p>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-white/75">
          Gestiona productos, pedidos, ventas y configuración de tu negocio en un solo lugar.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 overflow-hidden rounded-[32px] bg-[#25262B] text-white shadow-lg shadow-[#2E3A79]/15">
      <div className="h-24 bg-[#2E3A79]">
        {store.cover_image_url ? (
          <img
            src={store.cover_image_url}
            alt={store.name}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="p-4">
        <div className="-mt-10 mb-3 grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-white ring-4 ring-[#25262B]">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={`Logo de ${store.name}`}
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <span className="text-xl font-black text-[#2E3A79]">
              {store.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <p className="truncate text-base font-black">{store.name}</p>
        <p className="mt-1 truncate text-xs font-bold text-white/60">
          /{store.slug || "catalogo"}
        </p>
        {isExpired(store) ? (
          <a
            href="/panel/suscripcion"
            className="mt-3 block rounded-2xl bg-[#FFB547] p-3 text-xs font-black text-[#25262B]"
          >
            Cuenta vencida. Envía tu pago o escribe al admin para reactivar tu página.
          </a>
        ) : null}
      </div>
    </div>
  );
}
