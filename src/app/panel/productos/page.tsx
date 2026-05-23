import { PanelShell } from "@/components/panel/PanelShell";
import { getPanelProducts } from "@/lib/supabase/panel";
import { formatUsd } from "@/lib/currency";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelProductsPage() {
  const products = await getPanelProducts();

  return (
    <PanelShell
      active="/panel/productos"
      title="Productos"
      subtitle="Catálogo comercial conectado a Supabase. Aquí vivirán precios, disponibilidad, imágenes y categorías."
    >
      <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-black">Productos cargados</h2>
            <p className="text-sm font-bold text-[#746f69]">
              {products.length} productos disponibles en la base.
            </p>
          </div>
          <button className="rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]">
            + Nuevo producto
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-[28px] border border-[#25262B]/10">
          <div className="hidden grid-cols-[1.4fr_1fr_0.7fr_0.7fr] bg-[#F8F3E8] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#746f69] md:grid">
            <span>Producto</span>
            <span>Comercio</span>
            <span>Precio</span>
            <span>Estado</span>
          </div>

          <div className="divide-y divide-[#25262B]/10">
            {products.map((product) => (
              <div key={product.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1.4fr_1fr_0.7fr_0.7fr] md:items-center">
                <div className="flex items-center gap-3">
                  <img
                    src={product.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop"}
                    alt={product.name}
                    className="h-14 w-14 rounded-2xl object-cover"
                  />
                  <div>
                    <p className="font-black">{product.name}</p>
                    <p className="text-xs font-bold text-[#746f69]">
                      {product.category_name || "Sin categoría"}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-black text-[#746f69]">{product.store_name}</p>
                <p className="font-black">{formatUsd(product.price_usd)}</p>
                <span className={[
                  "w-fit rounded-full px-3 py-2 text-xs font-black",
                  product.is_available
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                ].join(" ")}>
                  {product.is_available ? "Activo" : "Inactivo"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PanelShell>
  );
}
