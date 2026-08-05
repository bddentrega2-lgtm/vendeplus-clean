"use client";

import { OptimizedImage } from "@/components/shared/OptimizedImage";
import { isSubscriptionPastDue } from "@/lib/subscription-status";
import { usePanelStore } from "@/components/panel/PanelStoreContext";

type StoreIdentity = {
  name: string;
  slug: string;
  logo_url: string | null;
  cover_image_url: string | null;
  subscription_status?: string | null;
  subscription_ends_at?: string | null;
  next_payment_due_at?: string | null;
  trial_ends_at?: string | null;
};

function isExpired(store: StoreIdentity) {
  return isSubscriptionPastDue(store);
}

export function PanelStoreIdentity() {
  const { activeStore: store } = usePanelStore();

  if (!store) {
    return (
      <div className="mt-8 rounded-[32px] bg-[#25262B] p-5 text-white">
        <p className="text-sm font-black text-[#FFB547]">Somos</p>
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
          <OptimizedImage
            src={store.cover_image_url}
            alt={store.name}
            width={360}
            height={96}
            sizes="320px"
            className="h-full w-full object-cover"
            fallback={<div className="h-full w-full bg-[#2E3A79]" />}
          />
        ) : null}
      </div>
      <div className="p-4">
        <div className="-mt-10 mb-3 grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-white ring-4 ring-[#25262B]">
          {store.logo_url ? (
            <OptimizedImage
              src={store.logo_url}
              alt={`Logo de ${store.name}`}
              width={64}
              height={64}
              sizes="64px"
              className="h-full w-full object-contain p-2"
              fallback={
                <span className="text-xl font-black text-[#2E3A79]">
                  {store.name.slice(0, 1).toUpperCase()}
                </span>
              }
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
