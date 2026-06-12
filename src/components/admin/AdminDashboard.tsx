"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Lock,
  Package,
  PlusCircle,
  RefreshCcw,
  UserRoundPlus,
} from "lucide-react";
import {
  getPanelAuthHeaders,
  getSavedPanelToken,
  hasSavedPanelAuth,
} from "@/lib/panel/client-auth";

type Summary = {
  totalStores: number;
  activeStores: number;
  inactiveStores: number;
  totalOrders: number;
  totalProducts: number;
  totalAssignments: number;
  revenueUsd: number;
};

type RecentStore = {
  id: string;
  slug: string;
  name: string;
  business_type: string | null;
  whatsapp: string | null;
  is_active: boolean;
};

type AuthCheck = {
  authenticated: boolean;
  userEmail: string | null;
  founderEmailsConfigured: boolean;
  founderEmailCount: number;
  founderEmailsPreview: string[];
  matchesFounderEmail: boolean;
  reason: string;
};

async function adminRequest(path: string, pin: string, options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getPanelAuthHeaders(pin)),
      ...(options?.headers || {}),
    },
  });
  const data = await response.json();

  if (!response.ok) throw new Error(data.error || "Error cargando admin.");

  return data;
}

async function getAdminAuthCheck(): Promise<AuthCheck | null> {
  try {
    const response = await fetch("/api/admin/auth-check", {
      headers: await getPanelAuthHeaders(""),
    });
    const data = await response.json();

    return data as AuthCheck;
  } catch {
    return null;
  }
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function AccessBox({
  error,
  authCheck,
  isLoading,
  onSubmit,
}: {
  error: string;
  authCheck: AuthCheck | null;
  isLoading: boolean;
  onSubmit: () => void;
}) {
  return (
    <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#25262B] text-[#FFB547]">
        <Lock size={26} />
      </div>
      <h2 className="mt-5 text-3xl font-black">Acceso fundador</h2>
      <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
        Inicia sesión con un email incluido en FOUNDER_EMAILS para entrar al admin.
      </p>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60"
      >
        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
        Validar sesión
      </button>

      <Link
        href="/panel/login"
        className="mt-3 inline-flex text-sm font-black text-[#2E3A79]"
      >
        Iniciar sesión con email
      </Link>

      {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}

      {authCheck && (
        <div className="mt-4 rounded-2xl bg-[#F8F3E8] p-4 text-left text-sm font-bold text-[#25262B]">
          <p className="font-black text-[#2E3A79]">Diagnóstico</p>
          <p className="mt-2">Sesión: {authCheck.authenticated ? "activa" : "no detectada"}</p>
          <p>Email detectado: {authCheck.userEmail || "ninguno"}</p>
          <p>
            FOUNDER_EMAILS:{" "}
            {authCheck.founderEmailsConfigured
              ? `${authCheck.founderEmailCount} configurado(s)`
              : "no configurado en producción"}
          </p>
          {authCheck.founderEmailsPreview.length > 0 && (
            <p>Founder configurado: {authCheck.founderEmailsPreview.join(", ")}</p>
          )}
          <p>Coincide: {authCheck.matchesFounderEmail ? "sí" : "no"}</p>
          <p className="mt-2 text-[#746f69]">{authCheck.reason}</p>
        </div>
      )}
    </section>
  );
}

export function AdminDashboard() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => hasSavedPanelAuth());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [authCheck, setAuthCheck] = useState<AuthCheck | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentStores, setRecentStores] = useState<RecentStore[]>([]);

  async function loadSummary() {
    setIsLoading(true);
    setError("");

    try {
      const data = await adminRequest("/api/admin/summary", "");
      setSummary(data.summary);
      setRecentStores(data.recentStores || []);
      setIsUnlocked(true);
      setAuthCheck(null);
    } catch (error: any) {
      setError(error.message || "No se pudo cargar admin.");
      setAuthCheck(await getAdminAuthCheck());
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }

  useEffect(() => {
    const savedToken = getSavedPanelToken();

    if (savedToken) {
      loadSummary();
    } else {
      setIsCheckingAccess(false);
    }
  }, []);

  if (isCheckingAccess) {
    return (
      <section className="rounded-[34px] bg-white p-6 text-center shadow-xl shadow-[#2E3A79]/[0.07]">
        <Loader2 size={22} className="mx-auto animate-spin text-[#25262B]" />
        <p className="mt-3 text-sm font-black text-[#746f69]">Validando acceso...</p>
      </section>
    );
  }

  if (!isUnlocked || !summary) {
    return (
      <AccessBox
        error={error}
        authCheck={authCheck}
        isLoading={isLoading}
        onSubmit={() => loadSummary()}
      />
    );
  }

  const cards = [
    { label: "Comercios", value: summary.totalStores, icon: Building2 },
    { label: "Activos", value: summary.activeStores, icon: CheckCircle2 },
    { label: "Pedidos", value: summary.totalOrders, icon: ClipboardList },
    { label: "Productos", value: summary.totalProducts, icon: Package },
    { label: "Usuarios asignados", value: summary.totalAssignments, icon: UserRoundPlus },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.label}
              className="rounded-[28px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.06] ring-1 ring-[#25262B]/[0.06]"
            >
              <Icon size={21} className="text-[#2E3A79]" />
              <p className="mt-4 text-3xl font-black">{card.value}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                {card.label}
              </p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
                Ventas registradas
              </p>
              <h2 className="mt-1 text-3xl font-black">{formatUsd(summary.revenueUsd)}</h2>
            </div>
            <button
              type="button"
              onClick={() => loadSummary()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F8F3E8] px-4 py-3 text-sm font-black text-[#2E3A79]"
            >
              <RefreshCcw size={16} />
              Actualizar
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Link
              href="/admin/comercios/nuevo"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FFB547] px-4 py-4 text-sm font-black text-[#25262B]"
            >
              <PlusCircle size={17} />
              Crear comercio
            </Link>
            <Link
              href="/admin/comercios"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25262B] px-4 py-4 text-sm font-black text-white"
            >
              <Building2 size={17} />
              Ver comercios
            </Link>
            <Link
              href="/admin/asignaciones"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2E3A79] px-4 py-4 text-sm font-black text-white"
            >
              <UserRoundPlus size={17} />
              Asignar usuario
            </Link>
          </div>
        </div>

        <div className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
            Comercios recientes
          </p>
          <div className="mt-4 space-y-3">
            {recentStores.map((store) => (
              <Link
                key={store.id}
                href={`/admin/comercios/${store.id}`}
                className="block rounded-2xl bg-[#F8F3E8] p-4 transition hover:bg-[#efe5d2]"
              >
                <p className="font-black">{store.name}</p>
                <p className="mt-1 text-xs font-bold text-[#746f69]">
                  /{store.slug} · {store.is_active ? "Activo" : "Inactivo"}
                </p>
              </Link>
            ))}
            {recentStores.length === 0 && (
              <p className="text-sm font-bold text-[#746f69]">Todavía no hay comercios.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
