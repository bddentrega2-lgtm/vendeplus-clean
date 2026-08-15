"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Copy,
  DollarSign,
  ExternalLink,
  Lock,
  ShoppingBag,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { formatUsd } from "@/lib/currency";
import { buildClientPublicUrl } from "@/lib/public-url";
import { buildStoreWelcomeMessage } from "@/lib/store-share";
import { isSubscriptionPastDue } from "@/lib/subscription-status";
import { PanelAccessGate, PanelModuleSkeleton } from "@/components/panel/PanelLoadingState";
import {
  getPanelAccessToken,
  getPanelAuthHeaders,
  getSavedPanelPin,
  hasSavedPanelAuth,
  savePanelPin,
  shouldShowPanelInitialAccessGate,
} from "@/lib/panel/client-auth";
import { fetchPanelJson } from "@/lib/panel/client-fetch-cache";

async function apiRequest(pin: string) {
  return fetchPanelJson("/api/panel/stats?mode=summary", {
    headers: await getPanelAuthHeaders(pin),
  });
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: any;
}) {
  return (
    <article className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[#746f69]">{label}</p>
          <p className="mt-3 text-3xl font-black text-[#25262B]">{value}</p>
          <p className="mt-1 text-xs font-bold text-[#746f69]">{detail}</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-3xl bg-[#FFB547]/20 text-[#2E3A79]">
          <Icon size={22} />
        </div>
      </div>
    </article>
  );
}

function getSubscriptionReminder(store: any) {
  if (!store) return null;

  const status = String(store.subscription_status || "").toLowerCase();
  const dueValue =
    store.next_payment_due_at || store.subscription_ends_at || store.trial_ends_at || null;
  const formattedDate = dueValue
    ? new Intl.DateTimeFormat("es-VE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(dueValue))
    : "sin fecha registrada";

  if (["past_due", "expired", "paused", "cancelled"].includes(status)) {
    return {
      tone: "danger",
      title: "Pago vencido",
      text: `Tu comercio esta vencido desde ${formattedDate}. Ve a Suscripcion para reactivarlo.`,
    };
  }

  if (!dueValue) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${String(dueValue).slice(0, 10)}T00:00:00`);
  dueDate.setHours(0, 0, 0, 0);
  const days = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
  if (days < 0) {
    return {
      tone: "danger",
      title: "Pago vencido",
      text: `Tu fecha de pago vencio el ${formattedDate}. El catalogo publico puede quedar inactivo hasta regularizar la suscripcion.`,
    };
  }

  if (days === 0) {
    return {
      tone: "warning",
      title: "Pago vence hoy",
      text: `Tu fecha de pago es hoy (${formattedDate}).`,
    };
  }

  return {
    tone: days <= 5 ? "warning" : "ok",
    title: `${days} dia${days === 1 ? "" : "s"} para tu proximo pago`,
    text: `Fecha de pago: ${formattedDate}.`,
  };
}

function getRelevantStore(stores: any[]) {
  return (
    stores.find((store) => isSubscriptionPastDue(store)) || stores[0]
  );
}

export function DashboardManager() {
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => shouldShowPanelInitialAccessGate());
  const [isLoading, setIsLoading] = useState(() => hasSavedPanelAuth());
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [catalogShared, setCatalogShared] = useState(false);

  async function loadDashboard(currentPin: string) {
    setIsLoading(true);
    setError("");

    try {
      const data = await apiRequest(currentPin);
      setStats(data);
      setIsUnlocked(true);

      if (currentPin) {
        savePanelPin(currentPin);
      }
    } catch (error: any) {
      setError(error.message || "No se pudo cargar el dashboard.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootPanel() {
      const savedPin = getSavedPanelPin();
      const savedToken = await getPanelAccessToken();

      if (!active) return;

      if (savedPin || savedToken) {
        setPin(savedPin);
        loadDashboard(savedPin);
      } else {
        setIsCheckingAccess(false);
        setIsLoading(false);
      }
    }

    bootPanel();

    return () => {
      active = false;
    };
  }, []);

  if (isCheckingAccess) {
    return <PanelAccessGate />;
  }

  if ((!isUnlocked || !stats) && isLoading) {
    return <PanelModuleSkeleton label="Cargando inicio..." />;
  }

  if (!isUnlocked || !stats) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso al dashboard</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesión para ver el resumen de tus comercios asignados.
        </p>

        <a
          href="/panel/login"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
        >
          <Activity size={18} />
          Iniciar sesión
        </a>

        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>
    );
  }

  const summary = stats.summary || {};
  const achievementFeatures = stats.achievementFeatures;
  const hasBasicStats = achievementFeatures === null || achievementFeatures?.basic_stats;
  const hasFullStats = achievementFeatures === null || achievementFeatures?.full_stats;
  const hasCustomers = achievementFeatures === null || achievementFeatures?.customers_basic;
  const stores = Array.isArray(stats.stores) ? stats.stores : [];
  const primaryStore = getRelevantStore(stores);
  const subscriptionReminder = getSubscriptionReminder(primaryStore);
  const publicCatalogUrl =
    primaryStore?.slug
      ? buildClientPublicUrl(`/${primaryStore.slug}`)
      : "";

  async function copyCatalogLink() {
    setShareMessage("");

    if (!publicCatalogUrl || !primaryStore?.name) {
      setShareMessage("No hay un catálogo público disponible todavía.");
      return;
    }

    const welcomeMessage = buildStoreWelcomeMessage({
      storeName: primaryStore.name,
      catalogUrl: publicCatalogUrl,
    });

    try {
      await navigator.clipboard.writeText(welcomeMessage);
      setCatalogShared(true);
      setShareMessage("🎉 Mensaje de bienvenida copiado. Pégalo en WhatsApp, Instagram o donde atiendas clientes.");
    } catch {
      setShareMessage("No se pudo copiar el mensaje. Abre el catálogo y copia la URL.");
    }
  }

  const checklistItems = [
    {
      label: "Configura los datos de tu negocio",
      detail: primaryStore ? primaryStore.name : "Completa nombre, WhatsApp, dirección y pagos.",
      href: "/panel/configuracion",
      action: "Configurar negocio",
      done: Boolean(primaryStore),
    },
    {
      label: "Carga tus productos",
      detail: `${summary.activeProducts || 0} productos activos`,
      href: "/panel/productos",
      action: "Cargar productos",
      done: Number(summary.activeProducts || 0) > 0,
    },
    {
      label: "Revisa cómo se ve tu catálogo",
      detail: primaryStore?.slug ? `/${primaryStore.slug}` : "Primero configura tu negocio.",
      href: primaryStore?.slug ? `/${primaryStore.slug}` : "/panel/catalogo",
      action: "Ver catálogo",
      external: Boolean(primaryStore?.slug),
      done: Boolean(primaryStore?.slug && Number(summary.activeProducts || 0) > 0),
    },
    {
      label: "Comparte tu catálogo con clientes",
      detail: publicCatalogUrl || "Disponible cuando tu comercio tenga slug.",
      action: "Compartir catálogo",
      done: catalogShared,
      onClick: copyCatalogLink,
    },
    {
      label: "Revisa tus pedidos",
      detail: `${summary.totalOrders || 0} pedidos registrados`,
      href: "/panel/pedidos",
      action: "Ver pedidos",
      done: Number(summary.totalOrders || 0) > 0,
    },
  ];

  const cards = [
    {
      label: "Ventas del período",
      value: formatUsd(summary.totalRevenueUsd),
      detail: `${summary.totalOrders || 0} pedidos registrados`,
      icon: DollarSign,
    },
    {
      label: "Pedidos registrados",
      value: String(summary.totalOrders || 0),
      detail: `${summary.completedOrders || 0} completados · ${summary.cancelledOrders || 0} cancelados`,
      icon: ClipboardList,
    },
    {
      label: "Ticket promedio",
      value: formatUsd(summary.averageTicketUsd),
      detail: "Promedio por pedido",
      icon: ShoppingBag,
    },
    {
      label: "Productos activos",
      value: String(summary.activeProducts || 0),
      detail: `${summary.inactiveProducts || 0} productos inactivos`,
      icon: Boxes,
    },
  ];

  return (
    <div className="space-y-6">
      {subscriptionReminder ? (
        <section
          className={[
            "rounded-[32px] p-5 shadow-xl ring-1",
            subscriptionReminder.tone === "danger"
              ? "bg-red-50 text-red-800 shadow-red-100 ring-red-100"
              : subscriptionReminder.tone === "warning"
                ? "bg-amber-50 text-amber-900 shadow-amber-100 ring-amber-100"
                : "bg-white text-[#25262B] shadow-[#2E3A79]/[0.07] ring-[#25262B]/[0.06]",
          ].join(" ")}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">
                Suscripcion
              </p>
              <h2 className="mt-1 text-2xl font-black">{subscriptionReminder.title}</h2>
              <p className="mt-1 text-sm font-bold opacity-80">{subscriptionReminder.text}</p>
            </div>
            <Link
              href="/panel/suscripcion"
              className="inline-flex items-center justify-center rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
            >
              Ver suscripcion
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
              Acciones rápidas
            </p>
            <h2 className="mt-2 text-3xl font-black">Prepara tu catálogo</h2>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-relaxed text-[#746f69]">
              Completa lo básico, comparte el link y empieza a recibir pedidos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {primaryStore?.slug && (
              <a
                href={`/${primaryStore.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white"
              >
                <ExternalLink size={17} />
                Ver catálogo
              </a>
            )}
            <button
              type="button"
              onClick={copyCatalogLink}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
            >
              <Copy size={17} />
              Compartir catálogo
            </button>
          </div>
        </div>

        {shareMessage && (
          <div className="mt-4 rounded-[24px] bg-[#FFF8F0] p-4 ring-1 ring-[#FFB547]/35">
            <p className="text-sm font-black text-[#2E3A79]">{shareMessage}</p>
            {publicCatalogUrl && primaryStore?.name ? (
              <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-white p-3 text-xs font-bold leading-relaxed text-[#25262B]">
                {buildStoreWelcomeMessage({
                  storeName: primaryStore.name,
                  catalogUrl: publicCatalogUrl,
                })}
              </pre>
            ) : null}
          </div>
        )}

        <div className="mt-5 grid gap-3 lg:grid-cols-5">
          {checklistItems.map((item) => {
            const content = (
              <>
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full",
                      item.done ? "bg-green-100 text-green-700" : "bg-[#F8F3E8] text-[#746f69]",
                    ].join(" ")}
                  >
                    <CheckCircle2 size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#25262B]">{item.label}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-bold text-[#746f69]">
                      {item.detail}
                    </p>
                  </div>
                </div>
                <span className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#25262B] px-4 py-2 text-xs font-black text-white">
                  {item.action}
                </span>
              </>
            );

            if (item.onClick) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="rounded-[26px] bg-white p-4 text-left ring-1 ring-[#25262B]/10 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href || "/panel"}
                target={item.external ? "_blank" : undefined}
                className="rounded-[26px] bg-white p-4 ring-1 ring-[#25262B]/10 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-[34px] bg-[#25262B] p-5 text-white shadow-xl shadow-[#25262B]/20">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
              Resumen del negocio
            </p>
            <h2 className="mt-2 text-3xl font-black">Resumen operativo</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-white/70">
              Métricas principales de los comercios que puedes administrar.
            </p>
          </div>

        </div>
      </section>

      {hasCustomers ? <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
              Clientes y recompra
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#25262B]">
              Vuelve a venderle a quien ya compró
            </h2>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Revisa clientes frecuentes y personas a las que conviene escribir por WhatsApp.
            </p>
          </div>
          <Link
            href="/panel/clientes"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white"
          >
            <UsersRound size={17} />
            Ver clientes
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-[24px] bg-[#F8F3E8] p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
              Clientes totales
            </p>
            <p className="mt-2 text-3xl font-black text-[#25262B]">
              {stats.customers?.total || 0}
            </p>
          </div>
          <div className="rounded-[24px] bg-green-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-green-700">
              Frecuentes
            </p>
            <p className="mt-2 text-3xl font-black text-green-700">
              {stats.customers?.frequent || 0}
            </p>
          </div>
          <div className="rounded-[24px] bg-amber-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-800">
              Por contactar
            </p>
            <p className="mt-2 text-3xl font-black text-amber-800">
              {stats.customers?.contact || 0}
            </p>
          </div>
        </div>
      </section> : null}

      {hasBasicStats ? <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section> : <section className="rounded-[34px] bg-white p-6 text-center shadow-xl ring-1 ring-[#25262B]/[0.06]"><Lock className="mx-auto text-[#2E3A79]" /><h2 className="mt-3 text-2xl font-black">Tus estadísticas se desbloquean con 10 pedidos</h2><p className="mt-2 text-sm font-bold text-[#746f69]">Revisa tu progreso y los demás beneficios disponibles.</p><Link href="/panel/logros" className="mt-4 inline-flex rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black">Ver logros</Link></section>}

      <section className="grid gap-5 xl:grid-cols-2">
        {hasFullStats ? <div className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <h2 className="text-2xl font-black">Productos más vendidos</h2>
          <div className="mt-5 space-y-3">
            {(stats.topProducts || []).slice(0, 5).map((product: any, index: number) => (
              <div key={product.product} className="flex items-center justify-between rounded-3xl bg-[#F8F3E8] p-4">
                <div>
                  <p className="font-black">#{index + 1} {product.product}</p>
                  <p className="text-xs font-bold text-[#746f69]">{product.quantity} unidades</p>
                </div>
                <p className="font-black">{formatUsd(product.revenue)}</p>
              </div>
            ))}
          </div>
        </div> : null}

        <div className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <h2 className="text-2xl font-black">Accesos rápidos</h2>
          <div className="mt-5 grid gap-3">
            <Link href="/panel/productos" className="rounded-full bg-[#2E3A79] px-5 py-3 text-center text-sm font-black text-white">
              Gestionar productos
            </Link>
            <button
              type="button"
              onClick={copyCatalogLink}
              className="rounded-full bg-[#25262B] px-5 py-3 text-center text-sm font-black text-white"
            >
              Compartir catálogo
            </button>
            <Link href="/panel/pedidos" className="rounded-full bg-[#FFB547] px-5 py-3 text-center text-sm font-black text-[#25262B]">
              Ver pedidos
            </Link>
            <Link href={hasFullStats ? "/panel/estadisticas" : "/panel/logros"} className="rounded-full bg-[#F8F3E8] px-5 py-3 text-center text-sm font-black text-[#2E3A79]">
              {hasFullStats ? "Estadísticas completas" : "Desbloquear estadísticas"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
