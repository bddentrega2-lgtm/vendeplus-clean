"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { Store } from "@/types";

const markerSize: [number, number] = [44, 56];
const markerAnchor: [number, number] = [22, 56];

export function hasMapCoordinates(store: Pick<Store, "latitude" | "longitude">) {
  return Number.isFinite(store.latitude) && Number.isFinite(store.longitude) && Math.abs(store.latitude) <= 90 && Math.abs(store.longitude) <= 180 && !(store.latitude === 0 && store.longitude === 0);
}

function logoElement(store: Store) {
  const box = document.createElement("span");
  box.className = "market-map-logo";
  const media = document.createElement("span");
  media.className = "market-map-logo-media";
  media.textContent = store.name.slice(0, 2).toUpperCase();
  box.append(media);
  try {
    const url = new URL(store.logoUrl || "", window.location.origin);
    if (store.logoUrl && (url.protocol === "https:" || url.origin === window.location.origin)) {
      const img = document.createElement("img");
      img.alt = store.name; img.referrerPolicy = "no-referrer";
      img.onerror = () => img.remove();
      img.src = url.href;
      media.append(img);
    }
  } catch { /* Initials remain available for an invalid logo. */ }
  return box;
}

function pinElement(store: Store) {
  const pin = document.createElement("span");
  pin.className = "market-map-pin";
  pin.append(logoElement(store));
  return pin;
}

export function MarketplaceMap({ stores }: { stores: Store[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const located = stores.filter(hasMapCoordinates);
  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    setError(false);
    void import("leaflet").then(async () => {
      await import("leaflet.markercluster");
      if (disposed || !container.current) return;
      const L = (window as Window & { L: typeof import("leaflet") }).L;
      // This disposable dialog must not leave a delayed zoom transition after closing.
      map = L.map(container.current, { zoomAnimation: false }).setView([8, -66], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).addTo(map);
      const markerStores = new Map<import("leaflet").Marker, Store>();
      const clusters = L.markerClusterGroup({
        maxClusterRadius: 76, showCoverageOnHover: false, animate: false,
        iconCreateFunction: cluster => {
          const store = markerStores.get(cluster.getAllChildMarkers()[0])!;
          const pin = pinElement(store);
          const count = cluster.getChildCount();
          pin.title = `${count} comercios`;
          const badge = document.createElement("b"); badge.textContent = String(count); pin.append(badge);
          return L.divIcon({ className: "market-map-marker market-map-cluster", html: pin, iconSize: markerSize, iconAnchor: markerAnchor });
        },
      });
      for (const store of stores.filter(hasMapCoordinates)) {
        const pin = pinElement(store);
        const popup = document.createElement("div");
        popup.className = "market-map-popup";
        const link = document.createElement("a");
        link.href = `/${encodeURIComponent(store.slug)}`;
        link.append(logoElement(store), document.createTextNode(store.name));
        popup.append(link);
        const marker = L.marker([store.latitude, store.longitude], { title: store.name, icon: L.divIcon({ className: "market-map-marker", html: pin, iconSize: markerSize, iconAnchor: markerAnchor, popupAnchor: [0, -52] }) }).bindPopup(popup);
        markerStores.set(marker, store);
        clusters.addLayer(marker);
      }
      clusters.addTo(map);
      const points = stores.filter(hasMapCoordinates).map(store => [store.latitude, store.longitude] as [number, number]);
      if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [48, 80], maxZoom: 16 });
      const resize = new ResizeObserver(() => { if (!disposed) map?.invalidateSize(); });
      resize.observe(container.current);
      map.on("unload", () => resize.disconnect());
    }).catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; const current = map; map = undefined; current?.remove(); };
  }, [stores, retry]);
  return <div className="market-map-surface">
    <div ref={container} className="market-map-canvas" aria-label="Mapa de comercios" />
    {!located.length ? <p className="market-map-message" role="status">No hay comercios con ubicacion para estos filtros.</p> : null}
    {error ? <div className="market-map-message" role="alert">No pudimos abrir el mapa.<button type="button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={18} />Reintentar</button></div> : null}
    {located.length < stores.length && located.length > 0 ? <p className="market-map-count">{stores.length - located.length} sin ubicacion registrada</p> : null}
  </div>;
}
