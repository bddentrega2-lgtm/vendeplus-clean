"use client";

import { RefreshCw } from "lucide-react";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-[70vh] place-items-center bg-[#F4F8F6] px-5 text-[#143D42]">
    <section className="w-full max-w-md border-l-4 border-[#FF7133] bg-white p-6 shadow-sm">
      <h1 className="text-xl font-black">No pudimos abrir esta pantalla</h1>
      <p className="mt-2 text-sm font-semibold text-[#55706E]">Tu informacion sigue segura. Revisa tu conexion e intenta nuevamente.</p>
      <button type="button" onClick={reset} className="mt-5 inline-flex min-h-11 items-center gap-2 bg-[#143D42] px-5 py-3 text-sm font-black text-white"><RefreshCw size={18} />Reintentar</button>
    </section>
  </main>;
}
