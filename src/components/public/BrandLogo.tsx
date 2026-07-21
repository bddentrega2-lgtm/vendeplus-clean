export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-[#2E3A79]/15 ring-1 ring-[#25262B]/10">
        <img
          src="/brand/somos-isotipo.png"
          alt=""
          className="h-9 w-9 object-contain"
          loading="eager"
        />
      </div>
      {!compact ? (
        <div className="leading-none">
          <p className="text-2xl font-black tracking-tight text-[#2E3A79]">Somos</p>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#746f69]">
            Comunidad. Comercio. Conexion.
          </p>
        </div>
      ) : null}
    </div>
  );
}
