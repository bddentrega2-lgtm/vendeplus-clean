import Link from "next/link";
import { ArrowRight, Boxes, ClipboardList, DollarSign, Store } from "lucide-react";
import { PanelShell } from "@/components/panel/PanelShell";
import { getPanelStats } from "@/lib/supabase/panel";
import { formatUsd } from "@/lib/currency";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelPage() {
  const stats = await getPanelStats();

  const cards = [
    {
      label: "Ventas hoy",
      value: formatUsd(stats.todayRevenue),
      detail: `${stats.todayOrders.length} pedidos hoy`,
      icon: DollarSign,
    },
    {
      label: "Pedidos registrados",
      value: String(stats.orders.length),
      detail: "Base lista para operación",
      icon: ClipboardList,
    },
    {
      label: "Productos activos",
      value: String(stats.activeProducts.length),
      detail: `${stats.inactiveProducts.length} inactivos`,
      icon: Boxes,
    },
    {
      label: "Comercios",
      value: String(stats.stores.length),
      detail: "Aliados conectados",
      icon: Store,
    },
  ];

  return (
    <PanelShell
      active="/panel"
      title="Dashboard"
      subtitle="Centro de control comercial para monitorear tiendas, productos, pedidos y rendimiento."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-[#746f69]">
                    {card.label}
                  </p>
                  <p className="mt-3 text-3xl font-black text-[#25262B]">
                    {card.value}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#746f69]">
                    {card.detail}
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-3xl bg-[#FFB547]/20 text-[#2E3A79]">
                  <Icon size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Últimos pedidos</h2>
              <p className="text-sm font-bold text-[#746f69]">
                Cuando activemos guardado de pedidos, esta sección será el centro operativo.
              </p>
            </div>
            <Link href="/panel/pedidos" className="rounded-full bg-[#2E3A79] px-4 py-2 text-sm font-black text-white">
              Ver todos
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {stats.orders.length === 0 ? (
              <div className="rounded-3xl bg-[#F8F3E8] p-5 text-sm font-bold text-[#746f69]">
                Todavía no hay pedidos guardados en Supabase. El siguiente paso será guardar cada pedido además de enviarlo a WhatsApp.
              </div>
            ) : (
              stats.orders.slice(0, 5).map((order: any) => (
                <div key={order.id} className="flex items-center justify-between rounded-3xl border border-[#25262B]/10 p-4">
                  <div>
                    <p className="font-black">{order.public_code}</p>
                    <p className="text-sm font-bold text-[#746f69]">
                      {order.customer_name} · {order.delivery_type}
                    </p>
                  </div>
                  <p className="font-black">{formatUsd(Number(order.total_usd || 0))}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[34px] bg-[#25262B] p-5 text-white shadow-xl shadow-[#25262B]/20">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
            Próxima victoria
          </p>
          <h2 className="mt-3 text-3xl font-black">Guardar pedidos reales</h2>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-white/70">
            Ahora el catálogo lee Supabase. El siguiente salto será que cada checkout cree un registro real en la tabla orders y order_items.
          </p>
          <Link
            href="/panel/estadisticas"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
          >
            Ver estadísticas
            <ArrowRight size={17} />
          </Link>
        </section>
      </div>
    </PanelShell>
  );
}
