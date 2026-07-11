"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
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
import {
  findOverlappingDistanceRange,
  formatDistanceRange,
  normalizeDistanceRangeInput,
} from "@/lib/distance-ranges";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getTransportAgencyConfigIssues, getTransportAgencyRateFromRelation } from "@/lib/transport";
import {
  connectionEnded,
  connectionPendingExit,
  formatDateTime,
  panelNavItems,
  relationshipModeLabel,
  transportStatusLabels,
  type Agency,
  type PanelCache,
  type PricingType,
} from "@/components/transport/transport-panel-helpers";

let transportPanelCache: PanelCache | null = null;

export function TransportAgencyPanel({ initialTab = "resumen" }: { initialTab?: string }) {
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState(initialTab);
  const [agencies, setAgencies] = useState<Agency[]>(transportPanelCache?.agencies || []);
  const [requests, setRequests] = useState<any[]>(transportPanelCache?.requests || []);
  const [connections, setConnections] = useState<any[]>(transportPanelCache?.connections || []);
  const [billing, setBilling] = useState<any>(transportPanelCache?.billing || null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(!transportPanelCache);
  const [hasSession, setHasSession] = useState(Boolean(transportPanelCache?.hasSession));
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [pricingType, setPricingType] = useState<PricingType>("manual");
  const [zoneDraft, setZoneDraft] = useState({ name: "", description: "", feeUsd: "" });
  const [rangeDraft, setRangeDraft] = useState({ minKm: "", maxKm: "", feeUsd: "" });
  const [isRuleSaving, setIsRuleSaving] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isRatesSaving, setIsRatesSaving] = useState(false);
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [billingStoreFilter, setBillingStoreFilter] = useState("all");
  const [billingStatusFilter, setBillingStatusFilter] = useState("all");
  const [transportOrders, setTransportOrders] = useState<any[]>([]);
  const [transportOrderStores, setTransportOrderStores] = useState<any[]>([]);
  const [transportOrderStatusFilter, setTransportOrderStatusFilter] = useState("all");
  const [transportOrderStoreFilter, setTransportOrderStoreFilter] = useState("all");
  const [transportOrderPeriod, setTransportOrderPeriod] = useState("today");
  const [isTransportOrdersLoading, setIsTransportOrdersLoading] = useState(false);
  const [transportOrderPage, setTransportOrderPage] = useState(1);
  const [transportOrdersHasMore, setTransportOrdersHasMore] = useState(false);
  const [savingTransportOrderId, setSavingTransportOrderId] = useState<string | null>(null);
  const [savingConnectionModeId, setSavingConnectionModeId] = useState<string | null>(null);
  const [requestRelationshipModes, setRequestRelationshipModes] = useState<Record<string, "exclusive" | "mixed">>({});
  const [nowMs, setNowMs] = useState(0);

  const agency = agencies[0] || null;
  const agencyId = agency?.id || "";
  const agencyPricingType = agency?.pricing_type || "";
  const billingCurrency = agency?.billing_currency === "EUR" ? "EUR" : "USD";
  const billingSymbol = billingCurrency === "EUR" ? "€" : "$";
  const rate = getTransportAgencyRateFromRelation(agency?.transport_agency_rates) || {};
  const zones = (agency?.transport_agency_zones || [])
    .filter((zone) => zone.is_active !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const distanceRates = (agency?.transport_agency_distance_rates || [])
    .filter((entry) => entry.is_active !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const pendingRequests = requests.filter((entry) => entry.status === "pending");
  const configIssues = agency
    ? getTransportAgencyConfigIssues({
        agency,
        rate,
        zones,
        distanceRates,
      })
    : [];

  const activeConnectionsCount = connections.filter(
    (entry) => entry.status === "active" && !connectionEnded(entry, nowMs)
  ).length;

  async function authHeaders() {
    const savedPin = pin || getSavedPanelPin();
    return getPanelAuthHeaders(savedPin);
  }

  async function load(options: { silent?: boolean } = {}) {
    if (!options.silent && !transportPanelCache) setIsLoading(true);
    if (!options.silent) setMessage("");
    try {
      const savedPin = getSavedPanelPin();
      const token = await getPanelAccessToken();
      setHasSession(Boolean(token));
      setPin(savedPin);
      if (!savedPin && !token) {
        setMessage("Inicia sesion para entrar al panel de empresa delivery.");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/transport/me", {
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
          transportPanelCache = null;
          setMessage("Sesion vencida o invalida. Inicia sesion como empresa delivery.");
          return;
        }

        if (response.status === 403) {
          setHasSession(false);
          setAgencies([]);
          setRequests([]);
          setConnections([]);
          setBilling(null);
          transportPanelCache = null;
          setMessage(`${detail} Entra con el correo asignado a la empresa delivery.`);
          return;
        }

        throw new Error(detail);
      }
      setAgencies(data.agencies || []);
      setRequests(data.requests || []);
      setConnections(data.connections || []);
      setBilling(data.billing || null);
      setHasSession(true);
      transportPanelCache = {
        agencies: data.agencies || [],
        requests: data.requests || [],
        connections: data.connections || [],
        billing: data.billing || null,
        hasSession: true,
      };
    } catch (error: any) {
      setMessage(error.message || "No se pudo cargar.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setNowMs(Date.now());
    load({ silent: Boolean(transportPanelCache) });
  }, []);

  async function loadTransportOrders(overrides: Record<string, string> = {}) {
    setIsTransportOrdersLoading(true);
    setMessage("");
    try {
      const page = Number(overrides.page || 1);
      const append = overrides.append === "true";
      const params = new URLSearchParams({
        period: overrides.period || transportOrderPeriod,
        status: overrides.status || transportOrderStatusFilter,
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
      setTransportOrders((current) => (append ? [...current, ...(data.orders || [])] : data.orders || []));
      setTransportOrderStores(data.stores || []);
      setTransportOrderPage(page);
      setTransportOrdersHasMore(Boolean(data.pagination?.hasMore));
    } catch (error: any) {
      setMessage(error.message || "No se pudieron cargar pedidos.");
    } finally {
      setIsTransportOrdersLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "pedidos" && hasSession) {
      loadTransportOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hasSession]);

  useEffect(() => {
    if (tab !== "pedidos" || !hasSession || !agencyId) return;

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;
    let refreshTimer: number | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refreshOrders = () => {
      if (!active || document.visibilityState !== "visible") return;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadTransportOrders(), 120);
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
    transportPanelCache = null;
    setHasSession(false);
    setLoginPassword("");
    setMessage("Sesion cerrada.");
  }

  async function saveRates(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agency) return;
    const form = new FormData(event.currentTarget);
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
          city: form.get("city"),
          state: form.get("state"),
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
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la configuracion.");
      setHasUnsavedChanges(false);
      setMessage("Configuracion guardada.");
      load();
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
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                ...(data.order || {}),
                status,
              }
            : order
        )
      );
      setMessage("Estado actualizado.");
      if (transportOrderStatusFilter !== "all" && transportOrderStatusFilter !== status) {
        setTransportOrderStatusFilter("all");
        await loadTransportOrders({ status: "all" });
      } else {
        await loadTransportOrders();
      }
      await load();
    } catch (error: any) {
      setMessage(error.message || "No se pudo actualizar el estado.");
    } finally {
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

  const billingStats = useMemo(() => {
    const orders = (billing?.orders || []) as any[];
    const storeMap = new Map<string, { storeId: string; storeName: string; orders: number; total: number; delivered: number; pending: number }>();

    for (const order of orders) {
      const storeId = String(order.store_id || "sin-comercio");
      const storeName = order.stores?.name || "Comercio";
      const status = String(order.status || "");
      const amount = Number(order.delivery_fee_usd ?? order.orders?.delivery_usd ?? 0);
      const current =
        storeMap.get(storeId) ||
        { storeId, storeName, orders: 0, total: 0, delivered: 0, pending: 0 };

      current.orders += 1;
      if (status === "delivered") current.total += amount;
      if (status === "delivered") current.delivered += 1;
      else current.pending += 1;
      storeMap.set(storeId, current);
    }

    const filteredOrders = orders.filter((order) => {
      const status = String(order.status || "");
      const matchesStore = billingStoreFilter === "all" || order.store_id === billingStoreFilter;
      const matchesStatus = billingStatusFilter === "all" || status === billingStatusFilter;
      return matchesStore && matchesStatus;
    });

    return {
      byStore: Array.from(storeMap.values()).sort((a, b) => b.total - a.total),
      filteredOrders,
      filteredTotal: filteredOrders.reduce(
        (sum, order) =>
          order.status === "delivered"
            ? sum + Number(order.delivery_fee_usd ?? order.orders?.delivery_usd ?? 0)
            : sum,
        0
      ),
      deliveredCount: orders.filter((order) =>
        String(order.status || "") === "delivered"
      ).length,
      pendingCount: orders.filter(
        (order) =>
          !["delivered", "cancelled", "agency_rejected"].includes(
            String(order.status || "")
          )
      ).length,
    };
  }, [billing, billingStatusFilter, billingStoreFilter]);

  if (isLoading) {
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
            ? message || "Cuando VendeMas active tu empresa delivery, podras entrar con el correo registrado."
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
              <input
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                type="password"
                placeholder="Tu clave"
                className="mt-1 w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
              />
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
      <section className="rounded-[34px] bg-[#25262B] p-5 text-white shadow-xl shadow-[#25262B]/20">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FFB547]">
              Panel de empresa delivery
            </p>
            <div className="mt-2 flex items-center gap-3">
              {agency.logo_url ? (
                <img
                  src={agency.logo_url}
                  alt={agency.name}
                  className="h-14 w-14 rounded-2xl bg-white object-cover"
                />
              ) : null}
              <h1 className="text-3xl font-black">{agency.name}</h1>
            </div>
            <p className="mt-2 text-sm font-semibold text-white/70">
              Estado: {agency.status} · Modalidad: {agency.modality}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
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
          <Link
            key={item.key}
            href={item.href}
            onClick={(event) => {
              if (!confirmNavigation()) {
                event.preventDefault();
                return;
              }
              setHasUnsavedChanges(false);
              setTab(item.key);
            }}
            className={[
              "rounded-2xl px-3 py-3 text-center text-xs font-black",
              tab === item.key ? "bg-[#2E3A79] text-white" : "bg-white text-[#746f69]",
            ].join(" ")}
          >
            {item.label}
          </Link>
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

      {configIssues.length ? (
        <section className="rounded-[28px] bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
          <h2 className="text-sm font-black">Completa tu empresa para aparecer ante comercios</h2>
          <p className="mt-1 text-sm font-bold leading-relaxed">
            Falta: {configIssues.join(", ")}. Cuando estos datos esten listos y el estado este activo,
            los comercios podran ver y solicitar afiliacion sin errores.
          </p>
        </section>
      ) : (
        <section className="rounded-[28px] bg-green-50 p-4 text-green-800 ring-1 ring-green-200">
          <h2 className="text-sm font-black">Configuracion operativa completa</h2>
          <p className="mt-1 text-sm font-bold">
            Tus datos, cobertura y tarifas tienen lo necesario para operar.
          </p>
        </section>
      )}

      {tab === "resumen" ? (
        <section className="grid gap-3 md:grid-cols-3">
          <Metric label="Solicitudes pendientes" value={pendingRequests.length} />
          <Metric label="Comercios activos" value={activeConnectionsCount} />
          <Metric label="Delivery semana" value={`${billingSymbol}${totals.usd.toFixed(2)}`} />
        </section>
      ) : null}

      {tab === "pedidos" ? (
        <section className="space-y-4">
          <div className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-black">Pedidos recibidos</h2>
                <p className="mt-1 text-sm font-bold text-[#746f69]">
                  Servicios enviados por comercios afiliados a tu empresa delivery.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadTransportOrders()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
              >
                {isTransportOrdersLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                Actualizar
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <select
                value={transportOrderPeriod}
                onChange={(event) => {
                  const value = event.target.value;
                  setTransportOrderPeriod(value);
                  loadTransportOrders({ period: value });
                }}
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
              >
                <option value="today">Hoy</option>
                <option value="week">Semana</option>
                <option value="all">Todos</option>
              </select>
              <select
                value={transportOrderStatusFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setTransportOrderStatusFilter(value);
                  loadTransportOrders({ status: value });
                }}
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="agency_accepted">Aceptados</option>
                <option value="agency_rejected">Rechazados</option>
                <option value="on_the_way">En camino</option>
                <option value="delivered">Entregados</option>
                <option value="issue_reported">Novedades</option>
              </select>
              <select
                value={transportOrderStoreFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setTransportOrderStoreFilter(value);
                  loadTransportOrders({ storeId: value });
                }}
                className="rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
              >
                <option value="all">Todos los comercios</option>
                {transportOrderStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <List
            empty={isTransportOrdersLoading ? "Cargando pedidos..." : "No hay pedidos de empresa delivery con estos filtros."}
            items={transportOrders}
            render={(entry) => {
              const isSaving = savingTransportOrderId === entry.id;
              const commercePhone = String(entry.store_whatsapp_snapshot || entry.stores?.whatsapp || "").replace(/[^0-9]/g, "");
              const customerPhone = String(entry.customer_phone_snapshot || "").replace(/[^0-9]/g, "");
              const actions = [
                ["agency_received", "Recibido"],
                ["agency_accepted", "Aceptar"],
                ["agency_rejected", "Rechazar"],
                ["pickup_pending", "Pendiente por retirar"],
                ["picked_up", "Retirado"],
                ["on_the_way", "En camino"],
                ["delivered", "Entregado"],
                ["delivery_failed", "Entrega fallida"],
                ["issue_reported", "Novedad"],
              ];
              const latitude = Number(entry.orders?.delivery_lat);
              const longitude = Number(entry.orders?.delivery_lng);
              const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);

              return (
                <article className="rounded-[28px] bg-white p-4 shadow-xl shadow-[#25262B]/10">
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black">
                          {entry.orders?.public_code || "Pedido"}
                        </h3>
                        <span className="rounded-full bg-[#F8F3E8] px-3 py-1 text-xs font-black text-[#2E3A79]">
                          {transportStatusLabels[entry.status] || entry.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-[#746f69]">
                        {entry.store_name_snapshot || entry.stores?.name || "Comercio"} · {entry.customer_name_snapshot || "Cliente"} · {entry.customer_phone_snapshot || "sin telefono"}
                      </p>
                      <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
                        {entry.delivery_address || entry.delivery_reference || "Direccion por confirmar"}
                        {entry.delivery_zone_name ? ` · ${entry.delivery_zone_name}` : ""}
                      </p>
                      <p className="mt-2 text-sm font-black">
                        Delivery: {billingSymbol}{Number(entry.delivery_fee_usd || 0).toFixed(2)}
                      </p>
                      {hasLocation ? (
                        <a
                          href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"
                        >
                          Ver ubicación en mapa
                        </a>
                      ) : null}
                      {entry.orders?.order_items?.length ? (
                        <div className="mt-3 rounded-2xl bg-[#F8F3E8] p-3">
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">Detalle del pedido</p>
                          {entry.orders.order_items.map((item: any) => (
                            <p key={item.id} className="mt-1 text-sm font-bold text-[#746f69]">
                              {item.quantity} × {item.product_name}{item.variant_name ? ` · ${item.variant_name}` : ""}
                            </p>
                          ))}
                          {entry.orders.order_details || entry.orders.notes ? (
                            <p className="mt-2 text-xs font-bold text-[#746f69]">
                              {entry.orders.order_details || entry.orders.notes}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {entry.agency_status_note || entry.rejection_reason ? (
                        <p className="mt-2 rounded-2xl bg-[#F8F3E8] p-3 text-xs font-bold text-[#746f69]">
                          {entry.agency_status_note || entry.rejection_reason}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
                      {commercePhone ? (
                        <a
                          href={`https://wa.me/${commercePhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full bg-green-100 px-3 py-2 text-xs font-black text-green-700"
                        >
                          Comercio WA
                        </a>
                      ) : null}
                      {customerPhone ? (
                        <a
                          href={`https://wa.me/${customerPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full bg-green-100 px-3 py-2 text-xs font-black text-green-700"
                        >
                          Cliente WA
                        </a>
                      ) : null}
                      <select
                        value={entry.status}
                        disabled={isSaving || ["delivered", "agency_rejected", "cancelled"].includes(entry.status)}
                        onChange={(event) => updateTransportOrderStatus(entry.id, event.target.value)}
                        className="rounded-full border border-[#2E3A79]/20 bg-[#2E3A79] px-4 py-2 text-xs font-black text-white disabled:bg-[#F8F3E8] disabled:text-[#746f69]"
                        aria-label={`Actualizar estado de ${entry.orders?.public_code || "pedido"}`}
                      >
                        <option value={entry.status}>{isSaving ? "Actualizando..." : transportStatusLabels[entry.status] || entry.status}</option>
                        {actions.filter(([status]) => status !== entry.status).map(([status, label]) => (
                          <option key={status} value={status}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {entry.transport_order_events?.length ? (
                    <div className="mt-4 border-t border-[#25262B]/10 pt-3">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                        Historial
                      </p>
                      <div className="mt-2 grid gap-1">
                        {entry.transport_order_events.slice(0, 4).map((event: any) => (
                          <p key={event.id} className="text-xs font-bold text-[#746f69]">
                            {transportStatusLabels[event.status_to] || event.status_to || event.event_type} · {event.actor_name || event.actor_type}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            }}
          />
          {transportOrdersHasMore ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() =>
                  loadTransportOrders({
                    page: String(transportOrderPage + 1),
                    append: "true",
                  })
                }
                disabled={isTransportOrdersLoading}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#2E3A79] shadow-xl shadow-[#25262B]/10 disabled:opacity-60"
              >
                {isTransportOrdersLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                Cargar mas pedidos
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "tarifas" ? (
        <section className="space-y-4">
          <form onSubmit={saveRates} onChangeCapture={markDirty} className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
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
                label="KM maximo de cobertura"
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
                  Agrega tramos sin solaparlos. El checkout usara unicamente el rango donde caiga el cliente.
                </p>
              </div>
            ) : null}

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
                <TextInput label={billingCurrency} type="number" value={rangeDraft.feeUsd} onChange={(value) => { markDirty(); setRangeDraft((current) => ({ ...current, feeUsd: value })); }} />
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
                <img
                  src={agency.logo_url}
                  alt={agency.name}
                  className="h-36 w-36 rounded-[28px] bg-white object-cover shadow-lg shadow-[#25262B]/10"
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
          </div>

          <form onSubmit={saveProfile} onChangeCapture={markDirty} className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
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
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Ciudad base
                </span>
                <input
                  name="city"
                  defaultValue={agency.city || ""}
                  required
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Estado
                </span>
                <input
                  name="state"
                  defaultValue={agency.state || ""}
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#2E3A79]"
                />
              </label>
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
        <section className="space-y-4">
          <div className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h2 className="text-xl font-black">Facturacion semanal</h2>
                <p className="mt-2 text-sm font-bold text-[#746f69]">
                  {billing?.week?.startDate} a {billing?.week?.endDate} · Moneda de cobro {billingCurrency}
                </p>
              </div>
              <div className="rounded-3xl bg-[#F8F3E8] px-5 py-4 text-right">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Balance general
                </p>
                <p className="mt-1 text-3xl font-black">
                  {billingSymbol}{totals.usd.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {[
                ["Servicios", totals.orders],
                ["Entregados", billingStats.deliveredCount],
                ["Pendientes", billingStats.pendingCount],
                ["Filtrado", `${billingSymbol}${billingStats.filteredTotal.toFixed(2)}`],
              ].map(([label, value]) => (
                <div key={label} className="border-t border-[#25262B]/10 pt-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">{label}</p>
                  <p className="mt-1 text-2xl font-black">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Comercio
                </span>
                <select
                  value={billingStoreFilter}
                  onChange={(event) => setBillingStoreFilter(event.target.value)}
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
                >
                  <option value="all">Todos los comercios</option>
                  {billingStats.byStore.map((store) => (
                    <option key={store.storeId} value={store.storeId}>
                      {store.storeName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
                  Estado
                </span>
                <select
                  value={billingStatusFilter}
                  onChange={(event) => setBillingStatusFilter(event.target.value)}
                  className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79]"
                >
                  <option value="all">Todos</option>
                  <option value="sent_to_agency">Enviado</option>
                  <option value="agency_received">Recibido</option>
                  <option value="agency_accepted">Aceptado</option>
                  <option value="picked_up">Retirado</option>
                  <option value="on_the_way">En camino</option>
                  <option value="delivered">Entregado</option>
                  <option value="issue_reported">Novedad</option>
                </select>
              </label>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {billingStats.byStore.map((store) => (
              <article key={store.storeId} className="rounded-[28px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black">{store.storeName}</h3>
                    <p className="mt-1 text-sm font-bold text-[#746f69]">
                      {store.orders} servicios · {store.delivered} entregados · {store.pending} pendientes
                    </p>
                  </div>
                  <p className="text-xl font-black">
                    {billingSymbol}{store.total.toFixed(2)}
                  </p>
                </div>
              </article>
            ))}
            {!billingStats.byStore.length ? (
              <div className="rounded-[28px] bg-white p-5 text-sm font-black text-[#746f69]">
                Aun no hay servicios facturables esta semana.
              </div>
            ) : null}
          </div>

          <div className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
            <h3 className="text-lg font-black">Servicios filtrados</h3>
            <div className="mt-3 grid gap-2">
              {billingStats.filteredOrders.slice(0, 30).map((order) => (
                <div key={order.id} className="flex flex-col justify-between gap-2 rounded-2xl bg-[#F8F3E8] p-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-black">{order.orders?.public_code || "Pedido"}</p>
                    <p className="text-xs font-bold text-[#746f69]">
                      {order.stores?.name || "Comercio"} · {order.status}
                    </p>
                  </div>
                  <p className="text-sm font-black">
                    {billingSymbol}{Number(order.delivery_fee_usd ?? order.orders?.delivery_usd ?? 0).toFixed(2)}
                  </p>
                </div>
              ))}
              {!billingStats.filteredOrders.length ? (
                <p className="text-sm font-black text-[#746f69]">
                  No hay servicios con esos filtros.
                </p>
              ) : null}
            </div>
          </div>
        </section>
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
