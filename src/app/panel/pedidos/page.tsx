import { PanelShell } from "@/components/panel/PanelShell";
import { getPanelOrders } from "@/lib/supabase/panel";
import { formatUsd } from "@/lib/currency";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelOrdersPage() {
  const orders = await getPanelOrders();

  return (
    <PanelShell
      active="/panel/pedidos"
      title="Pedidos"
      subtitle="Bandeja operativa para revisar pedidos recibidos, estado, cliente, modalidad y total."
    >
      <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <h2 className="text-2xl font-black">Pedidos recientes</h2>
        <p className="mt-1 text-sm font-bold text-[#746f69]">
          Esta vista quedará viva cuando conectemos el checkout con la tabla orders.
        </p>

        <div className="mt-5 space-y-3">
          {orders.length === 0 ? (
            <div className="rounded-3xl bg-[#F8F3E8] p-6 text-sm font-bold leading-relaxed text-[#746f69]">
              Aún no hay pedidos guardados. Actualmente el pedido sale por WhatsApp. La próxima fase guardará una copia estructurada en Supabase.
            </div>
          ) : (
            orders.map((order: any) => (
              <div key={order.id} className="rounded-3xl border border-[#25262B]/10 p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <p className="text-lg font-black">{order.public_code}</p>
                    <p className="text-sm font-bold text-[#746f69]">
                      {order.customer_name} · {order.customer_phone}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="font-black">{formatUsd(Number(order.total_usd || 0))}</p>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#746f69]">
                      {order.status}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </PanelShell>
  );
}
