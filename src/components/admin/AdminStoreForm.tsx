"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Lock,
  PauseCircle,
  Save,
  Trash2,
} from "lucide-react";
import {
  getPanelAuthHeaders,
  getSavedPanelToken,
  hasSavedPanelAuth,
} from "@/lib/panel/client-auth";
import { PER_SERVICE_FEE_USD } from "@/lib/plans";
import { BUSINESS_TYPES } from "@/lib/business-types";

type StoreDraft = {
  name: string;
  slug: string;
  business_type: string;
  whatsapp: string;
  description: string;
  address: string;
  city_id: string;
  latitude: string;
  longitude: string;
  opening_hours: string;
  delivery_estimate: string;
  pickup_estimate: string;
  payment_methods: string;
  usd_to_bs: string;
  whatsapp_message_note: string;
  primary_color: string;
  accent_color: string;
  button_text_color: string;
  logo_url: string;
  cover_image_url: string;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  is_active: boolean;
  is_test: boolean;
  table_orders_access_enabled: boolean;
  plan_type: string;
  product_limit: string;
  service_fee_usd: string;
  service_fee_payer: string;
  trial_started_at: string;
  trial_ends_at: string;
  subscription_status: string;
  subscription_started_at: string;
  subscription_ends_at: string;
  next_payment_due_at: string;
  monthly_price_usd: string;
  billing_notes: string;
  last_payment_at: string;
  access_email: string;
  access_password: string;
  access_password_confirmation: string;
  access_role: string;
  admin_delivery_provider: string;
  admin_delivery_enabled: boolean;
  admin_pickup_enabled: boolean;
};

