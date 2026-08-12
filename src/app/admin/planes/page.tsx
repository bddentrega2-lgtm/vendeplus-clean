import { AdminShell } from "@/components/admin/AdminShell";
import { plans } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminPlansPage() {
  return (
    <AdminShell
      active="/admin/planes"
      title="Planes"
      subtitle="Configuracion V1 de planes comerciales. La edicion avanzada desde base de datos queda para V2."
    >
      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className="rounded-[30px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]"
          >
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#746f69]">
              {plan.id}
            </p>
            <h2 className="mt-2 text-2xl font-black">{plan.name}</h2>
            <p className="mt-3 text-4xl font-black">
              ${plan.priceUsd}
              <span className="text-sm font-bold text-[#746f69]"> {plan.billingLabel}</span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-[#F8F3E8] p-3">
                <p className="text-xl font-black">{plan.storeLimit}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#746f69]">Comercios</p>
              </div>
              <div className="rounded-2xl bg-[#F8F3E8] p-3">
                <p className="text-xl font-black">{plan.productLimit}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#746f69]">Productos</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm font-bold text-[#746f69]">
              {plan.features.map((feature) => (
                <li key={feature}>- {feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
