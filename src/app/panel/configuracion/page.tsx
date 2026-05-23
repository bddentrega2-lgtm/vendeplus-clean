import { PanelShell } from "@/components/panel/PanelShell";
import { getPanelStores } from "@/lib/supabase/panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelSettingsPage() {
  const stores = await getPanelStores();

  return (
    <PanelShell
      active="/panel/configuracion"
      title="Configuración"
      subtitle="Datos operativos de cada comercio: WhatsApp, dirección, coordenadas, delivery y pickup."
    >
      <div className="grid gap-5 lg:grid-cols-3">
        {stores.map((store) => (
          <section key={store.id} className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
            <h2 className="text-2xl font-black">{store.name}</h2>
            <p className="mt-2 text-sm font-bold text-[#746f69]">{store.address}</p>

            <div className="mt-5 space-y-3 text-sm font-bold">
              <div className="rounded-3xl bg-[#F8F3E8] p-4">
                WhatsApp: {store.whatsapp || "No configurado"}
              </div>
              <div className="rounded-3xl bg-[#F8F3E8] p-4">
                Coordenadas: {store.latitude}, {store.longitude}
              </div>
              <div className="flex gap-2">
                <span className="rounded-full bg-green-100 px-3 py-2 text-xs font-black text-green-700">
                  {store.accepts_delivery ? "Delivery activo" : "Sin delivery"}
                </span>
                <span className="rounded-full bg-blue-100 px-3 py-2 text-xs font-black text-blue-700">
                  {store.accepts_pickup ? "Pickup activo" : "Sin pickup"}
                </span>
              </div>
            </div>
          </section>
        ))}
      </div>
    </PanelShell>
  );
}
