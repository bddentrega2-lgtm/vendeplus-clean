"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, LocateFixed, MapPin } from "lucide-react";
import { BrandLogo } from "@/components/public/BrandLogo";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

type Coordinates = { latitude: number; longitude: number };

export type TdkBranch = {
  id: string;
  slug: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  logoUrl: string;
  heroImageUrl: string;
  isActive: boolean;
};

function hasCoordinates(store: TdkBranch) {
  return Number.isFinite(store.latitude) && Number.isFinite(store.longitude) &&
    !(store.latitude === 0 && store.longitude === 0);
}

function distanceKm(origin: Coordinates, store: TdkBranch) {
  const radians = (degrees: number) => degrees * (Math.PI / 180);
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(store.latitude - origin.latitude);
  const longitudeDelta = radians(store.longitude - origin.longitude);
  const latitude1 = radians(origin.latitude);
  const latitude2 = radians(store.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function TdkBranchSelector({
  stores,
  isPreview = false,
  brandName = "Pastelería TDK",
  officialLabel = "Enlace oficial TDK",
  storageKey = "somos:tdk:last-branch",
}: {
  stores: TdkBranch[];
  isPreview?: boolean;
  brandName?: string;
  officialLabel?: string;
  storageKey?: string;
}) {
  const [customerLocation, setCustomerLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "error">("idle");
  const [lastBranchSlug, setLastBranchSlug] = useState("");

  useEffect(() => {
    try {
      setLastBranchSlug(window.localStorage.getItem(storageKey) || "");
    } catch {
      // La selección sigue funcionando cuando el navegador bloquea almacenamiento local.
    }
  }, [storageKey]);

  const orderedStores = useMemo(() => {
    return stores
      .map((store) => ({
        store,
        distance: customerLocation && hasCoordinates(store)
          ? distanceKm(customerLocation, store)
          : null,
      }))
      .sort((left, right) => {
        if (left.distance !== null && right.distance !== null) return left.distance - right.distance;
        if (left.distance !== null) return -1;
        if (right.distance !== null) return 1;
        if (left.store.slug === lastBranchSlug) return -1;
        if (right.store.slug === lastBranchSlug) return 1;
        return left.store.name.localeCompare(right.store.name, "es");
      });
  }, [customerLocation, lastBranchSlug, stores]);

  function findNearestBranch() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      return;
    }

    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCustomerLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setLocationStatus("idle");
      },
      () => setLocationStatus("error"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  function rememberBranch(slug: string) {
    try {
      window.localStorage.setItem(storageKey, slug);
    } catch {
      // Navegar al catálogo no depende del almacenamiento local.
    }
  }

  return (
    <main className="somos-page min-h-screen px-4 py-6 sm:py-10">
      <section className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" aria-label="Ir al inicio de Somos"><BrandLogo size="sm" priority /></Link>
          <span className="somos-badge">{officialLabel}</span>
        </header>

        <div className="mt-8 overflow-hidden rounded-[32px] bg-[var(--somos-teal)] p-6 text-white shadow-xl shadow-[var(--somos-teal)]/15 sm:p-9">
          <p className="text-sm font-semibold text-[var(--somos-amber)]">{brandName}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">¿Cuál sede tienes más cerca?</h1>
          <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-white/75 sm:text-base">
            Elige tu sede para ver el catálogo correcto y enviar tu pedido al equipo indicado.
          </p>
          <button
            type="button"
            onClick={findNearestBranch}
            disabled={locationStatus === "loading"}
            className="somos-button-light mt-6 w-full disabled:cursor-wait disabled:opacity-70 sm:w-fit"
          >
            <LocateFixed size={18} />
            {locationStatus === "loading" ? "Buscando tu ubicación…" : "Encontrar sede más cercana"}
          </button>
          {customerLocation ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-200">
              <Check size={16} /> Sedes ordenadas por cercanía.
            </p>
          ) : null}
          {locationStatus === "error" ? (
            <p className="mt-3 text-sm font-medium text-white/75">
              No pudimos usar tu ubicación. Puedes elegir una sede manualmente.
            </p>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4">
          {orderedStores.map(({ store, distance }, index) => {
            const isNearest = customerLocation && distance !== null && index === 0;
            const wasLastSelected = store.slug === lastBranchSlug;

            return (
              <article key={store.id} className="somos-card flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <OptimizedImage
                    src={store.logoUrl || store.heroImageUrl}
                    alt={`Logo de ${store.name}`}
                    width={72}
                    height={72}
                    sizes="72px"
                    className="h-[72px] w-[72px] shrink-0 rounded-2xl bg-white object-cover ring-1 ring-[var(--somos-navy)]/10"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      {isNearest ? <span className="somos-badge">Más cercana</span> : null}
                      {!isNearest && wasLastSelected ? <span className="somos-badge">Tu última sede</span> : null}
                      {!store.isActive ? <span className="somos-badge">En configuración</span> : null}
                    </div>
                    <h2 className="mt-2 text-xl font-bold text-[var(--somos-navy)]">{store.name}</h2>
                    <p className="somos-muted mt-1 flex items-start gap-2 text-sm font-medium">
                      <MapPin size={16} className="mt-0.5 shrink-0" />
                      {distance !== null ? `A ${distance < 10 ? distance.toFixed(1) : Math.round(distance)} km de ti` : store.address}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/${store.slug}`}
                  onClick={() => rememberBranch(store.slug)}
                  className="somos-button-primary w-full shrink-0 sm:w-auto"
                >
                  {store.isActive ? "Elegir esta sede" : "Revisar sede de prueba"} <ArrowRight size={17} />
                </Link>
              </article>
            );
          })}
        </div>

        {!stores.length ? (
          <div className="somos-card mt-5 text-center">
            <h2 className="text-xl font-bold">Las sedes están temporalmente fuera de línea</h2>
            <p className="somos-muted mt-2 text-sm font-medium">Intenta nuevamente en unos minutos.</p>
          </div>
        ) : null}

        <p className="somos-muted mx-auto mt-6 max-w-xl text-center text-xs font-medium leading-5">
          Tu ubicación solo se usa en este dispositivo para calcular cuál sede está más cerca. Somos no la almacena.
        </p>
        {isPreview ? (
          <p className="mx-auto mt-2 max-w-xl text-center text-xs font-bold text-[var(--somos-orange)]">
            Vista de prueba: las sedes en configuración se muestran únicamente en Preview.
          </p>
        ) : null}
      </section>
    </main>
  );
}
