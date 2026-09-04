"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  LogOut,
  PlusCircle,
  RefreshCcw,
  Save,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import {
  clearPanelAuthStorage,
  getPanelAccessToken,
  getPanelAuthHeaders,
  getSavedPanelPin,
  savePanelToken,
} from "@/lib/panel/client-auth";
import { buildClientPublicUrl } from "@/lib/public-url";
import {
  findOverlappingDistanceRange,
  formatDistanceRange,
  normalizeDistanceRangeInput,
} from "@/lib/distance-ranges";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import { useTransportPanelDerivedData } from "@/components/transport/use-transport-panel-derived-data";
import {
  connectionEnded,
  connectionPendingExit,
  formatDateTime,
  panelNavItems,
  relationshipModeLabel,
  type Agency,
  type PanelCache,
  type PricingType,
} from "@/components/transport/transport-panel-helpers";
import { describeDistanceRangeFee } from "@/lib/delivery";
import {
  playNewOrderSound,
  unlockOrderNotificationSound,
} from "@/lib/panel/order-notification-sound";
import {
  NewOrderToast,
  type NewOrderToastData,
} from "@/components/panel/NewOrderToast";

const TransportOrdersTab = dynamic(() =>
  import("@/components/transport/TransportOrdersTab").then((module) => module.TransportOrdersTab)
);
const TransportBillingTab = dynamic(() =>
  import("@/components/transport/TransportBillingTab").then((module) => module.TransportBillingTab)
);
const TransportDriversTab = dynamic(() =>
  import("@/components/transport/TransportDriversTab").then((module) => module.TransportDriversTab)
);

let transportPanelCache: PanelCache | null = null;

function optionalPanelNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function mergeAgenciesPreservingPremium(previous: Agency[], next: Agency[]) {
  const previousById = new Map(previous.map((entry) => [entry.id, entry]));
  return next.map((entry) => ({
    ...previousById.get(entry.id),
    ...entry,
    premium_dispatch_enabled: Object.prototype.hasOwnProperty.call(
      entry,
      "premium_dispatch_enabled"
    )
      ? entry.premium_dispatch_enabled
      : previousById.get(entry.id)?.premium_dispatch_enabled,
    driver_whatsapp_dispatch_enabled: Object.prototype.hasOwnProperty.call(
      entry,
      "driver_whatsapp_dispatch_enabled"
    )
      ? entry.driver_whatsapp_dispatch_enabled
      : previousById.get(entry.id)?.driver_whatsapp_dispatch_enabled,
  }));
}

