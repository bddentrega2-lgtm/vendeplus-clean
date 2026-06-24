"use client";

import { AlertCircle, CheckCircle2, LocateFixed, MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DeliveryLocation } from "@/types";
import type { Map as LeafletMap, Marker } from "leaflet";

type Props = {
  storeLatitude: number;
  storeLongitude: number;
  storeName?: string;
  value: DeliveryLocation | null;
  onChange: (location: DeliveryLocation) => void;
  mode?: "delivery" | "store";
};

export function LocationPicker({
  storeLatitude,
  storeLongitude,
  storeName = "Comercio",
  value,
  onChange,
  mode = "delivery",
}: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const destinationMarkerRef = useRef<Marker | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">(
    "info"
  );

  const updateDestinationMarker = useCallback(
    async (latitude: number, longitude: number) => {
      if (!leafletMapRef.current) return;

      const leaflet = await import("leaflet");
      const latLng: [number, number] = [latitude, longitude];
      const icon = leaflet.divIcon({
        className: "vendeplus-destination-marker",
        html:
          mode === "store"
            ? '<div class="vp-map-pin vp-map-pin-store"><span>Comercio</span></div>'
            : '<div class="vp-map-pin vp-map-pin-delivery"><span>Recibir aqui</span></div>',
        iconSize: [118, 42],
        iconAnchor: [59, 42],
      });

      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setLatLng(latLng);
      } else {
        destinationMarkerRef.current = leaflet
          .marker(latLng, { icon })
          .addTo(leafletMapRef.current);
      }

      leafletMapRef.current.setView(latLng, 16);
    },
    [mode]
  );

  const selectDestination = useCallback(
    async (
      latitude: number,
      longitude: number,
      label: string,
      source: DeliveryLocation["source"],
      accuracyMeters?: number
    ) => {
      await updateDestinationMarker(latitude, longitude);
      onChange({ latitude, longitude, label, source, accuracyMeters });
    },
    [onChange, updateDestinationMarker]
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!showMap || !mapRef.current || leafletMapRef.current) return;

      const leaflet = await import("leaflet");
      if (!mounted || !mapRef.current) return;

      const storeIcon = leaflet.divIcon({
        className: "vendeplus-store-marker",
        html: '<div class="vp-map-pin vp-map-pin-store"><span>Retiro aqui</span></div>',
        iconSize: [104, 42],
        iconAnchor: [52, 42],
      });

      const map = leaflet.map(mapRef.current, {
        center: [storeLatitude, storeLongitude],
        zoom: 14,
        zoomControl: true,
      });

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(map);

      if (mode !== "store") {
        leaflet
          .marker([storeLatitude, storeLongitude], { icon: storeIcon })
          .addTo(map)
          .bindPopup(`Punto de retiro: ${storeName}`);
      }

      map.on("click", (event) => {
        void selectDestination(
          event.latlng.lat,
          event.latlng.lng,
          mode === "store" ? "Ubicacion del negocio" : "Punto elegido en el mapa",
          "map"
        );
        setMessageType("success");
        setMessage(
          mode === "store"
            ? "Ubicacion del negocio seleccionada. Puedes moverla tocando otra zona del mapa."
            : "Punto seleccionado correctamente. Puedes moverlo tocando otra zona del mapa."
        );
      });

      leafletMapRef.current = map;
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
  }, [mode, selectDestination, showMap, storeLatitude, storeLongitude, storeName]);

  useEffect(() => {
    if (!value || !showMap || !isReady) return;

    void updateDestinationMarker(value.latitude, value.longitude);
  }, [isReady, showMap, updateDestinationMarker, value]);

  async function useCurrentLocation() {
    setMessage("");

    if (!navigator.geolocation) {
      setMessageType("error");
      setMessage(
        "Este navegador no permite tomar ubicacion actual. Carga el mapa o escribe una referencia clara."
      );
      return;
    }

    try {
      if (navigator.permissions?.query) {
        const permission = await navigator.permissions.query({
          name: "geolocation" as PermissionName,
        });
        if (permission.state === "denied") {
          setMessageType("error");
          setMessage(
            "La ubicacion esta bloqueada en el navegador. Puedes activarla o cargar el mapa para elegir el punto."
          );
          return;
        }
      }
    } catch {
      // Some browsers cannot query permissions. Trying geolocation is still safe.
    }

    setIsLocating(true);
    setMessageType("info");
    setMessage("Buscando tu ubicacion actual...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setIsLocating(false);
        await selectDestination(
          position.coords.latitude,
          position.coords.longitude,
          mode === "store" ? "Ubicacion actual del negocio" : "Ubicacion actual confirmada",
          "current",
          position.coords.accuracy
        );
        setMessageType("success");
        setMessage(
          `${mode === "store" ? "Ubicacion del negocio tomada" : "Ubicacion tomada"} correctamente. Precision aproximada: ${Math.round(
            position.coords.accuracy || 0
          )} metros.`
        );
      },
      (error) => {
        setIsLocating(false);
        setMessageType("error");
        if (error.code === error.PERMISSION_DENIED) {
          setMessage(
            "Permiso rechazado. Activalo desde el navegador o carga el mapa para elegir el punto."
          );
        } else if (error.code === error.TIMEOUT) {
          setMessage(
            "La ubicacion tardo demasiado. Puedes intentar otra vez o cargar el mapa."
          );
        } else {
          setMessage(
            "No pudimos tomar la ubicacion actual. Carga el mapa o escribe una referencia clara."
          );
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 }
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={useCurrentLocation}
          className="vp-button-primary w-full"
        >
          <LocateFixed size={18} />{" "}
          {isLocating
            ? "Buscando..."
            : mode === "store"
              ? "Usar ubicacion del negocio"
              : "Usar ubicacion actual"}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowMap(true);
            if (!leafletMapRef.current) {
              setIsReady(false);
            }
          }}
          className="vp-button-soft w-full"
        >
          <MapPin size={18} /> {showMap ? "Toca el mapa" : "Elegir en mapa"}
        </button>
      </div>

      {showMap ? (
        <div className="overflow-hidden rounded-[28px] border border-[#25262B]/10 bg-white shadow-sm">
          <div ref={mapRef} className="h-[340px] w-full" />
        </div>
      ) : (
        <div className="rounded-[28px] border border-[#25262B]/10 bg-white p-4 text-sm font-bold leading-relaxed text-[#746f69] shadow-sm">
          Para conexiones lentas, primero intenta con GPS. Si no queda bien,
          carga el mapa y toca el punto exacto.
        </div>
      )}

      {showMap && !isReady ? (
        <p className="rounded-2xl bg-white p-3 text-xs font-black text-[#746f69]">
          Cargando mapa...
        </p>
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
          {messageType === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{message}</span>
        </div>
      ) : null}

      {value ? (
        <div className="rounded-2xl bg-white p-3 text-xs font-black text-[#746f69] ring-1 ring-[#25262B]/[0.07]">
          Coordenadas seleccionadas: {value.latitude.toFixed(6)},{" "}
          {value.longitude.toFixed(6)}
        </div>
      ) : null}
    </div>
  );
}
