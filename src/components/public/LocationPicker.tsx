"use client";

import { AlertCircle, CheckCircle2, LocateFixed, MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DeliveryLocation } from "@/types";
import type { Map as LeafletMap, Marker } from "leaflet";

type Props = {
  storeLatitude: number;
  storeLongitude: number;
  value: DeliveryLocation | null;
  onChange: (location: DeliveryLocation) => void;
};

export function LocationPicker({ storeLatitude, storeLongitude, value, onChange }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const destinationMarkerRef = useRef<Marker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");

  const placeDestinationMarker = useCallback(async (latitude: number, longitude: number, label: string, source: DeliveryLocation["source"], accuracyMeters?: number) => {
    const leaflet = await import("leaflet");
    const latLng: [number, number] = [latitude, longitude];
    const icon = leaflet.divIcon({
      className: "vendeplus-destination-marker",
      html: "<div>📍</div>",
      iconSize: [38, 38],
      iconAnchor: [19, 38],
    });

    if (leafletMapRef.current) {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setLatLng(latLng);
      } else {
        destinationMarkerRef.current = leaflet.marker(latLng, { icon }).addTo(leafletMapRef.current);
      }
      leafletMapRef.current.setView(latLng, 16);
    }

    onChange({ latitude, longitude, label, source, accuracyMeters });
  }, [onChange]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!mapRef.current || leafletMapRef.current) return;
      const leaflet = await import("leaflet");
      if (!mounted || !mapRef.current) return;

      const storeIcon = leaflet.divIcon({
        className: "vendeplus-store-marker",
        html: "<div>🏪</div>",
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });
      const destinationIcon = leaflet.divIcon({
        className: "vendeplus-destination-marker",
        html: "<div>📍</div>",
        iconSize: [38, 38],
        iconAnchor: [19, 38],
      });

      const map = leaflet.map(mapRef.current, {
        center: [storeLatitude, storeLongitude],
        zoom: 14,
        zoomControl: true,
      });

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(map);

      leaflet.marker([storeLatitude, storeLongitude], { icon: storeIcon }).addTo(map).bindPopup("Punto de retiro del comercio");

      map.on("click", (event) => {
        if (destinationMarkerRef.current) {
          destinationMarkerRef.current.setLatLng(event.latlng);
        } else {
          destinationMarkerRef.current = leaflet.marker(event.latlng, { icon: destinationIcon }).addTo(map);
        }

        onChange({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
          label: "Punto elegido en el mapa",
          source: "map",
        });
        setMessageType("success");
        setMessage("Punto seleccionado correctamente. Puedes moverlo tocando otra zona del mapa.");
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
      }
    };
  }, [onChange, storeLatitude, storeLongitude]);

  useEffect(() => {
    if (!value) return;
    placeDestinationMarker(value.latitude, value.longitude, value.label, value.source, value.accuracyMeters);
  }, [placeDestinationMarker, value?.latitude, value?.longitude]);

  async function useCurrentLocation() {
    setMessage("");

    if (!navigator.geolocation) {
      setMessageType("error");
      setMessage("Este navegador no permite tomar ubicación actual. Toca el mapa para elegir el punto de entrega.");
      return;
    }

    try {
      if (navigator.permissions?.query) {
        const permission = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        if (permission.state === "denied") {
          setMessageType("error");
          setMessage("La ubicación está bloqueada en el navegador. Puedes activarla en el candado de la barra o elegir el punto tocando el mapa.");
          return;
        }
      }
    } catch {
      // Algunos navegadores no soportan consultar permisos. Igual intentamos obtener la ubicación.
    }

    setIsLocating(true);
    setMessageType("info");
    setMessage("Buscando tu ubicación actual...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setIsLocating(false);
        await placeDestinationMarker(
          position.coords.latitude,
          position.coords.longitude,
          "Ubicación actual confirmada",
          "current",
          position.coords.accuracy,
        );
        setMessageType("success");
        setMessage(`Ubicación tomada correctamente. Precisión aproximada: ${Math.round(position.coords.accuracy || 0)} metros.`);
      },
      (error) => {
        setIsLocating(false);
        setMessageType("error");
        if (error.code === error.PERMISSION_DENIED) {
          setMessage("Permiso rechazado. Actívalo desde el candado de Chrome o elige el punto tocando el mapa.");
        } else if (error.code === error.TIMEOUT) {
          setMessage("La ubicación tardó demasiado. Puedes intentar otra vez o elegir el punto en el mapa.");
        } else {
          setMessage("No pudimos tomar la ubicación actual. Elige el punto tocando el mapa.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={useCurrentLocation} className="vp-button-primary w-full">
          <LocateFixed size={18} /> {isLocating ? "Buscando..." : "Usar ubicación actual"}
        </button>
        <div className="vp-button-soft w-full text-center">
          <MapPin size={18} /> Toca el mapa para elegir
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-[#25262B]/10 bg-white shadow-sm">
        <div ref={mapRef} className="h-[340px] w-full" />
      </div>

      {!isReady ? <p className="rounded-2xl bg-white p-3 text-xs font-black text-[#746f69]">Cargando mapa...</p> : null}

      {message ? (
        <div className={
          messageType === "success"
            ? "flex gap-2 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-700"
            : messageType === "error"
              ? "flex gap-2 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700"
              : "flex gap-2 rounded-2xl bg-[#FFF8F0] p-3 text-sm font-bold text-[#746f69]"
        }>
          {messageType === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message}</span>
        </div>
      ) : null}

      {value ? (
        <div className="rounded-2xl bg-white p-3 text-xs font-black text-[#746f69] ring-1 ring-[#25262B]/[0.07]">
          Coordenadas seleccionadas: {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
        </div>
      ) : null}
    </div>
  );
}