export function TransportAgencyPanel({ initialTab = "resumen" }: { initialTab?: string }) {
  const hasUsableInitialCache = Boolean(
    transportPanelCache?.hasSession && transportPanelCache.agencies?.length
  );
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState(initialTab);
  const [agencies, setAgencies] = useState<Agency[]>(
    hasUsableInitialCache ? transportPanelCache?.agencies || [] : []
  );
  const [serviceCities, setServiceCities] = useState<Array<{ id: string; name: string; state_name: string }>>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState("");
  const [requests, setRequests] = useState<any[]>(transportPanelCache?.requests || []);
  const [connections, setConnections] = useState<any[]>(transportPanelCache?.connections || []);
  const [billing, setBilling] = useState<any>(transportPanelCache?.billing || null);
  const [message, setMessage] = useState("");
  const [newOrderToast, setNewOrderToast] = useState<NewOrderToastData | null>(null);
  const [isLoading, setIsLoading] = useState(!hasUsableInitialCache);
  const [hasSession, setHasSession] = useState(Boolean(hasUsableInitialCache));
  const [hasCheckedSession, setHasCheckedSession] = useState(Boolean(hasUsableInitialCache));
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [pricingType, setPricingType] = useState<PricingType>("manual");
  const [zoneDraft, setZoneDraft] = useState({ name: "", description: "", feeUsd: "" });
  const [rangeDraft, setRangeDraft] = useState({ minKm: "", maxKm: "", feeUsd: "" });
  const [distanceSimulatorKm, setDistanceSimulatorKm] = useState("12");
  const [isRuleSaving, setIsRuleSaving] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isRatesSaving, setIsRatesSaving] = useState(false);
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [isBannerUploading, setIsBannerUploading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [transportOrders, setTransportOrders] = useState<any[]>([]);
  const [transportOrderStores, setTransportOrderStores] = useState<any[]>([]);
  const [transportOrderStatusFilter, setTransportOrderStatusFilter] = useState("all");
  const [transportOrderStoreFilter, setTransportOrderStoreFilter] = useState("all");
  const [transportOrderPeriod, setTransportOrderPeriod] = useState("today");
  const [isTransportOrdersLoading, setIsTransportOrdersLoading] = useState(false);
  const [transportOrderPage, setTransportOrderPage] = useState(1);
  const [transportOrdersHasMore, setTransportOrdersHasMore] = useState(false);
  const [savingTransportOrderId, setSavingTransportOrderId] = useState<string | null>(null);
  const [loadingTransportOrderDetailId, setLoadingTransportOrderDetailId] = useState<string | null>(null);
  const [transportDrivers, setTransportDrivers] = useState<any[]>([]);
  const [isTransportDriversLoading, setIsTransportDriversLoading] = useState(false);
  const [savingTransportDriverId, setSavingTransportDriverId] = useState<string | null>(null);
  const [transportDriversSchemaReady, setTransportDriversSchemaReady] = useState(true);
  const [hasLoadedTransportDrivers, setHasLoadedTransportDrivers] = useState(false);
  const [savingConnectionModeId, setSavingConnectionModeId] = useState<string | null>(null);
  const [requestRelationshipModes, setRequestRelationshipModes] = useState<Record<string, "exclusive" | "mixed">>({});
  const [marketplaceCopied, setMarketplaceCopied] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [hasLoadedRelations, setHasLoadedRelations] = useState(Boolean(hasUsableInitialCache));
  const [hasLoadedBillingDetail, setHasLoadedBillingDetail] = useState(
    Boolean(hasUsableInitialCache && transportPanelCache?.billingDetailLoaded)
  );
  const [hasLoadedConfiguration, setHasLoadedConfiguration] = useState(
    Boolean(hasUsableInitialCache && transportPanelCache?.configurationLoaded)
  );
  const transportOrdersLoadedRef = useRef(false);
  const localTransportMutationsRef = useRef(new Set<string>());
  const recentLocalTransportMutationsRef = useRef(new Map<string, number>());

  const agency =
    agencies.find((entry) => entry.id === selectedAgencyId) ||
    (["pedidos", "repartidores", "facturacion"].includes(tab)
      ? agencies.find((entry) => entry.premium_dispatch_enabled === true)
      : null) ||
    agencies[0] ||
    null;
  const agencyId = agency?.id || "";
  const agencyPricingType = agency?.pricing_type || "";
  const premiumDispatchEnabled = agency?.premium_dispatch_enabled === true;
  const driverWhatsappDispatchEnabled =
    agency?.driver_whatsapp_dispatch_enabled === true;
  const billingCurrency = agency?.billing_currency === "EUR" ? "EUR" : "USD";
  const billingSymbol = billingCurrency === "EUR" ? "€" : "$";
  const {
    activeConnectionsCount,
    configIssues,
    distanceRates,
    pendingRequests,
    rate,
    zones,
  } = useTransportPanelDerivedData({ agency, requests, connections, nowMs });
  const distanceFactorUsd = optionalPanelNumber(rate.distance_factor_usd);
  const simulatedDistanceKm = optionalPanelNumber(distanceSimulatorKm);
  const panelDistanceRates = useMemo(
    () =>
      distanceRates.map((entry) => ({
        id: String(entry.id),
        minKm: Number(entry.min_km || 0),
        maxKm:
          entry.max_km === null || entry.max_km === undefined || entry.max_km === ""
            ? null
            : Number(entry.max_km),
        feeUsd: Number(entry.fee_usd || 0),
        isActive: entry.is_active !== false,
        sortOrder: Number(entry.sort_order || 0),
      })),
    [distanceRates]
  );
  const lastFiniteDistanceRate = useMemo(
    () =>
      [...panelDistanceRates]
        .filter((entry) => entry.isActive && entry.maxKm !== null)
        .sort((a, b) => Number(b.maxKm || 0) - Number(a.maxKm || 0))[0] || null,
    [panelDistanceRates]
  );
  const distanceRangeGaps = useMemo(() => {
    const sorted = [...panelDistanceRates]
      .filter((entry) => entry.isActive)
      .sort((a, b) => a.minKm - b.minKm || a.sortOrder - b.sortOrder);
    const gaps: Array<{ from: number; to: number }> = [];

    for (let index = 1; index < sorted.length; index += 1) {
      const previousMax = sorted[index - 1]?.maxKm;
      const nextMin = sorted[index]?.minKm;
      if (
        previousMax !== null &&
        previousMax !== undefined &&
        nextMin - previousMax > 0.011
      ) {
        gaps.push({ from: previousMax, to: nextMin });
      }
    }

    return gaps;
  }, [panelDistanceRates]);
  const simulatorResult = useMemo(() => {
    if (simulatedDistanceKm === null) return null;
    return describeDistanceRangeFee({
      distanceKm: simulatedDistanceKm,
      rates: panelDistanceRates,
      distanceFactor: distanceFactorUsd,
    });
  }, [simulatedDistanceKm, panelDistanceRates, distanceFactorUsd]);
  const simulatorExceedsLastRange =
    simulatedDistanceKm !== null &&
    lastFiniteDistanceRate?.maxKm !== null &&
    lastFiniteDistanceRate?.maxKm !== undefined &&
    simulatedDistanceKm > lastFiniteDistanceRate.maxKm;

  async function authHeaders() {
    const savedPin = pin || getSavedPanelPin();
    return getPanelAuthHeaders(savedPin);
  }

  async function copyMarketplaceLink() {
    if (!agency?.slug) return;
    const url = buildClientPublicUrl(`/transporte/${agency.slug}/marketplace`);

    try {
      await navigator.clipboard.writeText(url);
      setMarketplaceCopied(true);
      window.setTimeout(() => setMarketplaceCopied(false), 2200);
    } catch {
      setMessage("No se pudo copiar el link del marketplace.");
    }
  }

  async function load(options: {
    silent?: boolean;
    includeBilling?: boolean;
    includeBillingDetail?: boolean;
    includeConfiguration?: boolean;
    includeRelations?: boolean;
  } = {}) {
    if (!options.silent && !transportPanelCache) setIsLoading(true);
    if (!options.silent) setMessage("");
    try {
      const savedPin = getSavedPanelPin();
      const token = await getPanelAccessToken();
      setHasSession(Boolean(token));
      setPin(savedPin);
      if (!savedPin && !token) {
        setMessage("Inicia sesion para entrar al panel de empresa delivery.");
        setHasCheckedSession(true);
        setIsLoading(false);
        return;
      }

      const includeBilling = options.includeBilling ?? ["resumen", "facturacion"].includes(tab);
      const includeRelations = options.includeRelations ?? tab !== "pedidos";
      const includeConfiguration = options.includeConfiguration ?? tab !== "pedidos";
      const includeBillingDetail = options.includeBillingDetail ?? tab === "facturacion";
      const params = new URLSearchParams({
        billingDetail: String(includeBillingDetail),
        includeBilling: String(includeBilling),
        includeConfiguration: String(includeConfiguration),
        includeRelations: String(includeRelations),
      });
      const response = await fetch(`/api/transport/me?${params.toString()}`, {
        headers: await getPanelAuthHeaders(savedPin),
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = data.error || "No se pudo cargar.";

        if (response.status === 401) {
          clearPanelAuthStorage();
          setHasSession(false);
          setAgencies([]);
          setRequests([]);
          setConnections([]);
          setBilling(null);
          setHasLoadedBillingDetail(false);
          setHasLoadedConfiguration(false);
          setHasLoadedRelations(false);
          transportPanelCache = null;
          setHasCheckedSession(true);
          setMessage("Sesion vencida o invalida. Inicia sesion como empresa delivery.");
          return;
        }

        if (response.status === 403) {
          setHasSession(false);
          setAgencies([]);
          setRequests([]);
          setConnections([]);
          setBilling(null);
          setHasLoadedBillingDetail(false);
          setHasLoadedConfiguration(false);
          setHasLoadedRelations(false);
          transportPanelCache = null;
          setHasCheckedSession(true);
          setMessage(`${detail} Entra con el correo asignado a la empresa delivery.`);
          return;
        }

        throw new Error(detail);
      }
      let nextAgencies: Agency[] = [];
      setAgencies((current) => {
        nextAgencies = mergeAgenciesPreservingPremium(current, data.agencies || []);
        return nextAgencies;
      });
      if (data.configurationLoaded) setServiceCities(data.cities || []);
      if (data.relationsLoaded) {
        setRequests(data.requests || []);
        setConnections(data.connections || []);
        setHasLoadedRelations(true);
      }
      if (data.billing) {
        setBilling(data.billing);
        if (data.billingDetailLoaded) setHasLoadedBillingDetail(true);
      }
      if (data.configurationLoaded) setHasLoadedConfiguration(true);
      setHasSession(true);
      setHasCheckedSession(true);
      transportPanelCache = {
        agencies: nextAgencies,
        requests: data.relationsLoaded ? data.requests || [] : transportPanelCache?.requests || [],
        connections: data.relationsLoaded ? data.connections || [] : transportPanelCache?.connections || [],
        billing: data.billing || transportPanelCache?.billing || null,
        billingDetailLoaded: Boolean(
          data.billingDetailLoaded || transportPanelCache?.billingDetailLoaded
        ),
        configurationLoaded: Boolean(
          data.configurationLoaded || transportPanelCache?.configurationLoaded
        ),
        hasSession: true,
      };
    } catch (error: any) {
      setMessage(error.message || "No se pudo cargar.");
    } finally {
      setHasCheckedSession(true);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const syncTabFromUrl = () => {
      const item = panelNavItems.find((entry) => entry.href === window.location.pathname);
      if (item) setTab(item.key);
    };
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, []);

  useEffect(() => {
    const unlock = () => void unlockOrderNotificationSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!agencies.length) {
      if (selectedAgencyId) setSelectedAgencyId("");
      return;
    }

    const currentStillExists = agencies.some((entry) => entry.id === selectedAgencyId);
    if (currentStillExists) return;

    const preferredAgency =
      ["pedidos", "repartidores", "facturacion"].includes(tab)
        ? agencies.find((entry) => entry.premium_dispatch_enabled === true)
        : null;
    setSelectedAgencyId((preferredAgency || agencies[0]).id);
  }, [agencies, selectedAgencyId, tab]);

  useEffect(() => {
    setNowMs(Date.now());
    load({
      silent: Boolean(transportPanelCache),
      includeBilling: ["resumen", "facturacion"].includes(initialTab),
      includeBillingDetail: initialTab === "facturacion",
      includeConfiguration: initialTab !== "pedidos",
      includeRelations: initialTab !== "pedidos",
    });
    // Initial boot only; later section loads are handled by the dependency-aware effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasSession) return;
    const needsBilling = tab === "facturacion" && !hasLoadedBillingDetail;
    const needsConfiguration = tab !== "pedidos" && !hasLoadedConfiguration;
    const needsRelations = tab !== "pedidos" && !hasLoadedRelations;
    if (needsBilling || needsConfiguration || needsRelations) {
      void load({
        silent: true,
        includeBilling: needsBilling,
        includeBillingDetail: needsBilling,
        includeConfiguration: needsConfiguration,
        includeRelations: needsRelations,
      });
    }
    // load intentionally follows the active authenticated panel state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab,
    hasSession,
    hasLoadedBillingDetail,
    hasLoadedConfiguration,
    hasLoadedRelations,
  ]);

  useEffect(() => {
    setTransportDrivers([]);
    setTransportOrders([]);
    setTransportOrderStores([]);
    setTransportOrderPage(1);
    setTransportOrdersHasMore(false);
    setHasLoadedTransportDrivers(false);
    setHasLoadedBillingDetail(false);
    setHasUnsavedChanges(false);
  }, [selectedAgencyId]);

  async function loadTransportOrders(overrides: Record<string, string> = {}) {
    setIsTransportOrdersLoading(true);
    setMessage("");
    try {
      const page = Number(overrides.page || 1);
      const append = overrides.append === "true";
      const params = new URLSearchParams({
        period: overrides.period || transportOrderPeriod,
        status: overrides.status || transportOrderStatusFilter,
        agencyId,
        page: String(page),
        limit: "40",
      });
      const storeId = overrides.storeId || transportOrderStoreFilter;
      if (storeId && storeId !== "all") params.set("storeId", storeId);

      const response = await fetch(`/api/transport/panel/orders?${params.toString()}`, {
        headers: await authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar pedidos.");
      const nextOrders = data.orders || [];
      const shouldNotifyNew = overrides.notifyNew === "true" && !append;
      setTransportOrders((current) => {
        if (shouldNotifyNew && transportOrdersLoadedRef.current) {
          const currentIds = new Set(current.map((order) => order.id));
          const newOrder = nextOrders.find((order: any) => order?.id && !currentIds.has(order.id));
          if (newOrder) {
            void playNewOrderSound();
            setNewOrderToast({
              id: `${newOrder.id}-${Date.now()}`,
              title: newOrder.orders?.public_code || newOrder.order_id?.slice(0, 8) || "Servicio recibido",
              subtitle: [
                newOrder.store_name_snapshot || newOrder.stores?.name || "Comercio",
                newOrder.customer_name_snapshot || "Cliente",
              ].filter(Boolean).join(" · "),
            });
          }
        }

        if (append) {
          const seen = new Set(current.map((order) => order.id));
          return [...current, ...nextOrders.filter((order: any) => !seen.has(order.id))];
        }

        return nextOrders;
      });
      transportOrdersLoadedRef.current = true;
      setTransportOrderStores(data.stores || []);
      setTransportOrderPage(page);
      setTransportOrdersHasMore(Boolean(data.pagination?.hasMore));
    } catch (error: any) {
      setMessage(error.message || "No se pudieron cargar pedidos.");
    } finally {
      setIsTransportOrdersLoading(false);
    }
  }

  async function loadTransportDrivers() {
    if (!agencyId) return;
    setIsTransportDriversLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ agencyId });
      const response = await fetch(`/api/transport/panel/drivers?${params.toString()}`, {
        headers: await authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar repartidores.");
      setTransportDrivers(data.drivers || []);
      setTransportDriversSchemaReady(data.schemaReady !== false);
      if (data.premiumDispatchEnabled === true) {
        setAgencies((current) =>
          current.map((entry) =>
            entry.id === (data.agencyId || agencyId)
              ? { ...entry, premium_dispatch_enabled: true }
              : entry
          )
        );
      }
      setHasLoadedTransportDrivers(true);
    } catch (error: any) {
      setMessage(error.message || "No se pudieron cargar repartidores.");
    } finally {
      setIsTransportDriversLoading(false);
    }
  }

  async function loadTransportOrderDetail(orderId: string) {
    if (!agencyId) return;
    setLoadingTransportOrderDetailId(orderId);
    setMessage("");
    try {
      const response = await fetch(`/api/transport/panel/orders/${orderId}`, {
        headers: await authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el detalle del pedido.");
      setTransportOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                ...(data.order || {}),
                __detailsLoaded: true,
              }
            : order
        )
      );
    } catch (error: any) {
      setMessage(error.message || "No se pudo cargar el detalle del pedido.");
    } finally {
      setLoadingTransportOrderDetailId(null);
    }
  }

  useEffect(() => {
    if (tab === "pedidos" && hasSession && agencyId) {
      loadTransportOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hasSession, agencyId]);

  useEffect(() => {
    if (!hasSession || !agencyId) return;
    if (!["pedidos", "repartidores", "facturacion"].includes(tab)) return;
    if (hasLoadedTransportDrivers) return;
    void loadTransportDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hasSession, agencyId, hasLoadedTransportDrivers]);

  useEffect(() => {
    if (tab !== "pedidos" || !hasSession || !agencyId) return;

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;
    let refreshTimer: number | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refreshOrders = (message?: { payload?: Record<string, unknown> }) => {
      if (!active || document.visibilityState !== "visible") return;
      const changedOrderId = String(message?.payload?.transport_order_id || "");
      const ignoredUntil = recentLocalTransportMutationsRef.current.get(changedOrderId) || 0;
      if (
        changedOrderId &&
        (localTransportMutationsRef.current.has(changedOrderId) || ignoredUntil > Date.now())
      ) {
        return;
      }
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadTransportOrders({ notifyNew: "true" }), 300);
    };

    void (async () => {
      const accessToken = await getPanelAccessToken();
      if (!active || !accessToken) return;

      await supabase.realtime.setAuth(accessToken);
      channel = supabase
        .channel(`agency:${agencyId}:transport-orders`, { config: { private: true } })
        .on("broadcast", { event: "transport_order_changed" }, refreshOrders)
        .subscribe();
    })();

    return () => {
      active = false;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      if (channel) void supabase.removeChannel(channel);
    };
    // Broadcast invalidates the protected API view; it never carries order details.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hasSession, agencyId, transportOrderPeriod, transportOrderStatusFilter, transportOrderStoreFilter]);

  useEffect(() => {
    if (!newOrderToast) return;
    const timer = window.setTimeout(() => setNewOrderToast(null), 8000);
    return () => window.clearTimeout(timer);
  }, [newOrderToast]);

  useEffect(() => {
    if (tab !== "pedidos" || !hasSession || !agencyId) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadTransportOrders({ notifyNew: "true" });
    }, 180_000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hasSession, agencyId, transportOrderPeriod, transportOrderStatusFilter, transportOrderStoreFilter]);

  useEffect(() => {
    if (!agencyId) return;
    const nextType = ["flat", "distance_ranges", "zones", "manual"].includes(agencyPricingType)
      ? (agencyPricingType as PricingType)
      : "manual";
    setPricingType(nextType);
  }, [agencyId, agencyPricingType]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  function markDirty() {
    setHasUnsavedChanges(true);
  }

  function confirmNavigation() {
    if (!hasUnsavedChanges) return true;
    return window.confirm("Tienes cambios sin guardar. Deseas salir sin guardar?");
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoggingIn(true);
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();

      if (!supabase) {
        setMessage("El inicio de sesion no esta disponible en este momento.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        if ((error.message || "").toLowerCase().includes("email not confirmed")) {
          setMessage("Tu acceso ya existe, pero falta confirmar el correo. Si ya fuiste aprobado por Somos, pide al admin reactivar/aprobar tu empresa para liberar el acceso.");
          return;
        }
        setMessage(error.message || "Correo o clave incorrectos.");
        return;
      }

      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setMessage("No se pudo obtener la sesion.");
        return;
      }

      savePanelToken(accessToken);
      setHasSession(true);
      await load();
    } catch (error: any) {
      setMessage(error.message || "No se pudo iniciar sesion.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function logout() {
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    await supabase?.auth.signOut();
    clearPanelAuthStorage();
    setAgencies([]);
    setRequests([]);
    setConnections([]);
    setBilling(null);
    setHasLoadedBillingDetail(false);
    setHasLoadedConfiguration(false);
    setHasLoadedRelations(false);
    transportPanelCache = null;
    setHasSession(false);
    setLoginPassword("");
    setMessage("Sesion cerrada.");
  }

  async function saveRates(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agency) return;
    const form = new FormData(event.currentTarget);
    const submittedMaxDistanceKm = optionalPanelNumber(form.get("maxDistanceKm"));
    const submittedDistanceFactorUsd = optionalPanelNumber(form.get("distanceFactorUsd"));

    if (pricingType === "distance_ranges") {
      if (!distanceRates.length) {
        setMessage("Agrega al menos un rango de kilometros antes de guardar esta modalidad.");
        return;
      }
      if (
        submittedMaxDistanceKm !== null &&
        lastFiniteDistanceRate?.maxKm !== null &&
        lastFiniteDistanceRate?.maxKm !== undefined &&
        submittedMaxDistanceKm > lastFiniteDistanceRate.maxKm &&
        submittedDistanceFactorUsd === null
      ) {
        setMessage(
          `Tu cobertura llega a ${submittedMaxDistanceKm} km, pero el ultimo rango termina en ${lastFiniteDistanceRate.maxKm} km. Agrega el precio por km adicional o ajusta la cobertura.`
        );
        return;
      }
    }

    setIsRatesSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/transport/agencies/${agency.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          action: "rates",
          pricingType,
          flatFeeUsd: form.get("flatFeeUsd"),
          maxDistanceKm: form.get("maxDistanceKm"),
          distanceFactorUsd: form.get("distanceFactorUsd"),
          manualQuoteMessage: form.get("manualQuoteMessage"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar.");
      setHasUnsavedChanges(false);
      setMessage(
        data.configIssues?.length
          ? `Tarifas guardadas. Aun falta: ${data.configIssues.join(", ")}.`
          : "Tarifas guardadas. Tu empresa esta lista para mostrarse a comercios cuando este activa."
      );
      await load();
    } catch (error: any) {
      setMessage(error.message || "No se pudo guardar la configuracion de tarifas.");
    } finally {
      setIsRatesSaving(false);
    }
  }

  async function createRule(type: "zone" | "distance_rate") {
    if (!agency) return;
    setIsRuleSaving(true);
    setMessage("");

    if (type === "distance_rate") {
      const normalized = normalizeDistanceRangeInput({
        minKm: rangeDraft.minKm,
        maxKm: rangeDraft.maxKm,
      });
      const conflict =
        normalized.range &&
        findOverlappingDistanceRange({
          candidate: normalized.range,
          ranges: distanceRates,
        });

      if (normalized.error || conflict) {
        setMessage(
          normalized.error ||
            `Ese rango se cruza con ${formatDistanceRange(conflict!)}. Ajusta los kilometros para que no se solapen.`
        );
        setIsRuleSaving(false);
        return;
      }
    }

    const payload =
      type === "zone"
        ? {
            type,
            name: zoneDraft.name,
            description: zoneDraft.description,
            feeUsd: zoneDraft.feeUsd,
            sortOrder: zones.length + 1,
          }
        : {
            type,
            minKm: rangeDraft.minKm,
            maxKm: rangeDraft.maxKm,
            feeUsd: rangeDraft.feeUsd,
            sortOrder: distanceRates.length + 1,
          };

    try {
      const response = await fetch(`/api/transport/agencies/${agency.id}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear la regla.");

      if (type === "zone") setZoneDraft({ name: "", description: "", feeUsd: "" });
      else setRangeDraft({ minKm: "", maxKm: "", feeUsd: "" });
      setHasUnsavedChanges(false);
      setMessage(type === "zone" ? "Zona agregada." : "Rango agregado.");
      load();
    } catch (error: any) {
      setMessage(error.message || "No se pudo crear la regla.");
    } finally {
      setIsRuleSaving(false);
    }
  }

  async function deleteRule(type: "zone" | "distance_rate", id: string) {
    if (!agency) return;
    setIsRuleSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/transport/agencies/${agency.id}/rules`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ type, id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar.");
      setMessage("Regla eliminada.");
      load();
    } catch (error: any) {
      setMessage(error.message || "No se pudo eliminar.");
    } finally {
      setIsRuleSaving(false);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agency) return;
    const form = new FormData(event.currentTarget);
    setIsProfileSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/transport/agencies/${agency.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          action: "profile",
          name: form.get("name"),
          legalName: agency.legal_name || "",
          rif: agency.rif || "",
          contactName: form.get("contactName"),
          contactEmail: form.get("contactEmail"),
          contactPhone: form.get("contactPhone"),
          whatsappPhone: form.get("whatsappPhone"),
          baseCityId: form.get("baseCityId"),
          coverageCityIds: form.getAll("coverageCityIds"),
          coverageNotes: form.get("coverageNotes"),
          logoUrl: agency.logo_url || "",
          modality: form.get("modality"),
          ratesVisibility: form.get("ratesVisibility"),
          pricingType: agency.pricing_type || "manual",
          capacityDimensionsCm: form.get("capacityDimensionsCm"),
          capacityWeightKg: form.get("capacityWeightKg"),
          maxWaitTimeMinutes: form.get("maxWaitTimeMinutes"),
          chargesCashReturn: form.get("chargesCashReturn") === "on",
          cashReturnFeeUsd: form.get("cashReturnFeeUsd"),
          billingCurrency: form.get("billingCurrency"),
          paymentTerms: form.get("paymentTerms"),
          creditTerms: form.get("creditTerms"),
          additionalConditions: form.get("additionalConditions"),
          driverWhatsappDispatchEnabled: form.get("driverWhatsappDispatchEnabled") === "on",
          marketplacePrimaryColor: form.get("marketplacePrimaryColor"),
          marketplaceAccentColor: form.get("marketplaceAccentColor"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la configuracion.");
      if (data.agency) {
        setAgencies((current) => {
          const nextAgencies = current.map((entry) =>
            entry.id === data.agency.id ? { ...entry, ...data.agency } : entry
          );
          if (!nextAgencies.some((entry) => entry.id === data.agency.id)) {
            nextAgencies.push(data.agency);
          }
          transportPanelCache = transportPanelCache
            ? { ...transportPanelCache, agencies: nextAgencies }
            : transportPanelCache;
          return nextAgencies;
        });
      }
      setHasUnsavedChanges(false);
      setMessage("Configuracion guardada.");
    } catch (error: any) {
      setMessage(error.message || "No se pudo guardar la configuracion.");
    } finally {
      setIsProfileSaving(false);
    }
  }

  async function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!agency || !file) return;
    setIsLogoUploading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const response = await fetch(`/api/transport/agencies/${agency.id}/logo`, {
        method: "POST",
        headers: await authHeaders(),
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo subir el logo.");
      setMessage("Logo actualizado.");
      load();
    } catch (error: any) {
      setMessage(error.message || "No se pudo subir el logo.");
    } finally {
      setIsLogoUploading(false);
      event.currentTarget.value = "";
    }
  }

  async function uploadBanner(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!agency || !file) return;
    setIsBannerUploading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("banner", file);

      const response = await fetch(`/api/transport/agencies/${agency.id}/banner`, {
        method: "POST",
        headers: await authHeaders(),
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo subir el banner.");
      setMessage("Banner del marketplace actualizado.");
      load();
    } catch (error: any) {
      setMessage(error.message || "No se pudo subir el banner.");
    } finally {
      setIsBannerUploading(false);
      event.currentTarget.value = "";
    }
  }

  async function reviewRequest(requestId: string, action: "approve" | "reject") {
    const relationshipMode = requestRelationshipModes[requestId] || (agency?.modality === "exclusive" ? "exclusive" : "mixed");
    const response = await fetch(`/api/transport/requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ action, relationshipMode }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "No se pudo actualizar.");
      return;
    }
    setMessage(data.message || (action === "approve" ? "Solicitud aprobada." : "Solicitud rechazada."));
    load();
  }

  async function updateConnectionMode(connectionId: string, relationshipMode: "exclusive" | "mixed") {
    setSavingConnectionModeId(connectionId);
    setMessage("");

    try {
      const response = await fetch(`/api/transport/connections/${connectionId}/mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ relationshipMode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo cambiar la modalidad.");
      setMessage(data.message || "Modalidad actualizada.");
      await load();
    } catch (error: any) {
      setMessage(error.message || "No se pudo cambiar la modalidad.");
    } finally {
      setSavingConnectionModeId(null);
    }
  }

  async function disengageConnection(connectionId: string, action: "request" | "confirm") {
    const prompt =
      action === "confirm"
        ? "Confirmar desafiliacion solicitada por el comercio? La salida se ejecutara al confirmar ambas partes."
        : "Solicitar desafiliacion de este comercio? La salida se ejecutara cuando el comercio tambien confirme.";

    if (!window.confirm(prompt)) return;

    setMessage("");
    const response = await fetch(`/api/transport/connections/${connectionId}/disengage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ action }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "No se pudo gestionar la desafiliacion.");
      return;
    }
    setMessage(data.message || "Desafiliacion confirmada.");
    load();
  }

  async function updateTransportOrderStatus(orderId: string, status: string, note = "") {
    setSavingTransportOrderId(orderId);
    localTransportMutationsRef.current.add(orderId);
    setMessage("");

    try {
      const response = await fetch(`/api/transport/panel/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ status, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar el estado.");
      setTransportOrders((current) =>
        current
          .map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  ...(data.order || {}),
                  status,
                }
              : order
          )
          .filter((order) => {
            if (transportOrderStatusFilter === "all") return true;
            if (transportOrderStatusFilter === "pending") {
              return ["sent_to_agency", "agency_received", "pending_agency"].includes(order.status);
            }
            return order.status === transportOrderStatusFilter;
          })
      );
      setMessage("Estado actualizado.");
    } catch (error: any) {
      setMessage(error.message || "No se pudo actualizar el estado.");
    } finally {
      recentLocalTransportMutationsRef.current.set(orderId, Date.now() + 2_000);
      localTransportMutationsRef.current.delete(orderId);
      window.setTimeout(() => recentLocalTransportMutationsRef.current.delete(orderId), 2_100);
      setSavingTransportOrderId(null);
    }
  }

  async function createTransportDriver(draft: any) {
    setSavingTransportDriverId("new");
    setMessage("");
    try {
      const response = await fetch("/api/transport/panel/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ ...draft, agencyId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear el repartidor.");
      setTransportDrivers((current) => [...current, data.driver].filter(Boolean));
      setMessage("Repartidor creado.");
    } catch (error: any) {
      setMessage(error.message || "No se pudo crear el repartidor.");
    } finally {
      setSavingTransportDriverId(null);
    }
  }

  async function updateTransportDriver(driverId: string, draft: any) {
    setSavingTransportDriverId(driverId);
    setMessage("");
    try {
      const response = await fetch("/api/transport/panel/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ ...draft, id: driverId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar el repartidor.");
      setTransportDrivers((current) =>
        current.map((driver) => (driver.id === driverId ? data.driver || driver : driver))
      );
      setMessage("Repartidor actualizado.");
    } catch (error: any) {
      setMessage(error.message || "No se pudo actualizar el repartidor.");
    } finally {
      setSavingTransportDriverId(null);
    }
  }

  async function assignTransportOrderDriver(orderId: string, driverId: string) {
    setSavingTransportOrderId(orderId);
    localTransportMutationsRef.current.add(orderId);
    setMessage("");

    try {
      const response = await fetch(`/api/transport/panel/orders/${orderId}/driver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ driverId: driverId || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo asignar el repartidor.");
      setTransportOrders((current) =>
        current.map((order) => (order.id === orderId ? { ...order, ...(data.order || {}) } : order))
      );
      setMessage(driverId ? "Repartidor asignado." : "Repartidor removido.");
    } catch (error: any) {
      setMessage(error.message || "No se pudo asignar el repartidor.");
    } finally {
      recentLocalTransportMutationsRef.current.set(orderId, Date.now() + 2_000);
      localTransportMutationsRef.current.delete(orderId);
      window.setTimeout(() => recentLocalTransportMutationsRef.current.delete(orderId), 2_100);
      setSavingTransportOrderId(null);
    }
  }

  const totals = useMemo(() => {
    const orders = billing?.orders || [];
    return {
      orders: orders.length,
      usd: Number(billing?.totalUsd || 0),
    };
  }, [billing]);

  if (isLoading || !hasCheckedSession || (hasSession && !agency)) {
    return <div className="rounded-[32px] bg-white p-6 font-black">Cargando empresa delivery...</div>;
  }

  if (!agency) {
    return (
      <section className="rounded-[32px] bg-white p-6 shadow-xl shadow-[#25262B]/10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2E3A79] text-[#FFB547]">
          <Truck size={28} />
        </div>
        <h1 className="mt-4 text-center text-2xl font-black">
          {hasSession ? "Sin empresa delivery vinculada" : "Iniciar sesion empresa delivery"}
        </h1>
        <p className="mt-2 text-center text-sm font-bold text-[#746f69]">
          {hasSession
            ? message || "Cuando Somos active tu empresa delivery, podras entrar con el correo registrado."
            : "Entra con el correo y clave asignados a tu empresa delivery. Si vienes del panel comercio, usa aqui el acceso de la empresa delivery."}
        </p>

        {!hasSession ? (
          <form onSubmit={login} className="mx-auto mt-5 max-w-md space-y-3 text-left">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Correo de empresa delivery
              </span>
              <input
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                type="email"
                placeholder="correo@empresa.com"
                className="mt-1 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
                Clave
              </span>
              <span className="relative mt-1 block">
                <input
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="Tu clave"
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 pr-12 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#746f69] hover:bg-[#F8F3E8] hover:text-[#2E3A79]"
                  aria-label={showLoginPassword ? "Ocultar clave" : "Mostrar clave"}
                >
                  {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60"
            >
              {isLoggingIn ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              Entrar como empresa delivery
            </button>
          </form>
        ) : null}

        {message ? <p className="mt-3 text-center text-sm font-black text-red-600">{message}</p> : null}

        <Link
          href="/transporte/registro"
          className="mx-auto mt-5 flex w-fit rounded-full bg-[#F8F3E8] px-5 py-3 text-sm font-black text-[#2E3A79]"
        >
          Registrar empresa delivery
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <NewOrderToast notification={newOrderToast} onClose={() => setNewOrderToast(null)} />
      <section className="rounded-[34px] bg-[#25262B] p-5 text-white shadow-xl shadow-[#25262B]/20">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
              Panel de empresa delivery
            </p>
            <div className="mt-2 flex items-center gap-3">
              {agency.logo_url ? (
                <OptimizedImage
                  src={agency.logo_url}
                  alt={agency.name}
                  width={56}
                  height={56}
                  sizes="56px"
                  className="h-14 w-14 rounded-2xl bg-white object-cover"
                  fallback={
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-sm font-black text-[#2E3A79]">
                      {agency.name.slice(0, 1).toUpperCase()}
                    </div>
                  }
                />
              ) : null}
              <h1 className="text-3xl font-black">{agency.name}</h1>
            </div>
            <p className="mt-2 text-sm font-semibold text-white/70">
              Estado: {agency.status} · Modalidad: {agency.modality}
            </p>
            {agencies.length > 1 ? (
              <label className="mt-4 block max-w-sm">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-white/60">
                  Empresa activa
                </span>
                <select
                  value={agency.id}
                  onChange={(event) => setSelectedAgencyId(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-black text-[#25262B] outline-none focus:border-[#FFB547]"
                >
                  {agencies.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                      {entry.premium_dispatch_enabled ? " · Premium" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {agency?.slug ? (
              <>
                <Link
                  href={`/transporte/${agency.slug}/marketplace`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-black text-white"
                >
                  <Eye size={16} />
                  Ver marketplace
                </Link>
                <button
                  type="button"
                  onClick={copyMarketplaceLink}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#2E3A79]"
                >
                  <Copy size={16} />
                  {marketplaceCopied ? "Link copiado" : "Copiar link"}
                </button>
              </>
            ) : null}
            <button
              onClick={async () => {
                await load();
                if (tab === "pedidos") await loadTransportOrders();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
            >
              <RefreshCcw size={16} />
              Actualizar
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-black text-white"
            >
              <LogOut size={16} />
              Cerrar sesion
            </button>
          </div>
        </div>
      </section>

      <nav className="grid grid-cols-2 gap-2 md:grid-cols-7" aria-label="Secciones de empresa delivery">
        {panelNavItems.map((item) => (
          <button
            type="button"
            key={item.key}
            onClick={() => {
              if (!confirmNavigation()) {
                return;
              }
              setHasUnsavedChanges(false);
              setTab(item.key);
              window.history.pushState({}, "", item.href);
            }}
            className={[
              "rounded-2xl px-3 py-3 text-center text-xs font-black",
              tab === item.key ? "bg-[#2E3A79] text-white" : "bg-white text-[#746f69]",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {hasUnsavedChanges ? (
        <section className="rounded-[28px] bg-[#FFF7DF] p-4 text-[#6A4A00] ring-1 ring-[#FFB547]/40">
          <h2 className="text-sm font-black">Cambios sin guardar</h2>
          <p className="mt-1 text-sm font-bold">
            Guarda antes de salir de esta seccion para que la configuracion quede aplicada.
          </p>
        </section>
      ) : null}

      {hasLoadedConfiguration && configIssues.length ? (
        <section className="rounded-[28px] bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
          <h2 className="text-sm font-black">Completa tu empresa para aparecer ante comercios</h2>
          <p className="mt-1 text-sm font-bold leading-relaxed">
            Falta: {configIssues.join(", ")}. Cuando estos datos esten listos y el estado este activo,
            los comercios podran ver y solicitar afiliacion sin errores.
          </p>
        </section>
      ) : hasLoadedConfiguration ? (
        <section className="rounded-[28px] bg-green-50 p-4 text-green-800 ring-1 ring-green-200">
          <h2 className="text-sm font-black">Configuracion operativa completa</h2>
          <p className="mt-1 text-sm font-bold">
            Tus datos, cobertura y tarifas tienen lo necesario para operar.
          </p>
        </section>
      ) : null}

      {tab === "resumen" ? (
        <section className="grid gap-3 md:grid-cols-3">
          <Metric label="Solicitudes pendientes" value={pendingRequests.length} />
          <Metric label="Comercios activos" value={activeConnectionsCount} />
          <Metric label="Delivery semana" value={`${billingSymbol}${totals.usd.toFixed(2)}`} />
        </section>
      ) : null}

      {tab === "pedidos" ? (
        <TransportOrdersTab
          billingSymbol={billingSymbol}
          drivers={transportDrivers}
          hasMore={transportOrdersHasMore}
          isLoading={isTransportOrdersLoading}
          loadingDetailOrderId={loadingTransportOrderDetailId}
          loadOrders={loadTransportOrders}
          onLoadOrderDetail={loadTransportOrderDetail}
          onAssignDriver={assignTransportOrderDriver}
          driverWhatsappDispatchEnabled={driverWhatsappDispatchEnabled}
          onPeriodChange={(value) => {
            setTransportOrderPeriod(value);
            void loadTransportOrders({ period: value });
          }}
          onStatusChange={(value) => {
            setTransportOrderStatusFilter(value);
            void loadTransportOrders({ status: value });
          }}
          onStoreChange={(value) => {
            setTransportOrderStoreFilter(value);
            void loadTransportOrders({ storeId: value });
          }}
          onUpdateStatus={updateTransportOrderStatus}
          orders={transportOrders}
          page={transportOrderPage}
          period={transportOrderPeriod}
          savingOrderId={savingTransportOrderId}
          statusFilter={transportOrderStatusFilter}
          storeFilter={transportOrderStoreFilter}
          stores={transportOrderStores}
          premiumDispatchEnabled={premiumDispatchEnabled}
        />
      ) : null}

      {tab === "repartidores" ? (
        <TransportDriversTab
          drivers={transportDrivers}
          isLoading={isTransportDriversLoading}
          onCreateDriver={createTransportDriver}
          onRefresh={loadTransportDrivers}
          onUpdateDriver={updateTransportDriver}
          premiumDispatchEnabled={premiumDispatchEnabled}
          savingDriverId={savingTransportDriverId}
          schemaReady={transportDriversSchemaReady}
        />
      ) : null}

      {tab === "tarifas" ? (
        <section className="space-y-4">
          <form
            key={`rates-${agency.id}`}
            onSubmit={saveRates}
            onChangeCapture={markDirty}
            className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10"
          >
            <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Forma de cobrar
                </span>
                <select
                  value={pricingType}
                  onChange={(event) => {
                    markDirty();
                    setPricingType(event.target.value as PricingType);
                  }}
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
                >
                  <option value="flat">Tarifa plana</option>
                  <option value="distance_ranges">Por rangos de km</option>
                  <option value="zones">Por zonas</option>
                  <option value="manual">Cotizar por WhatsApp</option>
                </select>
              </label>
              <Input
                name="maxDistanceKm"
                label="KM maximo de cobertura total"
                defaultValue={rate.max_distance_km}
                required
              />
            </div>

            {pricingType === "flat" ? (
              <div className="mt-4 rounded-3xl bg-[#F8F3E8] p-4">
                <h3 className="text-sm font-black">Tarifa plana</h3>
                <p className="mt-1 text-xs font-bold text-[#746f69]">
                  Se cobra un monto fijo siempre que la direccion este dentro del KM maximo de cobertura.
                </p>
                <div className="mt-3 max-w-xs">
                  <Input name="flatFeeUsd" label={`Monto delivery ${billingCurrency}`} defaultValue={rate.flat_fee_usd} />
                </div>
              </div>
            ) : (
              <input type="hidden" name="flatFeeUsd" value={rate.flat_fee_usd ?? 0} />
            )}

            {pricingType === "distance_ranges" ? (
              <div className="mt-4 rounded-3xl bg-[#F8F3E8] p-4">
                <h3 className="text-sm font-black">Rangos de km</h3>
                <p className="mt-1 text-xs font-bold text-[#746f69]">
                  Cada rango cobra un monto fijo. Opcionalmente puedes cobrar por cada km que exceda el ultimo rango configurado.
                </p>
                <p className="mt-1 text-xs font-bold text-[#746f69]">
                  Ejemplo: si el ultimo rango termina en 10 km y vale $5, a 12 km se cobrara $5 mas 2 km adicionales.
                </p>
                <div className="mt-3 max-w-sm">
                  <Input name="distanceFactorUsd" label={`${billingCurrency} por km adicional despues del ultimo rango`} defaultValue={rate.distance_factor_usd} />
                </div>
              </div>
            ) : <input type="hidden" name="distanceFactorUsd" value="" />}

            {pricingType === "zones" ? (
              <div className="mt-4 rounded-3xl bg-[#F8F3E8] p-4">
                <h3 className="text-sm font-black">Zonas</h3>
                <p className="mt-1 text-xs font-bold text-[#746f69]">
                  Crea zonas con precio fijo; el comercio o cliente seleccionara la zona disponible.
                </p>
              </div>
            ) : null}

            {pricingType === "manual" ? (
              <label className="mt-4 block space-y-1 rounded-3xl bg-[#F8F3E8] p-4">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Mensaje de cotizacion
                </span>
                <textarea
                  name="manualQuoteMessage"
                  defaultValue={rate.manual_quote_message || ""}
                  rows={2}
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>
            ) : (
              <input type="hidden" name="manualQuoteMessage" value={rate.manual_quote_message || ""} />
            )}

            <button
              type="submit"
              disabled={isRatesSaving}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
            >
              {isRatesSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isRatesSaving ? "Guardando..." : "Guardar configuracion"}
            </button>
          </form>

          {pricingType === "zones" ? (
            <section className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
              <h3 className="text-lg font-black">Zonas de cobertura</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_140px_auto]">
                <TextInput label="Nombre zona" value={zoneDraft.name} onChange={(value) => { markDirty(); setZoneDraft((current) => ({ ...current, name: value })); }} />
                <TextInput label="Referencia" value={zoneDraft.description} onChange={(value) => { markDirty(); setZoneDraft((current) => ({ ...current, description: value })); }} />
                <TextInput label={billingCurrency} type="number" value={zoneDraft.feeUsd} onChange={(value) => { markDirty(); setZoneDraft((current) => ({ ...current, feeUsd: value })); }} />
                <button
                  type="button"
                  onClick={() => createRule("zone")}
                  disabled={isRuleSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B] disabled:opacity-60 md:self-end"
                >
                  <PlusCircle size={16} />
                  Agregar
                </button>
              </div>
              <div className="mt-4 grid gap-2">
                {zones.map((zone) => (
                  <div key={zone.id} className="flex flex-col justify-between gap-3 rounded-3xl bg-[#F8F3E8] p-4 md:flex-row md:items-center">
                    <div>
                      <h4 className="font-black">{zone.name}</h4>
                      <p className="text-sm font-bold text-[#746f69]">
                        {billingSymbol}{Number(zone.fee_usd || 0).toFixed(2)} {zone.description ? `- ${zone.description}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteRule("zone", zone.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-red-600"
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  </div>
                ))}
                {!zones.length ? <p className="text-sm font-black text-[#746f69]">Aun no hay zonas.</p> : null}
              </div>
            </section>
          ) : null}

          {pricingType === "distance_ranges" ? (
            <section className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
              <h3 className="text-lg font-black">Rangos por distancia</h3>
              <p className="mt-1 text-sm font-bold text-[#746f69]">
                Usa tramos continuos, por ejemplo 0 a 2 km, luego 2.01 a 5 km. No se permite cruzar rangos.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                <TextInput label="Desde km" type="number" value={rangeDraft.minKm} onChange={(value) => { markDirty(); setRangeDraft((current) => ({ ...current, minKm: value })); }} />
                <TextInput label="Hasta km" type="number" value={rangeDraft.maxKm} onChange={(value) => { markDirty(); setRangeDraft((current) => ({ ...current, maxKm: value })); }} />
                <TextInput label={`Monto ${billingCurrency}`} type="number" value={rangeDraft.feeUsd} onChange={(value) => { markDirty(); setRangeDraft((current) => ({ ...current, feeUsd: value })); }} />
                <button
                  type="button"
                  onClick={() => createRule("distance_rate")}
                  disabled={isRuleSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-4 py-3 text-sm font-black text-[#25262B] disabled:opacity-60 md:self-end"
                >
                  <PlusCircle size={16} />
                  Agregar
                </button>
              </div>
              <div className="mt-4 grid gap-2">
                {distanceRates.map((entry) => (
                  <div key={entry.id} className="flex flex-col justify-between gap-3 rounded-3xl bg-[#F8F3E8] p-4 md:flex-row md:items-center">
                    <div>
                      <h4 className="font-black">
                        {Number(entry.min_km || 0)} km a {entry.max_km === null ? "sin limite" : `${Number(entry.max_km)} km`}
                      </h4>
                      <p className="text-sm font-bold text-[#746f69]">{billingSymbol}{Number(entry.fee_usd || 0).toFixed(2)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteRule("distance_rate", entry.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-red-600"
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  </div>
                ))}
                {!distanceRates.length ? <p className="text-sm font-black text-[#746f69]">Aun no hay rangos.</p> : null}
              </div>
              {distanceRangeGaps.length ? (
                <div className="mt-4 rounded-3xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  <p className="font-black">Hay espacios sin tarifa configurada.</p>
                  <p className="mt-1">
                    {distanceRangeGaps
                      .map((gap) => `de ${gap.from} km a ${gap.to} km`)
                      .join(", ")}
                    . Ajusta los rangos para evitar pedidos sin precio.
                  </p>
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 rounded-3xl border border-[#25262B]/10 bg-[#F8F3E8] p-4 md:grid-cols-[220px_1fr] md:items-end">
                <TextInput
                  label="Probar km"
                  type="number"
                  value={distanceSimulatorKm}
                  onChange={setDistanceSimulatorKm}
                />
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                    Simulador de tarifa
                  </p>
                  {simulatorResult && simulatedDistanceKm !== null ? (
                    <>
                      <p className="mt-1 text-2xl font-black text-[#2E3A79]">
                        {billingSymbol}{simulatorResult.feeUsd.toFixed(2)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-[#746f69]">
                        {simulatedDistanceKm.toFixed(2)} km - {simulatorResult.summary}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm font-black text-[#746f69]">
                      {simulatorExceedsLastRange
                        ? "Esa distancia supera el ultimo rango. Configura y guarda el monto por km adicional para simularla."
                        : "No hay una regla activa para esa distancia."}
                    </p>
                  )}
                </div>
                <p className="text-xs font-bold leading-relaxed text-[#746f69] md:col-span-2">
                  Cobertura actual: {rate.max_distance_km ? `hasta ${Number(rate.max_distance_km)} km` : "sin KM maximo guardado"}.
                  {lastFiniteDistanceRate?.maxKm !== null && lastFiniteDistanceRate?.maxKm !== undefined
                    ? ` Ultimo rango fijo: hasta ${lastFiniteDistanceRate.maxKm} km.`
                    : " Ultimo rango fijo: no definido."}
                  {distanceFactorUsd !== null
                    ? ` Km adicional: ${billingSymbol}${distanceFactorUsd.toFixed(2)} por km.`
                    : " Km adicional: no configurado."}
                </p>
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

      {tab === "configuracion" ? (
        <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
            <h2 className="text-xl font-black">Logo</h2>
            <div className="mt-4 grid place-items-center rounded-[28px] bg-[#F8F3E8] p-6">
              {agency.logo_url ? (
                <OptimizedImage
                  src={agency.logo_url}
                  alt={agency.name}
                  width={144}
                  height={144}
                  sizes="144px"
                  className="h-36 w-36 rounded-[28px] bg-white object-cover shadow-lg shadow-[#25262B]/10"
                  fallback={
                    <div className="grid h-36 w-36 place-items-center rounded-[28px] bg-white text-[#2E3A79] shadow-lg shadow-[#25262B]/10">
                      <ImagePlus size={36} />
                    </div>
                  }
                />
              ) : (
                <div className="grid h-36 w-36 place-items-center rounded-[28px] bg-white text-[#2E3A79]">
                  <ImagePlus size={36} />
                </div>
              )}
            </div>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]">
              {isLogoUploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              Subir logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={uploadLogo}
                disabled={isLogoUploading}
                className="sr-only"
              />
            </label>
            <p className="mt-3 text-xs font-bold leading-relaxed text-[#746f69]">
              PNG, JPG o WebP. Maximo 2 MB.
            </p>

            <div className="mt-6 border-t border-[#25262B]/10 pt-5">
              <h2 className="text-xl font-black">Banner marketplace</h2>
              <div className="mt-4 overflow-hidden rounded-[24px] bg-[#F8F3E8]">
                {agency.banner_image_url ? (
                  <OptimizedImage
                    src={agency.banner_image_url}
                    alt={`Banner de ${agency.name}`}
                    width={640}
                    height={260}
                    sizes="320px"
                    className="h-36 w-full object-cover"
                    fallback={
                      <div className="grid h-36 place-items-center text-[#2E3A79]">
                        <ImagePlus size={32} />
                      </div>
                    }
                  />
                ) : (
                  <div className="grid h-36 place-items-center text-center text-[#2E3A79]">
                    <div>
                      <ImagePlus className="mx-auto" size={32} />
                      <p className="mt-2 text-xs font-black">Sin banner</p>
                    </div>
                  </div>
                )}
              </div>
              <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#2E3A79] px-5 py-3 text-sm font-black text-white">
                {isBannerUploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                Subir banner
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={uploadBanner}
                  disabled={isBannerUploading}
                  className="sr-only"
                />
              </label>
              <p className="mt-3 text-xs font-bold leading-relaxed text-[#746f69]">
                Recomendado horizontal 1200x450. PNG, JPG o WebP. Maximo 3 MB.
              </p>
            </div>
          </div>

          <form
            key={`profile-${agency.id}`}
            onSubmit={saveProfile}
            onChangeCapture={markDirty}
            className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10"
          >
            <h2 className="text-xl font-black">Datos operativos</h2>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Estos datos son obligatorios para que los comercios puedan solicitar afiliacion.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Nombre comercial
                </span>
                <input
                  name="name"
                  defaultValue={agency.name || ""}
                  required
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Responsable
                </span>
                <input
                  name="contactName"
                  defaultValue={agency.contact_name || ""}
                  required
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Correo
                </span>
                <input
                  name="contactEmail"
                  type="email"
                  defaultValue={agency.contact_email || ""}
                  required
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Telefono
                </span>
                <input
                  name="contactPhone"
                  defaultValue={agency.contact_phone || ""}
                  required
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  WhatsApp operativo
                </span>
                <input
                  name="whatsappPhone"
                  defaultValue={agency.whatsapp_phone || agency.contact_phone || ""}
                  required
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">Ciudad base</span>
                <select name="baseCityId" defaultValue={agency.city_coverage?.find((coverage) => coverage.is_active && coverage.is_base_city)?.city_id || ""} required className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]">
                  <option value="">Selecciona la ciudad base</option>
                  {serviceCities.map((city) => <option key={city.id} value={city.id}>{city.name}, {city.state_name}</option>)}
                </select>
              </label>

              <fieldset className="space-y-2 md:col-span-2">
                <legend className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">Ciudades con cobertura</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {serviceCities.map((city) => <label key={city.id} className="flex items-center gap-2 rounded-xl border border-[#25262B]/10 px-3 py-2 text-sm font-bold"><input type="checkbox" name="coverageCityIds" value={city.id} defaultChecked={agency.city_coverage?.some((coverage) => coverage.city_id === city.id && coverage.is_active)} />{city.name}, {city.state_name}</label>)}
                </div>
              </fieldset>
            </div>

            <label className="mt-4 block space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                Cobertura resumida
              </span>
              <textarea
                name="coverageNotes"
                defaultValue={agency.coverage_notes || ""}
                placeholder="Ej: Barquisimeto zona este, centro y Cabudare segun disponibilidad."
                rows={3}
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </label>

            <h2 className="mt-6 text-xl font-black">Colores del Marketplace</h2>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Personaliza el encabezado público de tu empresa delivery.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Color principal
                </span>
                <input
                  name="marketplacePrimaryColor"
                  type="color"
                  defaultValue={agency.marketplace_primary_color || "#143D42"}
                  className="h-12 w-full rounded-2xl border border-[#25262B]/10 bg-white p-2"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Color de acento
                </span>
                <input
                  name="marketplaceAccentColor"
                  type="color"
                  defaultValue={agency.marketplace_accent_color || "#FF7133"}
                  className="h-12 w-full rounded-2xl border border-[#25262B]/10 bg-white p-2"
                />
              </label>
            </div>

            <h2 className="mt-6 text-xl font-black">Capacidad y condiciones</h2>
            <p className="mt-1 text-sm font-bold text-[#746f69]">
              Estos datos ayudan al comercio a saber que puede enviar con tu empresa delivery.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Medida del bolso
                </span>
                <input
                  name="capacityDimensionsCm"
                  defaultValue={agency.capacity_dimensions_cm || ""}
                  placeholder="Ej: 45x45x45 cm"
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>

              <Input
                name="capacityWeightKg"
                label="Peso maximo kg"
                defaultValue={agency.capacity_weight_kg}
              />

              <Input
                name="maxWaitTimeMinutes"
                label="Espera maxima min"
                defaultValue={agency.max_wait_time_minutes}
              />

              <Input
                name="cashReturnFeeUsd"
                label={`Retorno efectivo ${billingCurrency}`}
                defaultValue={agency.cash_return_fee_usd}
              />

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Moneda de cobro
                </span>
                <select
                  name="billingCurrency"
                  defaultValue={agency.billing_currency === "EUR" ? "EUR" : "USD"}
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
                >
                  <option value="USD">Dolar</option>
                  <option value="EUR">Euro</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Modalidad de afiliacion
                </span>
                <select
                  name="modality"
                  defaultValue={agency.modality || "open"}
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
                >
                  <option value="open">Abierta</option>
                  <option value="exclusive">Exclusiva</option>
                  <option value="mixed">Mixta / evaluacion manual</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Visibilidad de tarifas
                </span>
                <select
                  name="ratesVisibility"
                  defaultValue={agency.rates_visibility === "private" ? "private" : "public"}
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
                >
                  <option value="public">Publicas para comercios</option>
                  <option value="private">Privadas hasta aprobar afiliacion</option>
                </select>
              </label>
            </div>

            <label className="mt-4 flex items-center gap-3 rounded-3xl bg-[#F8F3E8] p-4">
              <input
                name="chargesCashReturn"
                type="checkbox"
                defaultChecked={Boolean(agency.charges_cash_return)}
                className="h-5 w-5 accent-[#2E3A79]"
              />
              <span className="text-sm font-black text-[#25262B]">
                Cobra retorno de efectivo
              </span>
            </label>

            <label className="mt-3 flex items-start gap-3 rounded-3xl bg-[#F8F3E8] p-4">
              <input
                name="driverWhatsappDispatchEnabled"
                type="checkbox"
                defaultChecked={Boolean(agency.driver_whatsapp_dispatch_enabled)}
                className="mt-1 h-5 w-5 accent-[#2E3A79]"
              />
              <span>
                <span className="block text-sm font-black text-[#25262B]">
                  Permitir enviar comanda al repartidor por WhatsApp
                </span>
                <span className="mt-1 block text-xs font-bold leading-relaxed text-[#746f69]">
                  Si esta activo, al asignar un repartidor con WhatsApp aparecera un boton para enviarle una comanda simple.
                </span>
              </span>
            </label>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Condiciones de pago
                </span>
                <textarea
                  name="paymentTerms"
                  defaultValue={agency.payment_terms || ""}
                  placeholder="Ej: Corte semanal, pago por transferencia, conciliacion cada viernes."
                  rows={4}
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Credito a comercios
                </span>
                <textarea
                  name="creditTerms"
                  defaultValue={agency.credit_terms || ""}
                  placeholder="Ej: Credito maximo 7 dias. No se aceptan nuevos pedidos con saldos vencidos."
                  rows={4}
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>
            </div>

            <label className="mt-4 block space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                Condiciones adicionales
              </span>
              <textarea
                name="additionalConditions"
                defaultValue={agency.additional_conditions || ""}
                placeholder="Ej: No transportamos bebidas sin sellar. Espera maxima 10 min en local. Retorno de efectivo solo hasta cierto monto."
                rows={5}
                className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
            </label>

            <button
              type="submit"
              disabled={isProfileSaving}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B] disabled:opacity-60"
            >
              {isProfileSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar configuracion
            </button>
          </form>
        </section>
      ) : null}

      {tab === "solicitudes" ? (
        <List
          empty="No hay solicitudes pendientes."
          items={requests}
          render={(entry) => (
            <div className="flex flex-col justify-between gap-3 rounded-3xl bg-white p-4 md:flex-row md:items-center">
              <div>
                <h3 className="font-black">{entry.store_name_snapshot || entry.stores?.name || "Comercio"}</h3>
                <p className="mt-1 text-sm font-bold text-[#746f69]">
                  {entry.store_contact_name_snapshot || entry.contact_name || "Responsable"} - {entry.store_phone_snapshot || entry.contact_phone || "sin telefono"}
                </p>
                <p className="mt-1 text-xs font-bold leading-relaxed text-[#746f69]">
                  {entry.store_address_snapshot || "Sin direccion registrada"}
                  {entry.store_schedule_snapshot ? ` - ${entry.store_schedule_snapshot}` : ""}
                </p>
                {entry.store_description_snapshot ? (
                  <p className="mt-2 max-w-2xl rounded-2xl bg-[#F8F3E8] p-3 text-xs font-bold leading-relaxed text-[#746f69]">
                    {entry.store_description_snapshot}
                  </p>
                ) : null}
                <p className="mt-2 text-sm font-black text-[#2E3A79]">{entry.status}</p>
              </div>
              {entry.status === "pending" ? (
                <div className="flex flex-col gap-2 sm:min-w-56">
                  <label className="space-y-1">
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">
                      Modalidad con este comercio
                    </span>
                    <select
                      value={requestRelationshipModes[entry.id] || (agency?.modality === "exclusive" ? "exclusive" : "mixed")}
                      onChange={(event) =>
                        setRequestRelationshipModes((current) => ({
                          ...current,
                          [entry.id]: event.target.value as "exclusive" | "mixed",
                        }))
                      }
                      className="w-full rounded-2xl border border-[#25262B]/10 px-3 py-2 text-xs font-black outline-none focus:border-[#2E3A79]"
                    >
                      <option value="mixed">Mixta: puede ver otras empresas</option>
                      <option value="exclusive">Exclusiva: oculta otras empresas</option>
                    </select>
                  </label>
                  <div className="flex gap-2">
                  <button onClick={() => reviewRequest(entry.id, "approve")} className="rounded-full bg-green-100 px-4 py-2 text-xs font-black text-green-700">
                    <CheckCircle2 size={15} className="inline" /> Aprobar
                  </button>
                  <button onClick={() => reviewRequest(entry.id, "reject")} className="rounded-full bg-red-100 px-4 py-2 text-xs font-black text-red-700">
                    <XCircle size={15} className="inline" /> Rechazar
                  </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        />
      ) : null}

      {tab === "comercios" ? (
        <List
          empty="Aun no hay comercios conectados."
          items={connections}
          render={(entry) => {
            const isEnded = connectionEnded(entry, nowMs);
            const isPendingExit = connectionPendingExit(entry, nowMs);

            return (
              <div className="rounded-3xl bg-white p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <h3 className="font-black">{entry.stores?.name || "Comercio"}</h3>
                    <p className="text-sm font-bold text-[#746f69]">
                      {isEnded ? "desafiliado" : entry.status}
                      {entry.is_default && !isEnded ? " - proveedor activo" : ""}
                    </p>
                    <p className="mt-1 inline-flex rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black text-[#2E3A79]">
                      Modalidad: {relationshipModeLabel(Boolean(entry.is_exclusive))}
                    </p>
                    {entry.stores?.whatsapp ? (
                      <p className="mt-1 text-xs font-bold text-[#746f69]">
                        WhatsApp: {entry.stores.whatsapp}
                      </p>
                    ) : null}
                    {isPendingExit ? (
                      <p className="mt-2 rounded-2xl bg-amber-100 p-3 text-xs font-black leading-relaxed text-amber-800">
                        {entry.disengagement_effective_at
                          ? "Salida confirmada"
                          : entry.disengagement_requested_by === "agency"
                            ? "Tu empresa solicito desafiliacion. Esperando confirmacion del comercio."
                            : "El comercio solicito desafiliacion. Confirma cuando no tenga deuda pendiente."}
                      </p>
                    ) : null}
                    {entry.disengagement_notes ? (
                      <p className="mt-2 text-xs font-bold text-[#746f69]">
                        {entry.disengagement_notes}
                      </p>
                    ) : null}
                  </div>

                  {!isEnded ? (
                    <div className="flex flex-col gap-2 sm:min-w-60">
                      <label className="space-y-1">
                        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#746f69]">
                          Modalidad
                        </span>
                        <select
                          value={entry.is_exclusive ? "exclusive" : "mixed"}
                          disabled={savingConnectionModeId === entry.id || isPendingExit}
                          onChange={(event) =>
                            updateConnectionMode(
                              entry.id,
                              event.target.value as "exclusive" | "mixed"
                            )
                          }
                          className="w-full rounded-2xl border border-[#25262B]/10 px-3 py-2 text-xs font-black outline-none focus:border-[#2E3A79] disabled:bg-[#F8F3E8] disabled:text-[#746f69]"
                        >
                          <option value="mixed">Mixta</option>
                          <option value="exclusive">Exclusiva</option>
                        </select>
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                      {entry.disengagement_requested_at &&
                      !entry.disengagement_confirmed_at &&
                      entry.disengagement_requested_by !== "agency" ? (
                        <button
                          onClick={() => disengageConnection(entry.id, "confirm")}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-800"
                        >
                          <CheckCircle2 size={15} />
                          Confirmar salida
                        </button>
                      ) : !isPendingExit ? (
                        <button
                          onClick={() => disengageConnection(entry.id, "request")}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-red-50 px-4 py-2 text-xs font-black text-red-700"
                        >
                          <XCircle size={15} />
                          Desafiliar comercio
                        </button>
                      ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          }}
        />
      ) : null}

      {tab === "facturacion" ? (
        <TransportBillingTab agencyId={agencyId} billing={billing} currency={billingCurrency} symbol={billingSymbol} />
      ) : null}

      {message ? <p className="rounded-2xl bg-white p-3 text-sm font-black text-[#2E3A79]">{message}</p> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function Input({
  name,
  label,
  defaultValue,
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: any;
  required?: boolean;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">{label}</span>
      <input
        name={name}
        type="number"
        defaultValue={defaultValue ?? ""}
        required={required}
        min={required ? "0.01" : "0"}
        step="0.01"
        className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
      />
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
      />
    </label>
  );
}

function List({
  items,
  empty,
  render,
}: {
  items: any[];
  empty: string;
  render: (item: any) => React.ReactNode;
}) {
  if (!items.length) {
    return <div className="rounded-[28px] bg-white p-5 text-sm font-black text-[#746f69]">{empty}</div>;
  }
  return <div className="grid gap-3">{items.map((item) => <div key={item.id}>{render(item)}</div>)}</div>;
}
