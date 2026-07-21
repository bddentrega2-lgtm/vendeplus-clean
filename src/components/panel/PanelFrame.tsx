"use client";

import { usePathname } from "next/navigation";
import { PanelShell } from "@/components/panel/PanelShell";

const panelRouteMeta: Record<string, { active: string; title: string; subtitle: string }> = {
  "/panel": {
    active: "/panel",
    title: "Inicio",
    subtitle: "",
  },
  "/panel/inicio": {
    active: "/panel",
    title: "Inicio",
    subtitle: "",
  },
  "/panel/pedidos": {
    active: "/panel/pedidos",
    title: "Pedidos",
    subtitle: "",
  },
  "/panel/productos": {
    active: "/panel/productos",
    title: "Productos",
    subtitle: "Coloca el nombre, su imagen y precio. Luego guárdalo.",
  },
  "/panel/catalogo": {
    active: "/panel/catalogo",
    title: "Categorías",
    subtitle: "Ordena las categorías que verá el cliente en el catálogo.",
  },
  "/panel/opciones": {
    active: "/panel/opciones",
    title: "Variantes o adicionales",
    subtitle: "Crea tallas, sabores, salsas o extras y asígnalos a productos.",
  },
  "/panel/delivery": {
    active: "/panel/delivery",
    title: "Delivery",
    subtitle: "Configura retiro, delivery propio o conexión con empresas delivery.",
  },
  "/panel/clientes": {
    active: "/panel/clientes",
    title: "Clientes",
    subtitle: "Revisa quién compra y vuelve a escribirle por WhatsApp.",
  },
  "/panel/estadisticas": {
    active: "/panel/estadisticas",
    title: "Estadísticas",
    subtitle: "Mira ventas, pedidos, clientes y productos destacados.",
  },
  "/panel/configuracion": {
    active: "/panel/configuracion",
    title: "Configuración",
    subtitle: "Edita la información principal del negocio.",
  },
  "/panel/suscripcion": {
    active: "/panel/suscripcion",
    title: "Suscripción",
    subtitle: "Revisa tu plan y envía el pago a revisión.",
  },
};

const routesWithoutPanelShell = new Set(["/panel/login", "/panel/update-password"]);

export function PanelFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (routesWithoutPanelShell.has(pathname)) {
    return <>{children}</>;
  }

  const meta = panelRouteMeta[pathname] || panelRouteMeta["/panel"];

  return (
    <PanelShell active={meta.active} title={meta.title} subtitle={meta.subtitle}>
      {children}
    </PanelShell>
  );
}
