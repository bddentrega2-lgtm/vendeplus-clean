"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Check, MapPin, Navigation, X } from "lucide-react";
import { BrandLogo } from "@/components/public/BrandLogo";

export function MarketplaceCityPicker({ cities, activeCity, required, loading, message, onLocate, onSelect, onClose }: {
  cities: Array<[string, string]>; activeCity: string; required: boolean; loading: boolean; message?: string;
  onLocate: () => void; onSelect: (city: string) => void; onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () => [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') || [])];
    panel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); if (!required) close.current(); }
      if (event.key === "Tab") {
        const items = controls(), first = items[0], last = items.at(-1);
        if (!items.includes(document.activeElement as HTMLElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault(); (event.shiftKey ? last : first)?.focus();
        }
      }
    };
    const focus = (event: FocusEvent) => { if (!panel.current?.contains(event.target as Node)) panel.current?.focus(); };
    document.addEventListener("keydown", keydown);
    document.addEventListener("focusin", focus);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", focus);
      if (previous?.isConnected) previous.focus();
    };
  }, [required]);

  return <div className="market-city-overlay" data-required={required} onMouseDown={event => {
    if (!required && event.target === event.currentTarget) onClose();
  }}>
    <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="city-picker-title" className="market-city-picker">
      <header><BrandLogo size="sm" priority />{!required ? <button type="button" className="market-city-close" onClick={onClose} aria-label="Cerrar" title="Cerrar"><X size={20} /></button> : null}</header>
      <h2 id="city-picker-title">Elige tu ciudad</h2>
      <button type="button" className="market-city-locate" disabled={loading} onClick={onLocate}><Navigation size={21} /><span>{loading ? "Buscando tu ciudad..." : "Usar mi ubicacion"}</span></button>
      {message ? <p role="status" className="market-city-message">{message}</p> : null}
      <div className="market-city-choices">{cities.map(([slug, name]) => <button key={slug} type="button" onClick={() => onSelect(slug)} aria-pressed={activeCity === slug}>
        <MapPin size={18} /><span>{name}</span>{activeCity === slug ? <Check size={18} /> : <ArrowRight size={18} />}
      </button>)}</div>
      {!required ? <button type="button" className="market-city-all" onClick={() => onSelect("Todas")}>Todas las ciudades</button> : <Link className="market-city-business" href="/panel/login">Ingresar a mi negocio</Link>}
    </section>
  </div>;
}
