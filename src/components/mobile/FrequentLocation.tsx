"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MapPin, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type { DeliveryLocation } from "@/types";
import { clearFrequentLocation, readFrequentLocation, saveFrequentLocation, type FrequentLocation as SavedLocation } from "@/lib/mobile/frequent-location";

const LocationPicker = dynamic(() => import("@/components/public/LocationPicker").then(mod => mod.LocationPicker), { ssr: false });

export function FrequentLocation({ onUse }: { onUse?: (value: SavedLocation) => void }) {
  const [saved, setSaved] = useState<SavedLocation | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("Casa");
  const [reference, setReference] = useState("");
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const sync = () => setSaved(readFrequentLocation());
    sync();
    window.addEventListener("somos:frequent-location", sync);
    return () => window.removeEventListener("somos:frequent-location", sync);
  }, []);

  if (onUse) return saved ? <div className="frequent-location"><button type="button" onClick={() => onUse(saved)}><MapPin size={16} />Usar {saved.name}</button></div> : null;

  function edit() {
    setName(saved?.name || "Casa");
    setReference(saved?.reference || "");
    setLocation(saved?.location || null);
    setMessage("");
    setEditing(true);
  }

  return <section className="frequent-location" aria-label="Ubicacion frecuente">
    <h3><MapPin size={17} />Ubicacion frecuente</h3>
    {!editing ? <>
      {saved ? <div className="frequent-location-saved"><div><strong>{saved.name}</strong>{saved.reference ? <p>{saved.reference}</p> : null}</div><button type="button" title="Editar ubicacion guardada" aria-label="Editar ubicacion guardada" onClick={edit}><Pencil size={18} /></button><button type="button" title="Eliminar ubicacion guardada" aria-label="Eliminar ubicacion guardada" onClick={() => setMessage(clearFrequentLocation() ? "Ubicacion eliminada." : "No pudimos eliminarla.")}><Trash2 size={18} /></button></div> : <button type="button" onClick={edit}><Plus size={18} />Agregar ubicacion</button>}
    </> : <form className="frequent-location-save" onSubmit={event => {
      event.preventDefault();
      const success = saveFrequentLocation({ name, reference, location });
      setMessage(success ? "Ubicacion guardada en este dispositivo." : "Completa el nombre y el punto en el mapa.");
      if (success) setEditing(false);
    }}>
      <label>Nombre de la ubicacion<input value={name} onChange={event => setName(event.target.value)} maxLength={40} required placeholder="Casa o trabajo" /></label>
      <label>Referencia (opcional)<textarea value={reference} onChange={event => setReference(event.target.value)} maxLength={500} rows={2} /></label>
      <LocationPicker storeLatitude={saved?.location.latitude ?? 8} storeLongitude={saved?.location.longitude ?? -66} value={location} onChange={setLocation} mode="saved" pointName="Mi ubicacion" />
      <div className="frequent-location-editor-actions"><button type="submit"><Save size={16} />Guardar ubicacion</button><button type="button" onClick={() => { setEditing(false); setMessage(""); }}><X size={16} />Cancelar</button></div>
    </form>}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
