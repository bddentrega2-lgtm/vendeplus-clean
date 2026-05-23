"use client";

import type { Category } from "@/types";

export function CategoryTabs({
  categories,
  selectedCategoryId,
  onSelect,
}: {
  categories: Category[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
}) {
  const all = [{ id: "all", name: "Todo", slug: "todo" }, ...categories];

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-5 bg-[#FFF8F0]/90 px-4 py-3 backdrop-blur-xl">
      <div className="vp-scrollbar-none flex gap-2 overflow-x-auto pb-1">
        {all.map((category) => {
          const active = selectedCategoryId === category.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              className={active
                ? "shrink-0 rounded-full bg-[#2E3A79] px-4 py-2 text-sm font-black text-white shadow-lg shadow-[#2E3A79]/15"
                : "shrink-0 rounded-full border border-[#25262B]/10 bg-white/80 px-4 py-2 text-sm font-extrabold text-[#746f69]"
              }
            >
              {category.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
