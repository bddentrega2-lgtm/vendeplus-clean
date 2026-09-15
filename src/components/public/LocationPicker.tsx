"use client";

import { AlertCircle, CheckCircle2, LocateFixed, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DeliveryLocation } from "@/types";
import type { Map as LeafletMap, Marker } from "leaflet";

let leafletPromise: Promise<typeof import("leaflet")> | null = null;

type SearchResult = {
  label: string;
  latitude: number;
  longitude: number;
  source: "openstreetmap";
  locationLink?: string;
};

function escapeMarkerLabel(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);
}

function loadLeaflet() {
  leafletPromise ||= import("leaflet");
  return leafletPromise;
}

type Props = {
  storeLatitude: number;
  storeLongitude: number;
  storeName?: string;
  searchArea?: string;
  value: DeliveryLocation | null;
  onChange: (location: DeliveryLocation) => void;
  mode?: "delivery" | "store";
  pointName?: string;
  referenceMarkerLabel?: string;
  referencePopupLabel?: string;
  allowCurrentLocation?: boolean;
};

export function LocationPicker({
  storeLatitude,
  storeLongitude,
  storeName = "Comercio",
  searchArea,
  value,
  onChange,
  mode = "delivery",
  pointName,
  referenceMarkerLabel = "Retiro aqui",
  referencePopupLabel = "Punto de retiro",
  allowCurrentLocation = true,
}: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const destinationMarkerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const isMountedRef = useRef(true);
  const initialCenterRef = useRef({ latitude: storeLatitude, longitude: storeLongitude, storeName });
  const [showMap, setShowMap] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");
  const [draftLocation, setDraftLocation] = useState<DeliveryLocation | null>(value);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const selectedLabel = pointName
    ? `Ubicacion de ${pointName.toLowerCase()}`
    : mode === "store"
      ? "Ubicacion del negocio"
      : "Punto elegido en el mapa";

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadLeaflet();
  }, []);

  useEffect(() => {
    setDraftLocation(value);
  }, [value]);

  useEffect(() => {
    if (!showMap) {
      initialCenterRef.current = { latitude: storeLatitude, longitude: storeLongitude, storeName };
    }
  }, [showMap, storeLatitude, storeLongitude, storeName]);

  const updateDestinationMarker = useCallback(
    async (latitude: number, longitude: number) => {
      if (!leafletMapRef.current) return;

      const leaflet = await loadLeaflet();
      const latLng: [number, number] = [latitude, longitude];
      const icon = leaflet.divIcon({
        className: "vendeplus-destination-marker",
        html:
          pointName
            ? `<div class="vp-map-pin ${mode === "store" ? "vp-map-pin-store" : "vp-map-pin-delivery"}"><span>${escapeMarkerLabel(pointName)}</span></div>`
            : mode === "store"
              ? '<div class="vp-map-pin vp-map-pin-store"><span>Comercio</span></div>'
              : '<div class="vp-map-pin vp-map-pin-delivery"><span>Recibir aqui</span></div>',
        iconSize: [118, 42],
        iconAnchor: [59, 42],
      });

      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setLatLng(latLng);
      } else {
        destinationMarkerRef.current = leaflet
          .marker(latLng, { draggable: true, icon })
          .addTo(leafletMapRef.current);
        destinationMarkerRef.current.on("dragend", () => {
          const latLng = destinationMarkerRef.current?.getLatLng();
          if (!latLng) return;
          setDraftLocation((current) => ({
            latitude: latLng.lat,
            longitude: latLng.lng,
            label: current?.label || selectedLabel,
            source: "map",
            accuracyMeters: current?.accuracyMeters,
          }));
          onChangeRef.current({
            latitude: latLng.lat,
            longitude: latLng.lng,
            label: selectedLabel,
            source: "map",
          });
          setMessageType("info");
          setMessage("Pin ajustado. Puedes continuar o moverlo si necesitas corregirlo.");
        });
      }

      leafletMapRef.current.setView(latLng, 16);
    },
    [mode, pointName, selectedLabel]
  );

  const prepareDestination = useCallback(
    async (
      latitude: number,
      longitude: number,
      label: string,
      source: DeliveryLocation["source"],
      accuracyMeters?: number
    ) => {
      const nextLocation = { latitude, longitude, label, source, accuracyMeters };
      setShowMap(true);
      setDraftLocation(nextLocation);
      await updateDestinationMarker(latitude, longitude);
      onChangeRef.current(nextLocation);
      setMessageType("info");
      setMessage("Punto guardado. Ajusta el pin hasta la entrada si necesitas precisar la ubicacion.");
    },
    [updateDestinationMarker]
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!showMap || !mapRef.current || leafletMapRef.current) return;

      const leaflet = await loadLeaflet();
      if (!mounted || !mapRef.current) return;
      const initialCenter = initialCenterRef.current;

      const storeIcon = leaflet.divIcon({
        className: "vendeplus-store-marker",
        html: `<div class="vp-map-pin vp-map-pin-store"><span>${escapeMarkerLabel(referenceMarkerLabel)}</span></div>`,
        iconSize: [104, 42],
        iconAnchor: [52, 42],
      });

      const map = leaflet.map(mapRef.current, {
        center: [initialCenter.latitude, initialCenter.longitude],
        zoom: 14,
        zoomControl: true,
      });
      leafletMapRef.current = map;

      requestAnimationFrame(() => map.invalidateSize());
      window.setTimeout(() => map.invalidateSize(), 250);

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(map);

      if (mode !== "store") {
        leaflet
          .marker([initialCenter.latitude, initialCenter.longitude], { icon: storeIcon })
          .addTo(map)
          .bindPopup(`${referencePopupLabel}: ${initialCenter.storeName}`);
      }

      map.on("click", (event) => {
        void prepareDestination(event.latlng.lat, event.latlng.lng, selectedLabel, "map");
      });

      setIsReady(true);
    }

    init();

    return () => {
      mounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        destinationMarkerRef.current = null;
      }
    };
  }, [mode, prepareDestination, referenceMarkerLabel, referencePopupLabel, selectedLabel, showMap]);

  useEffect(() => {
    if (!draftLocation || !showMap || !isReady) return;

    void updateDestinationMarker(draftLocation.latitude, draftLocation.longitude);
  }, [draftLocation, isReady, showMap, updateDestinationMarker]);

  useEffect(() => {
    const trimmed = query.trim();
    setSearchError("");
    if (!showSearch || trimmed.length < 3) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams({
          q: trimmed,
          lat: String(storeLatitude),
          lng: String(storeLongitude),
        });
        if (searchArea) params.set("area", searchArea);
        const response = await fetch(`/api/geocode?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo buscar la direccion.");
        setResults(Array.isArray(data.results) ? data.results : []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearchError(
            error instanceof Error
              ? error.message
              : "No se pudo consultar el buscador. Puedes elegir el punto en el mapa."
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, searchArea, showSearch, storeLatitude, storeLongitude]);

  async function useCurrentLocation() {
    setMessage("");

    if (!navigator.geolocation) {
      setMessageType("error");
      setMessage("Este navegador no permite tomar ubicacion actual. Puedes elegir el punto en el mapa o buscar una direccion.");
      return;
    }

    try {
      if (navigator.permissions?.query) {
        const permission = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        if (permission.state === "denied") {
          setMessageType("error");
          setMessage("Permiso rechazado. Puedes elegir el punto en el mapa o buscar una direccion.");
          return;
        }
      }
    } catch {
      // Some browsers cannot query permissions. Trying geolocation is still safe.
    }

    setShowMap(true);
    setIsLocating(true);
    setMessageType("info");
    setMessage("Buscando tu ubicacion actual...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMountedRef.current) return;
        setIsLocating(false);
        void prepareDestination(
          position.coords.latitude,
          position.coords.longitude,
          mode === "store" ? "Ubicacion actual de origen" : "Ubicacion actual",
          "current",
          position.coords.accuracy
        );
      },
      (error) => {
        if (!isMountedRef.current) return;
        setIsLocating(false);
        setMessageType("error");
        if (error.code === error.PERMISSION_DENIED) {
          setMessage("Permiso rechazado. Puedes elegir el punto en el mapa o buscar una direccion.");
        } else if (error.code === error.TIMEOUT) {
          setMessage("La ubicacion tardo demasiado. Puedes intentar otra vez, elegir en el mapa o buscar una direccion.");
        } else {
          setMessage("No pudimos tomar la ubicacion actual. Puedes elegir el punto en el mapa o buscar una direccion.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 }
    );
  }

  return (
    <div className="space-y-3">
      <div className={allowCurrentLocation ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"}>
        {allowCurrentLocation ? (
          <button type="button" onClick={useCurrentLocation} className="vp-button-primary w-full">
            <LocateFixed size={18} /> {isLocating ? "Buscando..." : "Usar mi ubicacion actual"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setShowMap(true);
            if (!leafletMapRef.current) setIsReady(false);
          }}
          className="vp-button-soft w-full"
        >
          <MapPin size={18} /> Elegir en el mapa
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowSearch((current) => !current)}
        className="inline-flex items-center gap-2 rounded-xl px-2 py-1 text-sm font-black text-slate-500 underline decoration-slate-300 underline-offset-4"
      >
        <Search size={16} /> Buscar direccion o lugar
      </button>

      {showSearch ? (
        <div className="space-y-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-slate-400"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej.: avenida, centro comercial o lugar conocido"
          />
          {isSearching ? <p className="text-xs font-bold text-slate-500">Buscando...</p> : null}
          {searchError ? (
            <p className="text-xs font-bold text-amber-700">No pudimos buscar ahora. Puedes continuar con ubicacion actual o mapa.</p>
          ) : null}
          {!isSearching && !searchError && query.trim().length >= 3 && results.length === 0 ? (
            <p className="text-xs font-bold text-slate-500">No encontramos ese lugar. Prueba con otra referencia o elige el punto en el mapa.</p>
          ) : null}
          {results.length ? (
            <div className="space-y-2">
              {results.map((result) => (
                <button
                  type="button"
                  key={`${result.latitude}-${result.longitude}-${result.label}`}
                  onClick={() => {
                    void prepareDestination(result.latitude, result.longitude, result.label, "search");
                    setShowSearch(false);
                  }}
                  className="w-full rounded-xl bg-white px-3 py-2 text-left text-sm font-bold text-slate-700 ring-1 ring-slate-200"
                >
                  {result.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {showMap ? (
        <div className="overflow-hidden rounded-[24px] border border-[#25262B]/10 bg-white shadow-sm">
          <div ref={mapRef} className="h-[340px] w-full" />
          <div className="space-y-3 border-t border-[#25262B]/10 bg-white p-3">
            <p className="text-center text-xs font-bold text-[#746f69]">
              Punto guardado. Ajusta el pin hasta la entrada o el punto donde sera atendido el repartidor.
            </p>
          </div>
        </div>
      ) : null}

      {showMap && !isReady ? (
        <p className="rounded-2xl bg-white p-3 text-xs font-black text-[#746f69]">Cargando mapa...</p>
      ) : null}

      {message ? (
        <div
          className={
            messageType === "success"
              ? "flex gap-2 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-700"
              : messageType === "error"
                ? "flex gap-2 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700"
                : "flex gap-2 rounded-2xl bg-[#FFF8F0] p-3 text-sm font-bold text-[#746f69]"
          }
        >
          {messageType === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}
