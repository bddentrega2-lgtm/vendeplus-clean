import { PanelShell } from "@/components/panel/PanelShell";
import { getPanelStats } from "@/lib/supabase/panel";
import { formatUsd } from "@/lib/currency";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelStatsPage() {
  const stats = await getPanelStats();

  const metrics = [
    ["Ventas hoy", formatUsd(stats.todayRevenue)],
    ["Ventas históricas", formatUsd(stats.totalRevenue)],
    ["Ticket promedio", formatUsd(stats.averageTicket)],
    ["Pedidos registrados", String(stats.orders.length)],
    ["Productos activos", String(stats.activeProducts.length)],
    ["Productos destacados", String(stats.featuredProducts.length)],
  ];

  const topProducts = [...stats.products]
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured))
    .slice(0, 5);

  return (
    <PanelShell
      active="/panel/estadisticas"
      title="Estadísticas"
      subtitle="Ventas por día, semana, mes, productos más pedidos, clientes, ticket promedio y comportamiento comercial."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
            <p className="text-sm font-black text-[#746f69]">{label}</p>
            <p className="mt-3 text-3xl font-black">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <h2 className="text-2xl font-black">Productos estratégicos</h2>
          <p className="text-sm font-bold text-[#746f69]">
            Base inicial hasta conectar ventas reales por producto.
          </p>

          <div className="mt-5 space-y-3">
            {topProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between rounded-3xl bg-[#F8F3E8] p-4">
                <div>
                  <p className="font-black">{product.name}</p>
                  <p className="text-xs font-bold text-[#746f69]">{product.store_name}</p>
                </div>
                <p className="font-black">{formatUsd(product.price_usd)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[34px] bg-[#2E3A79] p-5 text-white shadow-xl shadow-[#2E3A79]/20">
          <h2 className="text-2xl font-black">Próxima capa de inteligencia</h2>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-white/75">
            Al guardar pedidos, esta pantalla calculará ventas por día, semana y mes; productos más pedidos; clientes frecuentes; métodos de pago; delivery vs pickup; zonas y distancias.
          </p>
        </section>
      </div>
    </PanelShell>
  );
}
