"use client";

import { Minus, Plus } from "lucide-react";

export function QuantityControl({
  value,
  onChange,
  min = 1,
}: {
  value: number;
  onChange: (nextValue: number) => void;
  min?: number;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-[#25262B]/10 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid h-9 w-9 place-items-center rounded-full bg-[#FFF8F0] text-[#25262B]"
        aria-label="Disminuir cantidad"
      >
        <Minus size={16} />
      </button>
      <span className="grid min-w-10 place-items-center px-2 text-sm font-black text-[#25262B]">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="grid h-9 w-9 place-items-center rounded-full bg-[#FFB547] text-[#25262B]"
        aria-label="Aumentar cantidad"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
