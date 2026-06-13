"use client";

import { Loader2 } from "lucide-react";

export function PanelAccessGate() {
  return (
    <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
      <Loader2 size={22} className="mx-auto animate-spin text-[#2E3A79]" />
      <p className="mt-3 text-sm font-black text-[#746f69]">
        Preparando tu panel...
      </p>
    </section>
  );
}

export function PanelModuleSkeleton({
  label = "Cargando información...",
}: {
  label?: string;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-[#2E3A79]" />
          <p className="text-sm font-black text-[#746f69]">{label}</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="h-20 animate-pulse rounded-3xl bg-[#F8F3E8]" />
          <div className="h-20 animate-pulse rounded-3xl bg-[#F8F3E8]" />
          <div className="h-20 animate-pulse rounded-3xl bg-[#F8F3E8]" />
        </div>
      </div>
      <div className="grid gap-3">
        <div className="h-24 animate-pulse rounded-[30px] bg-white shadow-xl shadow-[#2E3A79]/[0.05]" />
        <div className="h-24 animate-pulse rounded-[30px] bg-white shadow-xl shadow-[#2E3A79]/[0.05]" />
      </div>
    </section>
  );
}
