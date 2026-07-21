import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogClient } from "@/components/public/CatalogClient";
import {
  getPublicStoreBySlug,
  getPublicStoreShellBySlug,
  getUnavailableStoreContactBySlug,
} from "@/lib/supabase/catalog";
import { buildPublicUrl } from "@/lib/public-url";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}): Promise<Metadata> {
  const { storeSlug } = await params;
  const store = await getPublicStoreShellBySlug(storeSlug);

  if (!store) {
    return {
      title: "Catálogo no disponible | Somos",
      description: "Este catálogo no está disponible temporalmente en Somos.",
      alternates: {
        canonical: buildPublicUrl(`/${storeSlug}`),
      },
    };
  }

  const title = `${store.name} | Catálogo Somos`;
  const description =
    store.description ||
    `Mira el catálogo de ${store.name}, arma tu pedido y envíalo por WhatsApp.`;
  const imageUrl = buildPublicUrl(`/${store.slug}/opengraph-image`);
  const pageUrl = buildPublicUrl(`/${store.slug}`);

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "Somos",
      type: "website",
      locale: "es_VE",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `Catálogo de ${store.name} en Somos`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

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
