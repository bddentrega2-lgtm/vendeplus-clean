export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-[#2E3A79] text-white shadow-lg shadow-[#2E3A79]/20">
        <span className="text-xl font-black">V</span>
        <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#FFB547] text-sm font-black text-[#25262B]">+</span>
      </div>
      {!compact ? (
        <div className="leading-none">
          <p className="text-2xl font-black tracking-tight text-[#2E3A79]">Vende<span className="text-[#FFB547]">+</span></p>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#746f69]">Catálogo inteligente</p>
        </div>
      ) : null}
    </div>
  );
}
