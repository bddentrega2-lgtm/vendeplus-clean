import { notFound } from "next/navigation";
import { CatalogClient } from "@/components/public/CatalogClient";
import {
  getPublicStoreBySlug,
  getUnavailableStoreContactBySlug,
} from "@/lib/supabase/catalog";

export const revalidate = 30;

export default async function StorePage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getPublicStoreBySlug(storeSlug);

  if (!store) {
    const unavailableStore = await getUnavailableStoreContactBySlug(storeSlug);
    if (!unavailableStore) notFound();

    const whatsappUrl = unavailableStore.whatsapp
      ? `https://wa.me/${unavailableStore.whatsapp}`
      : null;

    return (
      <main className="min-h-screen bg-[#F8F3E8] px-4 py-10 text-[#25262B]">
        <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.10] ring-1 ring-[#25262B]/[0.06]">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
            {unavailableStore.name}
          </p>
          <h1 className="mt-3 text-3xl font-black">Catálogo inactivo temporalmente</h1>
          <p className="mt-3 text-sm font-bold leading-relaxed text-[#746f69]">
            Este catálogo está inactivo temporalmente. Comunícate directamente con la tienda por WhatsApp.
          </p>
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              className="mt-5 inline-flex items-center justify-center rounded-full bg-green-100 px-5 py-3 text-sm font-black text-green-700"
            >
              Escribir por WhatsApp
            </a>
          ) : null}
        </section>
      </main>
    );
  }

  return <CatalogClient store={store} />;
}
