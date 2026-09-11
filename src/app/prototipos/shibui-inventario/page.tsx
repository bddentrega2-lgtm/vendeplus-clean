import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShibuiInventoryPrototype } from "@/components/prototypes/ShibuiInventoryPrototype";
import catalog from "@/data/shibui-catalog.preview.json";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prototipo de inventario SHIBUI | Somos",
  robots: { index: false, follow: false },
};

export default function ShibuiInventoryPrototypePage() {
  // Esta ruta es deliberadamente exclusiva de Preview y desarrollo local.
  // Aunque un artefacto futuro se promoviera por error, produccion responderia 404.
  if (process.env.VERCEL_ENV === "production") {
    notFound();
  }

  return <ShibuiInventoryPrototype catalog={catalog} />;
}
