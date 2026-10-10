"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelShell } from "@/components/panel/PanelShell";
import { isSubscriptionPastDue } from "@/lib/subscription-status";
import { usePanelAuth } from "@/components/panel/PanelAuthProvider";
import { TableOrderNotifier } from "@/components/panel/TableOrderNotifier";
import { useEffect } from "react";
import { safeMobileRoute, writeMobile } from "@/lib/mobile/state";

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
  "/panel/mesas": {
    active: "/panel/mesas",
    title: "Mesa / Barra",
    subtitle: "Administra pedidos, mesas, pagos y el QR único del comercio.",
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
  "/panel/cocina": { active: "/panel/cocina", title: "Cocina", subtitle: "" },
  "/panel/impresion": {
    active: "/panel/impresion",
    title: "Impresion",
    subtitle: "Conecta una impresora termica y configura tus comandas.",
  },
  "/panel/update-password": {
    active: "/panel/update-password",
    title: "Contraseña",
    subtitle: "Actualiza la contraseña de acceso a tu cuenta.",
  },
  "/panel/suscripcion": {
    active: "/panel/suscripcion",
    title: "Suscripción",
    subtitle: "Revisa tu plan y envía el pago a revisión.",
  },
};

const routesWithoutPanelShell = new Set(["/panel/login"]);
const routesAllowedWhenExpired = new Set(["/panel/suscripcion"]);
type PanelStoreSubscriptionState = {
  id?: string | null;
  subscription_status?: string | null;
  subscription_ends_at?: string | null;
  next_payment_due_at?: string | null;
  trial_ends_at?: string | null;
};

function isStorePastDue(store?: PanelStoreSubscriptionState | null) {
  return isSubscriptionPastDue(store);
}

function ExpiredPanelBlock() {
  return (
    <section className="rounded-[34px] bg-white p-6 text-center shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-red-100">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-red-50 text-red-600">
        !
      </div>
      <h2 className="mt-4 text-2xl font-black text-[#25262B]">Tu periodo vencio</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-relaxed text-[#746f69]">
        Para proteger tu catalogo y evitar pedidos sin plan activo, este panel queda limitado a Suscripcion.
        Activa el plan por servicio para reanudar la operacion.
      </p>
      <Link
        href="/panel/suscripcion"
        className="mt-5 inline-flex rounded-full bg-[#FFB547] px-6 py-3 text-sm font-black text-[#25262B]"
      >
        Ir a Suscripcion
      </Link>
    </section>
  );
}

export function PanelFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isBootstrapping, isRevalidating, contextError, refreshSession, revalidateSession, accountId, selectedStoreId, selectedStore } = usePanelAuth();
  useEffect(() => {
    if (!isBootstrapping && !contextError && accountId && selectedStoreId && safeMobileRoute(pathname)) writeMobile("private_route", pathname);
  }, [isBootstrapping, contextError, accountId, selectedStoreId, pathname]);

  const meta = panelRouteMeta[pathname] || panelRouteMeta["/panel"];

  if (routesWithoutPanelShell.has(pathname)) {
    return <>{children}</>;
  }

  if (isBootstrapping) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F8F3E8] px-4 text-center text-[#25262B]">
        <p className="text-sm font-black text-[#746f69]">Cargando tu comercio...</p>
      </main>
    );
  }

  if (contextError && !accountId) return <main className="grid min-h-screen place-content-center gap-4 p-6 text-center"><p role="alert">{contextError}</p><button type="button" onClick={() => void refreshSession()} className="min-h-12 rounded-lg bg-[#143D42] px-5 text-white">Reintentar</button><Link href="/panel/login">Ingresar</Link></main>;

  const isExpired = isStorePastDue(selectedStore);
  const shouldBlockContent = isExpired && !routesAllowedWhenExpired.has(pathname);

  const checking = isRevalidating || Boolean(contextError);
  return (<>
    {checking ? <div className="native-session-check" role="status"><div className="grid gap-4 p-6 text-center"><p>{contextError || "Comprobando tu acceso..."}</p>{contextError ? <><button onClick={() => void revalidateSession()} className="min-h-12 rounded-lg bg-[#143D42] px-5 text-white">Reintentar</button><Link href="/panel/login">Ingresar</Link></> : null}</div></div> : null}
    <div inert={checking} style={checking ? { visibility: "hidden" } : undefined}>
    <PanelShell active={meta.active} title={meta.title} subtitle={meta.subtitle}>
      <TableOrderNotifier />
      <div key={`${accountId}:${selectedStoreId}`}>
        {shouldBlockContent ? <ExpiredPanelBlock /> : children}
      </div>
    </PanelShell></div></>
  );
}
