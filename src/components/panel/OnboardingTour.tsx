"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";

const storageKey = "vendeplus_panel_tour_seen";

const steps = [
  {
    title: "Configura tu negocio",
    detail:
      "Revisa nombre, WhatsApp, direccion, colores, pagos y horarios antes de compartir el catalogo.",
    href: "/panel/configuracion",
    action: "Ir a configuracion",
  },
  {
    title: "Carga tus productos",
    detail:
      "Agrega fotos, precios, variantes y extras. Mantén activos solo los productos disponibles.",
    href: "/panel/productos",
    action: "Ir a productos",
  },
  {
    title: "Activa delivery y pagos",
    detail:
      "Define retiro, zonas, km o cotizacion por WhatsApp para que el checkout sea claro.",
    href: "/panel/delivery",
    action: "Ir a delivery",
  },
  {
    title: "Comparte tu link",
    detail:
      "Desde Inicio o Catalogo copia el mensaje de bienvenida y usalo en WhatsApp o Instagram.",
    href: "/panel/inicio",
    action: "Copiar desde Inicio",
  },
];

export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

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

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <section className="fixed bottom-4 left-4 right-4 z-[80] rounded-[28px] bg-[#25262B] p-4 text-white shadow-2xl shadow-[#25262B]/30 ring-1 ring-white/10 sm:left-auto sm:w-[420px]">
      <button
        type="button"
        onClick={closeTour}
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/10"
        aria-label="Cerrar tutorial"
      >
        <X size={16} />
      </button>

      <p className="pr-8 text-xs font-black uppercase tracking-[0.18em] text-[#FFB547]">
        Tutorial guiado · {stepIndex + 1} de {steps.length}
      </p>
      <h2 className="mt-2 text-xl font-black">{currentStep.title}</h2>
      <p className="mt-2 text-sm font-bold leading-relaxed text-white/75">
        {currentStep.detail}
      </p>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {steps.map((step, index) => (
          <button
            key={step.title}
            type="button"
            onClick={() => setStepIndex(index)}
            className={[
              "h-2 rounded-full",
              index <= stepIndex ? "bg-[#FFB547]" : "bg-white/15",
            ].join(" ")}
            aria-label={`Ir al paso ${index + 1}`}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <Link
          href={currentStep.href}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm font-black text-white"
        >
          {currentStep.action}
          <ArrowRight size={16} />
        </Link>
        <button
          type="button"
          onClick={() => {
            if (isLastStep) {
              closeTour();
              return;
            }
            setStepIndex((current) => current + 1);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B]"
        >
          {isLastStep ? (
            <>
              <CheckCircle2 size={16} />
              Listo
            </>
          ) : (
            "Siguiente"
          )}
        </button>
      </div>
    </section>
  );
}
