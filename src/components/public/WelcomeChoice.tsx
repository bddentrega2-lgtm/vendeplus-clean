"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, ShoppingBag, Store } from "lucide-react";
import { BrandLogo } from "@/components/public/BrandLogo";

const WELCOME_CHOICE_KEY = "somos-welcome-choice-v1";
type WelcomeState = "checking" | "visible" | "hidden";

export function WelcomeChoice() {
  const [welcomeState, setWelcomeState] = useState<WelcomeState>("checking");
  const dialogRef = useRef<HTMLElement>(null);
  const firstChoiceRef = useRef<HTMLAnchorElement>(null);

  useLayoutEffect(() => {
    try {
      setWelcomeState(localStorage.getItem(WELCOME_CHOICE_KEY) ? "hidden" : "visible");
    } catch {
      setWelcomeState("visible");
    }
  }, []);

  useEffect(() => {
    if (welcomeState !== "visible") return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const backgroundElements = dialog?.parentElement
      ? Array.from(dialog.parentElement.children).filter((element) => element !== dialog)
      : [];

    document.body.style.overflow = "hidden";
    backgroundElements.forEach((element) => element.setAttribute("inert", ""));
    firstChoiceRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setWelcomeState("hidden");
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      );
      if (!focusableElements.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach((element) => element.removeAttribute("inert"));
      previouslyFocused?.focus();
    };
  }, [welcomeState]);

  function rememberChoice(choice: "buyer" | "business") {
    try { localStorage.setItem(WELCOME_CHOICE_KEY, choice); } catch {}
    setWelcomeState("hidden");
  }

  if (welcomeState === "hidden") return null;

  if (welcomeState === "checking") {
    return <div aria-hidden="true" className="fixed inset-0 z-[100] bg-[#F7F5F0]" />;
  }

  return <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-description" className="fixed inset-0 z-[100] overflow-y-auto bg-[#F7F5F0] text-[#143D42]">
    <div className="relative flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
      <div className="absolute -left-24 -top-20 h-72 w-72 rounded-full bg-[#FF7133]/15 blur-3xl" />
      <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-[#0F6B63]/15 blur-3xl" />
      <div className="relative w-full max-w-3xl">
        <div className="flex justify-center"><BrandLogo priority /></div>
        <div className="mt-7 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FF7133]">Bienvenido a Somos</p>
          <h1 id="welcome-title" className="mx-auto mt-3 max-w-xl text-3xl font-black leading-tight tracking-[-0.03em] sm:text-5xl">¿Qué quieres hacer hoy?</h1>
          <p id="welcome-description" className="mx-auto mt-3 max-w-lg text-sm font-semibold leading-6 text-[#55706E] sm:text-base">Elige una opción para llevarte directamente a lo que necesitas.</p>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 sm:gap-4">
          <Link ref={firstChoiceRef} href="/marketplace" onClick={() => rememberChoice("buyer")} className="group rounded-[26px] bg-[#143D42] p-5 text-white shadow-xl shadow-[#143D42]/15 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#FFB04A] sm:p-7">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFB04A] text-[#143D42]"><ShoppingBag size={23} /></span>
            <h2 className="mt-5 text-2xl font-black">Quiero comprar</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/70">Descubrir comercios, productos, ofertas y hacer un pedido.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#FFB04A]">Ir al Marketplace <ArrowRight size={17} className="transition group-hover:translate-x-1" /></span>
          </Link>
          <button type="button" onClick={() => rememberChoice("business")} className="group rounded-[26px] bg-white p-5 text-left shadow-xl shadow-[#143D42]/[0.08] ring-1 ring-[#143D42]/10 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#FF7133] sm:p-7">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FF7133] text-white"><Store size={23} /></span>
            <h2 className="mt-5 text-2xl font-black">Quiero vender con Somos</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#55706E]">Conocer las soluciones para comercios y empresas delivery.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#FF7133]">Conocer Somos <ArrowRight size={17} className="transition group-hover:translate-x-1" /></span>
          </button>
        </div>
        <div className="mt-5 flex flex-col items-center gap-2 text-center text-[11px] font-semibold text-[#746F69]">
          <p>Esta pregunta se muestra una sola vez en este dispositivo.</p>
          <button type="button" onClick={() => setWelcomeState("hidden")} className="rounded-full px-3 py-2 font-bold underline decoration-[#746F69]/40 underline-offset-4 hover:text-[#143D42] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#143D42]">
            Ahora no, ver inicio
          </button>
        </div>
      </div>
    </div>
  </section>;
}