const initialDraft: StoreDraft = {
  name: "",
  slug: "",
  business_type: "general",
  whatsapp: "",
  description: "",
  address: "",
  city_id: "",
  latitude: "",
  longitude: "",
  opening_hours: "Disponible hoy",
  delivery_estimate: "25-40 min",
  pickup_estimate: "15-25 min",
  payment_methods: "Pago movil, Transferencia, Efectivo, Binance",
  usd_to_bs: "600",
  whatsapp_message_note: "",
  primary_color: "#1F464C",
  accent_color: "#F27533",
  button_text_color: "#042332",
  logo_url: "",
  cover_image_url: "",
  accepts_delivery: false,
  accepts_pickup: true,
  is_active: true,
  is_test: false,
  table_orders_access_enabled: false,
  plan_type: "monthly",
  product_limit: "30",
  service_fee_usd: "0",
  service_fee_payer: "merchant",
  trial_started_at: "",
  trial_ends_at: "",
  subscription_status: "active",
  subscription_started_at: "",
  subscription_ends_at: "",
  next_payment_due_at: "",
  monthly_price_usd: "20",
  billing_notes: "",
  last_payment_at: "",
  access_email: "",
  access_password: "",
  access_password_confirmation: "",
  access_role: "owner",
  admin_delivery_provider: "disabled",
  admin_delivery_enabled: false,
  admin_pickup_enabled: true,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toDateInput(value: unknown) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function addDaysToDateInput(value: string, days: number) {
  const base =
    value && new Date(value).getTime() > Date.now() ? new Date(value) : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayDateInput() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function getPrimarySubscriptionDate(draft: StoreDraft) {
  return draft.next_payment_due_at || draft.subscription_ends_at || draft.trial_ends_at;
}

function getDaysLeft(dateInput: string) {
  if (!dateInput) return null;
  const date = new Date(`${dateInput}T23:59:59`);
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatAdminDate(value: string) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function planLabel(value: string) {
  if (value === "trial") return "Prueba gratis";
  if (value === "monthly") return "Mensualidad";
  if (value === "per_service") return "Fee por pedido";
  if (value === "founder") return "Founder";
  return value || "Sin plan";
}

function subscriptionSummary(draft: StoreDraft) {
  const status = String(draft.subscription_status || "").toLowerCase();
  const dueDate = getPrimarySubscriptionDate(draft);
  const daysLeft = getDaysLeft(dueDate);
  const isExpired =
    ["expired", "past_due", "cancelled"].includes(status) ||
    (daysLeft !== null && daysLeft < 0);
  const isPaused = status === "paused" || draft.is_active === false;

  if (isPaused) {
    return {
      label: "Pausado",
      detail: "El comercio no deberia operar hasta reactivarlo.",
      badgeClass: "bg-slate-100 text-slate-700",
      daysLabel: dueDate ? `Fecha registrada: ${formatAdminDate(dueDate)}` : "Sin fecha registrada",
    };
  }

  if (isExpired) {
    return {
      label: "Vencido",
      detail: "Debe elegir mensualidad o fee por pedido para volver a operar.",
      badgeClass: "bg-red-100 text-red-700",
      daysLabel:
        daysLeft === null
          ? "Sin fecha de vencimiento"
          : `Vencido hace ${Math.abs(daysLeft)} dia${Math.abs(daysLeft) === 1 ? "" : "s"}`,
    };
  }

  if (draft.plan_type === "trial") {
    return {
      label: "En prueba gratis",
      detail: "Al vencer, el comercio debe elegir mensualidad o fee por pedido.",
      badgeClass: "bg-amber-100 text-amber-800",
      daysLabel:
        daysLeft === null
          ? "Sin fin de prueba"
          : daysLeft === 0
            ? "Vence hoy"
            : `Quedan ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`,
    };
  }

  return {
    label: "Activo",
    detail:
      draft.plan_type === "per_service"
        ? "Opera con fee por pedido y corte mensual."
        : "Opera con mensualidad activa.",
    badgeClass: "bg-green-100 text-green-700",
    daysLabel:
      daysLeft === null
        ? "Sin proximo cobro"
        : daysLeft === 0
          ? "Vence hoy"
          : `Quedan ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`,
  };
}

function mapStoreToDraft(store: any, deliverySettings?: any): StoreDraft {
  return {
    ...initialDraft,
    name: store.name || "",
    slug: store.slug || "",
    business_type: store.business_type || "general",
    whatsapp: store.whatsapp || "",
    description: store.description || "",
    address: store.address || "",
    city_id: store.city_id || "",
    latitude: store.latitude === null || store.latitude === undefined ? "" : String(store.latitude),
    longitude: store.longitude === null || store.longitude === undefined ? "" : String(store.longitude),
    opening_hours: store.opening_hours || "Disponible hoy",
    delivery_estimate: store.delivery_estimate || "25-40 min",
    pickup_estimate: store.pickup_estimate || "15-25 min",
    payment_methods: Array.isArray(store.payment_methods)
      ? store.payment_methods.join(", ")
      : initialDraft.payment_methods,
    usd_to_bs: String(store.usd_to_bs || "600"),
    whatsapp_message_note: store.whatsapp_message_note || "",
    primary_color: store.primary_color || "#1F464C",
    accent_color: store.accent_color || "#F27533",
    button_text_color: store.button_text_color || "#042332",
    logo_url: store.logo_url || "",
    cover_image_url: store.cover_image_url || "",
    accepts_delivery: store.accepts_delivery === true,
    accepts_pickup: store.accepts_pickup !== false,
    admin_delivery_provider:
      deliverySettings?.delivery_provider ||
      (store.accepts_delivery ? "own_delivery" : "disabled"),
    admin_delivery_enabled:
      deliverySettings?.delivery_enabled ?? store.accepts_delivery === true,
    admin_pickup_enabled:
      deliverySettings?.pickup_enabled ?? store.accepts_pickup !== false,
    is_active: store.is_active !== false,
    is_test: store.is_test === true,
    table_orders_access_enabled: store.table_orders_access_enabled === true,
    plan_type: store.plan_type || "trial",
    product_limit: String(store.product_limit ?? "30"),
    service_fee_usd: String(
      store.plan_type === "per_service"
        ? store.monthly_price_usd ?? (store.plan_type === "per_service" ? PER_SERVICE_FEE_USD : 0)
        : 0
    ),
    service_fee_payer: store.service_fee_payer === "customer" ? "customer" : "merchant",
    trial_started_at: toDateInput(store.trial_started_at),
    trial_ends_at: toDateInput(store.trial_ends_at),
    subscription_status: store.subscription_status || (store.plan_type === "trial" ? "trial" : "active"),
    subscription_started_at: toDateInput(store.subscription_started_at),
    subscription_ends_at: toDateInput(store.subscription_ends_at),
    next_payment_due_at: toDateInput(store.next_payment_due_at),
    monthly_price_usd: String(store.monthly_price_usd ?? "0"),
    billing_notes: store.billing_notes || "",
    last_payment_at: toDateInput(store.last_payment_at),
  };
}

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

  if (!response.ok) throw new Error(data.error || "Error guardando comercio.");

  return data;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[#25262B]/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]";

type AdminAchievement = {
  key: string;
  title: string;
  reward: string;
  unlocked: boolean;
  source: "earned" | "inherited" | "admin" | null;
  progress: { current: number; target: number; detail?: string };
};

type AdminMonthlyChallenge = {
  key: string;
  title: string;
  reward: string;
  unlocked: boolean;
  source: "earned" | "admin" | null;
  rewardStatus: "active" | "revoked" | null;
  progress: { current: number; target: number; detail?: string };
};

export function AdminStoreForm({ storeId }: { storeId?: string }) {
  const router = useRouter();
  const isEditing = Boolean(storeId);
  const [draft, setDraft] = useState<StoreDraft>(initialDraft);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => hasSavedPanelAuth());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingStore, setIsDeletingStore] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createdStoreId, setCreatedStoreId] = useState("");
  const [achievements, setAchievements] = useState<AdminAchievement[]>([]);
  const [monthlyChallenges, setMonthlyChallenges] = useState<AdminMonthlyChallenge[]>([]);
  const [updatingAchievement, setUpdatingAchievement] = useState("");
  const [cities, setCities] = useState<Array<{ id: string; name: string; state_name: string }>>([]);

  useEffect(() => {
    fetch("/api/cities").then((response) => response.json())
      .then((data) => setCities(data.cities || [])).catch(() => setCities([]));
  }, []);

  function updateField(field: keyof StoreDraft, value: string | boolean) {
    setDraft((current) => {
      const next = { ...current, [field]: value };

      if (field === "name" && !current.slug) {
        next.slug = slugify(String(value));
      }
      if (field === "slug") {
        next.slug = slugify(String(value));
      }
      if (field === "plan_type") {
        if (value === "monthly") next.monthly_price_usd = "20";
        if (value === "per_service") {
          next.monthly_price_usd = PER_SERVICE_FEE_USD.toFixed(2);
          next.service_fee_usd = PER_SERVICE_FEE_USD.toFixed(2);
        }
        if (value === "trial" || value === "founder") next.monthly_price_usd = "0";
        next.subscription_status = value === "trial" ? "trial" : "active";
        if (value === "per_service" && !current.service_fee_payer) next.service_fee_payer = "merchant";
      }
      if (field === "admin_delivery_provider") {
        next.admin_delivery_enabled = value !== "disabled";
        next.accepts_delivery = value !== "disabled";
        if (value === "entrega2") {
          next.admin_pickup_enabled = current.admin_pickup_enabled;
        }
      }
      if (field === "admin_delivery_enabled") {
        next.accepts_delivery = value === true;
        if (value === false) next.admin_delivery_provider = "disabled";
        if (value === true && current.admin_delivery_provider === "disabled") {
          next.admin_delivery_provider = "own_delivery";
        }
      }
      if (field === "admin_pickup_enabled") {
        next.accepts_pickup = value === true;
      }

      return next;
    });
  }

  const unlock = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      if (isEditing) {
        const [data, achievementData] = await Promise.all([
          adminRequest(`/api/admin/stores/${storeId}`, ""),
          adminRequest(`/api/admin/stores/${storeId}/achievements`, ""),
        ]);
        setDraft(mapStoreToDraft(data.store, data.deliverySettings));
        setAchievements(achievementData.achievements || []);
        setMonthlyChallenges(achievementData.monthlyChallenges || []);
      } else {
        await adminRequest("/api/admin/summary", "");
      }

      setIsUnlocked(true);
    } catch (error: any) {
      setError(error.message || "No se pudo validar acceso.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }, [isEditing, storeId]);

  async function updateAchievement(achievement: AdminAchievement, action: "grant" | "revoke") {
    if (!storeId) return;
    if (action === "revoke" && !window.confirm(`¿Quitar la recompensa “${achievement.reward}”? Su progreso volverá a cero y deberá cumplir nuevamente la meta.`)) return;
    setUpdatingAchievement(achievement.key);
    setError("");
    setMessage("");
    try {
      const data = await adminRequest(`/api/admin/stores/${storeId}/achievements`, "", {
        method: "PATCH",
        body: JSON.stringify({ achievementKey: achievement.key, action }),
      });
      setAchievements(data.achievements || []);
      setMessage(data.message || "Recompensa habilitada.");
      if (achievement.key === "orders_100_product_limit") {
        setDraft((current) => ({ ...current, product_limit: action === "grant" ? "50" : "30" }));
      }
    } catch (nextError: any) {
      setError(nextError.message || "No se pudo actualizar la recompensa.");
    } finally {
      setUpdatingAchievement("");
    }
  }

  async function updateMonthlyChallenge(challenge: AdminMonthlyChallenge) {
    if (!storeId || !challenge.rewardStatus) return;
    const action = challenge.rewardStatus === "active" ? "revoke_monthly" : "activate_monthly";
    if (action === "revoke_monthly" && !window.confirm(`¿Retirar temporalmente “${challenge.reward}”?`)) return;
    setUpdatingAchievement(challenge.key);
    setError(""); setMessage("");
    try {
      const data = await adminRequest(`/api/admin/stores/${storeId}/achievements`, "", { method: "PATCH", body: JSON.stringify({ monthlyChallengeKey: challenge.key, action }) });
      setMonthlyChallenges(data.monthlyChallenges || []);
      setMessage(data.message || "Recompensa mensual actualizada.");
    } catch (nextError: any) {
      setError(nextError.message || "No se pudo actualizar la recompensa mensual.");
    } finally {
      setUpdatingAchievement("");
    }
  }

  async function saveStore() {
    if (!isEditing && draft.access_email && draft.access_password !== draft.access_password_confirmation) {
      setError("Las claves de acceso no coinciden.");
      setMessage("");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const path = isEditing ? `/api/admin/stores/${storeId}` : "/api/admin/stores";
      const method = isEditing ? "PATCH" : "POST";
      const data = await adminRequest(path, "", {
        method,
        body: JSON.stringify({
          ...draft,
          access_email: isEditing ? "" : draft.access_email,
          access_password: isEditing ? "" : draft.access_password,
          access_password_confirmation: isEditing ? "" : draft.access_password_confirmation,
          access_role: isEditing ? "owner" : draft.access_role,
          usd_to_bs: Number(draft.usd_to_bs || 600),
          monthly_price_usd: Number(draft.monthly_price_usd || 0),
          product_limit: Number(draft.product_limit || 30),
          service_fee_usd: Number(draft.service_fee_usd || 0),
          admin_delivery_provider: draft.admin_delivery_provider,
          admin_delivery_enabled: draft.admin_delivery_enabled,
          admin_pickup_enabled: draft.admin_pickup_enabled,
        }),
      });

      setMessage(data.message || (isEditing ? "Comercio actualizado." : "Comercio creado."));

      if (!isEditing && data.store?.id) {
        setCreatedStoreId(data.store.id);
        router.push(`/admin/comercios/${data.store.id}`);
      }
    } catch (error: any) {
      setError(error.message || "No se pudo guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  function buildSubscriptionPayload(source: StoreDraft) {
    return {
      plan_type: source.plan_type,
      service_fee_payer: source.service_fee_payer,
      subscription_status: source.subscription_status,
      trial_started_at: source.trial_started_at,
      trial_ends_at: source.trial_ends_at,
      subscription_started_at: source.subscription_started_at,
      subscription_ends_at: source.subscription_ends_at,
      next_payment_due_at: source.next_payment_due_at,
      monthly_price_usd: Number(source.monthly_price_usd || 0),
      product_limit: Number(source.product_limit || 30),
      service_fee_usd: Number(source.service_fee_usd || 0),
      billing_notes: source.billing_notes,
      last_payment_at: source.last_payment_at,
    };
  }

  async function saveSubscriptionDraft(source: StoreDraft, successMessage = "Suscripcion actualizada.") {
    if (!isEditing || !storeId) return;

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await adminRequest(`/api/admin/stores/${storeId}/subscription`, "", {
        method: "PATCH",
        body: JSON.stringify(buildSubscriptionPayload(source)),
      });

      if (
        source.subscription_status === "past_due" &&
        !["past_due", "expired"].includes(String(data.store?.subscription_status || ""))
      ) {
        throw new Error("Supabase no devolvio el comercio como vencido. Recarga y vuelve a intentar.");
      }

      setDraft((current) => ({
        ...mapStoreToDraft(data.store),
        admin_delivery_provider: current.admin_delivery_provider,
        admin_delivery_enabled: current.admin_delivery_enabled,
        admin_pickup_enabled: current.admin_pickup_enabled,
      }));
      setMessage(successMessage || data.message || "Suscripcion actualizada.");
    } catch (error: any) {
      setError(error.message || "No se pudo guardar la suscripcion.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSubscription() {
    await saveSubscriptionDraft(draft);
  }

  function startTrial(days = 15) {
    const today = todayDateInput();
    const endsAt = addDaysToDateInput(today, days);
    setDraft((current) => ({
      ...current,
      plan_type: "trial",
      subscription_status: "trial",
      trial_started_at: today,
      trial_ends_at: endsAt,
      subscription_started_at: "",
      subscription_ends_at: "",
      next_payment_due_at: endsAt,
      monthly_price_usd: "0",
    }));
  }

  function activateMonthly(days = 30) {
    const today = todayDateInput();
    const endsAt = addDaysToDateInput(today, days);
    setDraft((current) => ({
      ...current,
      plan_type: "monthly",
      subscription_status: "active",
      subscription_started_at: current.subscription_started_at || today,
      subscription_ends_at: endsAt,
      next_payment_due_at: endsAt,
      monthly_price_usd: "20",
      last_payment_at: today,
    }));
  }

  function activatePerService() {
    const today = todayDateInput();
    const endsAt = addDaysToDateInput(today, 30);
    setDraft((current) => ({
      ...current,
      plan_type: "per_service",
      subscription_status: "active",
      subscription_started_at: current.subscription_started_at || today,
      subscription_ends_at: endsAt,
      next_payment_due_at: endsAt,
      monthly_price_usd: PER_SERVICE_FEE_USD.toFixed(2),
      service_fee_payer: current.service_fee_payer || "merchant",
      last_payment_at: today,
    }));
  }

  async function markPastDue() {
    const yesterday = yesterdayDateInput();
    const nextDraft = {
      ...draft,
      subscription_status: "past_due",
      trial_ends_at: draft.plan_type === "trial" ? yesterday : draft.trial_ends_at,
      subscription_ends_at:
        draft.plan_type === "monthly" || draft.plan_type === "per_service"
          ? yesterday
          : draft.subscription_ends_at,
      next_payment_due_at: yesterday,
    };

    setDraft(nextDraft);

    if (isEditing && storeId) {
      await saveSubscriptionDraft(nextDraft, "Comercio marcado como vencido.");
    }
  }

  async function toggleActive() {
    if (!isEditing || !storeId) return;

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await adminRequest(
        `/api/admin/stores/${storeId}/${draft.is_active ? "pause" : "activate"}`,
        "",
        { method: "POST" }
      );

      setDraft((current) => ({
        ...mapStoreToDraft(data.store),
        admin_delivery_provider: current.admin_delivery_provider,
        admin_delivery_enabled: current.admin_delivery_enabled,
        admin_pickup_enabled: current.admin_pickup_enabled,
      }));
      setMessage(data.message || "Comercio actualizado.");
    } catch (error: any) {
      setError(error.message || "No se pudo actualizar el comercio.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteStorePermanently() {
    if (!isEditing || !storeId) return;

    const confirmed = window.confirm(
      `Vas a eliminar definitivamente "${draft.name}". Esta accion no se puede deshacer.`
    );

    if (!confirmed) return;

    setIsDeletingStore(true);
    setError("");
    setMessage("");

    try {
      const data = await adminRequest(`/api/admin/stores/${storeId}`, "", {
        method: "DELETE",
        body: JSON.stringify({ adminPassword: deletePassword }),
      });

      setMessage(data.message || "Comercio eliminado.");
      router.push("/admin/comercios");
    } catch (error: any) {
      setError(error.message || "No se pudo eliminar el comercio.");
    } finally {
      setIsDeletingStore(false);
    }
  }

  useEffect(() => {
    const savedToken = getSavedPanelToken();

    if (savedToken) {
      unlock();
    } else {
      setIsCheckingAccess(false);
    }
  }, [unlock]);

  if (isCheckingAccess) {
    return (
      <section className="rounded-[34px] bg-white p-6 text-center shadow-xl shadow-[#2E3A79]/[0.07]">
        <Loader2 size={22} className="mx-auto animate-spin text-[#25262B]" />
        <p className="mt-3 text-sm font-black text-[#746f69]">Validando acceso...</p>
      </section>
    );
  }

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#25262B] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso fundador</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesion con un email fundador para crear o editar comercios.
        </p>
        <a
          href="/panel/login"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
        >
          <CheckCircle2 size={18} />
          Iniciar sesion
        </a>
        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>
    );
  }

  const subscription = subscriptionSummary(draft);
  const primarySubscriptionDate = getPrimarySubscriptionDate(draft);
  const feePayerLabel =
    draft.service_fee_payer === "customer" ? "lo paga el cliente" : "lo asume el comercio";

  return (
    <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
            {isEditing ? `/${draft.slug}` : "Nuevo comercio"}
          </p>
          <h2 className="mt-1 text-3xl font-black">
            {isEditing ? draft.name || "Editar comercio" : "Crear comercio"}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {isEditing && draft.slug ? (
            <a
              href={`/${draft.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white"
            >
              <ExternalLink size={17} />
              Ver catalogo
            </a>
          ) : null}
          {isEditing ? (
            <button
              type="button"
              onClick={toggleActive}
              disabled={isSaving}
              className={[
                "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black disabled:opacity-60",
                draft.is_active ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700",
              ].join(" ")}
            >
              {draft.is_active ? <PauseCircle size={17} /> : <CheckCircle2 size={17} />}
              {draft.is_active ? "Pausar" : "Reactivar"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={saveStore}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
            Guardar
          </button>
        </div>
      </div>

      {isEditing ? (
        <section className="mt-6 rounded-[28px] bg-[#F3F5FF] p-4 ring-1 ring-[#2E3A79]/10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Funciones premium</p>
              <h3 className="mt-1 text-lg font-black text-[#25262B]">Pedidos en Mesa</h3>
              <p className="mt-1 text-sm font-bold text-[#746f69]">
                Super Admin controla qué comercios pueden configurar mesas y usar el QR.
              </p>
            </div>
            <label className="flex shrink-0 items-center gap-3 text-sm font-black text-[#25262B]">
              <input
                type="checkbox"
                checked={draft.table_orders_access_enabled}
                onChange={(event) => updateField("table_orders_access_enabled", event.target.checked)}
                className="h-5 w-5 accent-[#1F464C]"
              />
              Acceso habilitado
            </label>
          </div>
        </section>
      ) : null}

      {isEditing ? <section className="mt-6 rounded-[28px] bg-white p-4 ring-1 ring-[#25262B]/[0.08]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Control Super Admin</p>
          <h3 className="mt-1 text-xl font-black text-[#25262B]">Logros y recompensas</h3>
          <p className="mt-1 text-sm font-bold text-[#746f69]">Puedes habilitar o retirar una recompensa. Al retirarla, su progreso vuelve a cero y solo cuenta actividad nueva.</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {achievements.map((achievement) => <article key={achievement.key} className="rounded-[22px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
            <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-black text-[#25262B]">{achievement.title}</p><p className="mt-1 text-xs font-bold text-[#746f69]">{achievement.reward}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${achievement.unlocked ? "bg-green-100 text-green-700" : "bg-white text-[#746f69]"}`}>{achievement.unlocked ? achievement.source === "inherited" ? "Heredado" : achievement.source === "admin" ? "Admin" : "Logrado" : "Pendiente"}</span></div>
            <p className="mt-3 text-xs font-bold text-[#746f69]">{achievement.progress.detail || `${achievement.progress.current} de ${achievement.progress.target}`}</p>
            <button type="button" onClick={() => updateAchievement(achievement, achievement.unlocked ? "revoke" : "grant")} disabled={updatingAchievement === achievement.key} className={`mt-3 inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60 ${achievement.unlocked ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-[#2E3A79] text-white"}`}>{updatingAchievement === achievement.key ? "Actualizando..." : achievement.unlocked ? "Quitar recompensa" : "Habilitar manualmente"}</button>
          </article>)}
        </div>
      </section> : null}

      {isEditing && monthlyChallenges.length ? <section className="mt-6 rounded-[28px] bg-gradient-to-br from-[#FFF0C9] to-white p-4 ring-1 ring-[#FFB547]/40">
        <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#8A5700]">Campaña temporal</p><h3 className="mt-1 text-xl font-black text-[#25262B]">Retos de agosto</h3><p className="mt-1 text-sm font-bold text-[#746f69]">Puedes retirar o reactivar una recompensa mensual que el comercio ya haya ganado.</p></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {monthlyChallenges.map((challenge) => <article key={challenge.key} className="rounded-[22px] bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
            <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-black text-[#25262B]">{challenge.title}</p><p className="mt-1 text-xs font-bold text-[#746f69]">{challenge.reward}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${challenge.rewardStatus === "active" ? "bg-green-100 text-green-700" : challenge.rewardStatus === "revoked" ? "bg-red-50 text-red-700" : "bg-[#F8F3E8] text-[#746f69]"}`}>{challenge.rewardStatus === "active" ? "Ganada" : challenge.rewardStatus === "revoked" ? "Retirada" : "En progreso"}</span></div>
            <p className="mt-3 text-xs font-bold text-[#746f69]">{challenge.progress.detail || `${challenge.progress.current} de ${challenge.progress.target}`}</p>
            {challenge.rewardStatus ? <button type="button" onClick={() => updateMonthlyChallenge(challenge)} disabled={updatingAchievement === challenge.key} className={`mt-3 inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-xs font-black disabled:opacity-60 ${challenge.rewardStatus === "active" ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-[#2E3A79] text-white"}`}>{updatingAchievement === challenge.key ? "Actualizando..." : challenge.rewardStatus === "active" ? "Retirar recompensa" : "Reactivar recompensa"}</button> : null}
          </article>)}
        </div>
      </section> : null}

      <section className="mt-6 rounded-[28px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black">
              <CreditCard size={19} className="text-[#2E3A79]" />
              Plan y suscripcion
            </h3>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Vista simple para saber si el comercio puede operar y que falta por cobrar o aprobar.
            </p>
          </div>
          {isEditing ? (
            <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveSubscription}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25262B] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              Guardar suscripcion
            </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div className="rounded-[24px] bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
            <div className="flex flex-wrap items-center gap-2">
              <span className={["rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em]", subscription.badgeClass].join(" ")}>
                {subscription.label}
              </span>
              <span className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black text-[#746f69]">
                {planLabel(draft.plan_type)}
              </span>
            </div>
            <p className="mt-3 text-2xl font-black text-[#25262B]">{subscription.daysLabel}</p>
            <p className="mt-1 text-sm font-bold text-[#746f69]">{subscription.detail}</p>
          </div>
          <div className="rounded-[24px] bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Plan elegido</p>
            <p className="mt-2 text-lg font-black text-[#25262B]">{planLabel(draft.plan_type)}</p>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              {draft.plan_type === "per_service"
                ? `${formatAdminDate(primarySubscriptionDate)} - ${feePayerLabel}`
                : formatAdminDate(primarySubscriptionDate)}
            </p>
          </div>
          <div className="rounded-[24px] bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
              {draft.plan_type === "per_service" ? "Fee" : "Monto"}
            </p>
            <p className="mt-2 text-lg font-black text-[#25262B]">
              ${Number(draft.plan_type === "per_service" ? draft.service_fee_usd : draft.monthly_price_usd).toFixed(2)}
            </p>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              {draft.plan_type === "per_service" ? "por pedido recibido" : "mensual"}
            </p>
          </div>
          <div className="rounded-[24px] bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">Pago pendiente</p>
            <p className="mt-2 text-lg font-black text-[#25262B]">Revisar pagos</p>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Las referencias se aprueban en Suscripciones.
            </p>
            <Link href="/admin/suscripciones" className="mt-3 inline-flex rounded-full bg-[#2E3A79] px-4 py-2 text-xs font-black text-white">
              Abrir pagos
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => startTrial(15)}
            className="rounded-2xl bg-white px-4 py-3 text-left text-sm font-black text-[#25262B] ring-1 ring-[#25262B]/10"
          >
            Dar prueba 15 dias
            <span className="mt-1 block text-xs font-bold text-[#746f69]">Reinicia el periodo gratis.</span>
          </button>
          <button
            type="button"
            onClick={() => activateMonthly(30)}
            className="rounded-2xl bg-green-100 px-4 py-3 text-left text-sm font-black text-green-800"
          >
            Activar mensual 30 dias
            <span className="mt-1 block text-xs font-bold text-green-700">Usar despues de aprobar pago.</span>
          </button>
          <button
            type="button"
            onClick={activatePerService}
            className="rounded-2xl bg-[#2E3A79] px-4 py-3 text-left text-sm font-black text-white"
          >
            Activar fee por pedido
            <span className="mt-1 block text-xs font-bold text-white/75">Corte mensual automatico.</span>
          </button>
          <button
            type="button"
            onClick={markPastDue}
            disabled={isSaving}
            className="rounded-2xl bg-red-100 px-4 py-3 text-left text-sm font-black text-red-700"
          >
            Marcar vencido y guardar
            <span className="mt-1 block text-xs font-bold text-red-600">Bloquea de inmediato hasta elegir plan.</span>
          </button>
        </div>

        {draft.plan_type === "per_service" ? (
          <div className="mt-4 rounded-[24px] bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
            <p className="text-sm font-black text-[#25262B]">Quien paga el fee por pedido?</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => updateField("service_fee_payer", "merchant")}
                className={[
                  "rounded-2xl px-4 py-3 text-left text-sm font-black ring-1",
                  draft.service_fee_payer === "merchant"
                    ? "bg-[#2E3A79] text-white ring-[#2E3A79]"
                    : "bg-[#F8F3E8] text-[#25262B] ring-[#25262B]/10",
                ].join(" ")}
              >
                Lo asume el comercio
                <span className="mt-1 block text-xs font-bold opacity-75">No se muestra al cliente; se acumula al comercio.</span>
              </button>
              <button
                type="button"
                onClick={() => updateField("service_fee_payer", "customer")}
                className={[
                  "rounded-2xl px-4 py-3 text-left text-sm font-black ring-1",
                  draft.service_fee_payer === "customer"
                    ? "bg-[#2E3A79] text-white ring-[#2E3A79]"
                    : "bg-[#F8F3E8] text-[#25262B] ring-[#25262B]/10",
                ].join(" ")}
              >
                Lo paga el cliente
                <span className="mt-1 block text-xs font-bold opacity-75">Se suma al total del pedido.</span>
              </button>
            </div>
          </div>
        ) : null}

        <details className="mt-4 rounded-[24px] bg-white p-4 ring-1 ring-[#25262B]/[0.06]">
          <summary className="cursor-pointer text-sm font-black text-[#2E3A79]">
            Ajustes avanzados de fechas y cobro
          </summary>
        <div className="mt-4 grid gap-4 xl:grid-cols-4">
          <Field label="Plan">
            <select value={draft.plan_type} onChange={(event) => updateField("plan_type", event.target.value)} className={inputClass}>
              <option value="trial">Trial</option>
              <option value="monthly">Mensual $20 / tienda</option>
              <option value="per_service">{`Por servicio $${PER_SERVICE_FEE_USD.toFixed(2)}`}</option>
              {draft.is_test ? <option value="founder">Founder (solo prueba)</option> : null}
            </select>
          </Field>
          <Field label="Estado">
            <select value={draft.subscription_status} onChange={(event) => updateField("subscription_status", event.target.value)} className={inputClass}>
              <option value="trial">trial</option>
              <option value="active">active</option>
              <option value="past_due">past_due</option>
              <option value="paused">paused</option>
              <option value="cancelled">cancelled</option>
              <option value="expired">expired</option>
            </select>
          </Field>
          {draft.plan_type === "per_service" ? (
            <Field label="Fee por pedido USD">
              <input type="number" min="0" step="0.01" value={draft.service_fee_usd} onChange={(event) => updateField("service_fee_usd", event.target.value)} className={inputClass} disabled={draft.plan_type === "per_service"} />
            </Field>
          ) : (
            <Field label="Monto mensual USD">
              <input type="number" value={draft.monthly_price_usd} onChange={(event) => updateField("monthly_price_usd", event.target.value)} className={inputClass} />
            </Field>
          )}
          <Field label="Límite de productos">
            <input type="number" min="1" max="10000" step="1" value={draft.product_limit} onChange={(event) => updateField("product_limit", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Proximo cobro">
            <input type="date" value={draft.next_payment_due_at} onChange={(event) => updateField("next_payment_due_at", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Inicio trial">
            <input type="date" value={draft.trial_started_at} onChange={(event) => updateField("trial_started_at", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Fin trial">
            <input type="date" value={draft.trial_ends_at} onChange={(event) => updateField("trial_ends_at", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Fin suscripcion">
            <input type="date" value={draft.subscription_ends_at} onChange={(event) => updateField("subscription_ends_at", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Ultimo pago">
            <input type="date" value={draft.last_payment_at} onChange={(event) => updateField("last_payment_at", event.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Notas internas de facturacion">
          <textarea value={draft.billing_notes} onChange={(event) => updateField("billing_notes", event.target.value)} rows={2} className={inputClass} />
        </Field>
        </details>
      </section>

      {!isEditing ? (
        <section className="mt-5 rounded-[28px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
          <h3 className="text-lg font-black">Acceso del comercio</h3>
          <p className="mt-1 text-sm font-bold text-[#746f69]">
            Crea o asigna el usuario que entrara al panel privado de este negocio.
          </p>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Field label="Correo de acceso">
              <input value={draft.access_email} onChange={(event) => updateField("access_email", event.target.value)} type="email" placeholder="dueno@comercio.com" className={inputClass} />
            </Field>
            <Field label="Clave inicial">
              <input value={draft.access_password} onChange={(event) => updateField("access_password", event.target.value)} type="password" placeholder="Minimo 6 caracteres" className={inputClass} />
            </Field>
            <Field label="Confirmar clave">
              <input
                value={draft.access_password_confirmation}
                onChange={(event) => updateField("access_password_confirmation", event.target.value)}
                type="password"
                placeholder="Escribe la misma clave"
                className={inputClass}
              />
            </Field>
            <Field label="Rol de acceso">
              <select value={draft.access_role} onChange={(event) => updateField("access_role", event.target.value)} className={inputClass}>
                <option value="owner">Dueno</option>
                <option value="admin">Administrador</option>
                <option value="staff">Staff</option>
              </select>
            </Field>
          </div>
        </section>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Field label="Nombre del comercio">
          <input value={draft.name} onChange={(event) => updateField("name", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Slug publico">
          <input value={draft.slug} onChange={(event) => updateField("slug", event.target.value)} placeholder="mi-comercio" className={inputClass} />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Field label="Rubro">
          <select value={draft.business_type} onChange={(event) => updateField("business_type", event.target.value)} className={inputClass}>
            {BUSINESS_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="WhatsApp receptor">
          <input value={draft.whatsapp} onChange={(event) => updateField("whatsapp", event.target.value)} placeholder="584245666025" className={inputClass} />
        </Field>
        <Field label="Tasa USD a Bs">
          <input type="number" value={draft.usd_to_bs} onChange={(event) => updateField("usd_to_bs", event.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Descripcion">
          <textarea value={draft.description} onChange={(event) => updateField("description", event.target.value)} rows={3} className={inputClass} />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Field label="Ciudad">
          <select value={draft.city_id} onChange={(event) => updateField("city_id", event.target.value)} className={inputClass}>
            <option value="">Sin clasificar</option>
            {cities.map((city) => <option key={city.id} value={city.id}>{city.name}, {city.state_name}</option>)}
          </select>
        </Field>
        <div className="xl:col-span-3">
          <Field label="Direccion">
            <input value={draft.address} onChange={(event) => updateField("address", event.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Latitud">
          <input value={draft.latitude} onChange={(event) => updateField("latitude", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Longitud">
          <input value={draft.longitude} onChange={(event) => updateField("longitude", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Horario">
          <input value={draft.opening_hours} onChange={(event) => updateField("opening_hours", event.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Field label="Metodos de pago separados por coma">
          <input value={draft.payment_methods} onChange={(event) => updateField("payment_methods", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Nota interna WhatsApp">
          <input value={draft.whatsapp_message_note} onChange={(event) => updateField("whatsapp_message_note", event.target.value)} className={inputClass} />
        </Field>
      </div>

      <section className="mt-5 rounded-[28px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
        <h3 className="text-lg font-black">Identidad visual</h3>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {(["primary_color", "accent_color", "button_text_color"] as const).map((field) => (
            <Field
              key={field}
              label={
                field === "primary_color"
                  ? "Color principal"
                  : field === "accent_color"
                    ? "Color secundario"
                    : "Texto boton"
              }
            >
              <input type="color" value={draft[field]} onChange={(event) => updateField(field, event.target.value)} className="h-12 w-full rounded-2xl border border-[#25262B]/10 bg-white px-2 py-2 outline-none" />
            </Field>
          ))}
        </div>
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        {(["accepts_delivery", "accepts_pickup", "is_active", "is_test"] as const).map((field) => (
          <button
            key={field}
            type="button"
            onClick={() => updateField(field, !draft[field])}
            className={[
              "rounded-full px-4 py-2 text-xs font-black",
              draft[field] ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
            ].join(" ")}
          >
              {field === "accepts_delivery"
                ? draft[field] ? "Delivery activo" : "Delivery inactivo"
                : field === "accepts_pickup"
                  ? draft[field] ? "Retiro activo" : "Retiro inactivo"
                  : field === "is_test"
                    ? draft[field] ? "Cuenta de prueba" : "Cuenta real"
                    : draft[field] ? "Comercio activo" : "Comercio pausado"}
          </button>
        ))}
      </div>

      {isEditing ? (
        <section className="mt-5 rounded-[28px] bg-[#F8F3E8] p-4 ring-1 ring-[#25262B]/[0.06]">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <h3 className="text-lg font-black">Proveedor de delivery</h3>
              <p className="mt-1 text-sm font-bold leading-relaxed text-[#746f69]">
                Control fundador para conectar o desconectar apps reales como Entrega2 App.
                Si activas Entrega2, el checkout cotiza por API y el comercio envía el pedido
                desde Pedidos.
              </p>
            </div>
            <span
              className={[
                "rounded-full px-4 py-2 text-xs font-black",
                draft.admin_delivery_provider === "entrega2"
                  ? "bg-blue-100 text-blue-700"
                  : draft.admin_delivery_provider === "disabled"
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700",
              ].join(" ")}
            >
              {draft.admin_delivery_provider === "entrega2"
                ? "Entrega2 App activa"
                : draft.admin_delivery_provider === "disabled"
                  ? "Delivery desactivado"
                  : "Delivery propio / manual"}
            </span>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Field label="Fuente de delivery">
              <select
                value={draft.admin_delivery_provider}
                onChange={(event) => updateField("admin_delivery_provider", event.target.value)}
                className={inputClass}
              >
                <option value="disabled">Sin delivery</option>
                <option value="own_delivery">Delivery propio / zonas Somos</option>
                <option value="manual_quote">Cotizar manualmente</option>
                <option value="entrega2">Entrega2 App</option>
              </select>
            </Field>
            <Field label="Delivery visible en checkout">
              <select
                value={draft.admin_delivery_enabled ? "yes" : "no"}
                onChange={(event) => updateField("admin_delivery_enabled", event.target.value === "yes")}
                className={inputClass}
              >
                <option value="yes">Sí</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="Retiro / pickup visible">
              <select
                value={draft.admin_pickup_enabled ? "yes" : "no"}
                onChange={(event) => updateField("admin_pickup_enabled", event.target.value === "yes")}
                className={inputClass}
              >
                <option value="yes">Sí</option>
                <option value="no">No</option>
              </select>
            </Field>
          </div>

          {draft.admin_delivery_provider === "entrega2" ? (
            <p className="mt-3 rounded-2xl bg-blue-50 p-3 text-sm font-black leading-relaxed text-blue-800">
              Antes de probar Entrega2 App, este comercio debe tener latitud y longitud de
              retiro configuradas. Si la API falla, Somos usará la tarifa local de respaldo
              por rango de km cuando exista.
            </p>
          ) : null}
        </section>
      ) : null}

      {isEditing ? (
        <section className="mt-5 rounded-[28px] bg-red-50 p-4 ring-1 ring-red-100">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-lg font-black text-red-700">Zona peligrosa</h3>
              <p className="mt-1 text-sm font-bold text-red-700/80">
                El borrado definitivo elimina catálogo, pedidos, clientes, delivery y accesos vinculados.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[220px_auto]">
              <input
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                placeholder="Clave admin"
                className={inputClass}
              />
              <button
                type="button"
                onClick={deleteStorePermanently}
                disabled={isDeletingStore || !deletePassword}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {isDeletingStore ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                Eliminar definitivo
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {message && (
        <p className="mt-4 text-sm font-black text-green-700">
          {message}{" "}
          {createdStoreId && (
            <Link href={`/admin/comercios/${createdStoreId}`} className="text-[#2E3A79]">
              Abrir edicion
            </Link>
          )}
        </p>
      )}
      {error && <p className="mt-4 text-sm font-black text-red-600">{error}</p>}
    </section>
  );
}
