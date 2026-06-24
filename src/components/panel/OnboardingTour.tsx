"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

const storageKey = "vendeplus_panel_tour_seen";

const steps = [
  "Publica productos, precios, fotos, tallas y extras desde Productos y Opciones.",
  "Configura delivery, zonas, rangos y delivery gratis en el módulo Delivery.",
  "Cada pedido llega al panel y también puede abrir WhatsApp con el resumen listo.",
];

export function OnboardingTour() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(storageKey) !== "true") {
      setVisible(true);
    }
  }, []);

  function closeTour() {
    window.localStorage.setItem(storageKey, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section className="fixed bottom-4 left-4 right-4 z-[80] rounded-[28px] bg-[#25262B] p-4 text-white shadow-2xl shadow-[#25262B]/30 ring-1 ring-white/10 sm:left-auto sm:w-[420px]">
      <button
        type="button"
        onClick={closeTour}
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/10"
        aria-label="Cerrar tour"
      >
        <X size={16} />
      </button>
      <p className="pr-8 text-xs font-black uppercase tracking-[0.18em] text-[#FFB547]">
        Primeros pasos
      </p>
      <h2 className="mt-2 text-xl font-black">Bienvenido a Vende+ Panel</h2>
      <div className="mt-3 space-y-2">
        {steps.map((step, index) => (
          <div key={step} className="flex gap-3 rounded-2xl bg-white/10 p-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#FFB547] text-xs font-black text-[#25262B]">
              {index + 1}
            </span>
            <p className="text-sm font-bold leading-relaxed text-white/75">{step}</p>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={closeTour}
        className="mt-3 w-full rounded-full bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B]"
      >
        Entendido
      </button>
    </section>
  );
}
