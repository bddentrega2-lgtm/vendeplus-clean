"use client";

import {
  AlertTriangle,
  Bluetooth,
  Check,
  CheckCircle2,
  Clock3,
  Link2,
  Loader2,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Smartphone,
  Unlink2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getPanelAuthHeaders } from "@/lib/panel/client-auth";
import { usePanelAuth } from "@/components/panel/PanelAuthProvider";
import { getNativePrinter, type NativePrinter } from "@/lib/mobile/printer-plugin";


type PrintSettings = { is_enabled: boolean; trigger_mode: string; paper_width_mm: number; copies: number; include_prices: boolean };
type PrintDevice = {
  id: string;
  name: string;
  platform: string;
  app_version?: string | null;
  last_seen_at?: string | null;
  created_at: string;
  push_ready: boolean;
};
type PrintJob = {
  id: string;
  order_id: string;
  order_code: string;
  event_type: "received" | "paid" | "manual";
  status: "pending" | "processing" | "printed" | "failed";
  attempts: number;
  can_retry: boolean;
  error_message?: string | null;
  printed_at?: string | null;
  created_at: string;
  updated_at: string;
};
type PrintSummary = { pending: number; failed: number; last_printed_at?: string | null };

async function responseJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo completar la accion.");
  return data;
}

function friendlyNativeError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (/read failed|socket|bluetooth/i.test(message)) return "La impresora no respondio. Revisa que este encendida y cerca del telefono.";
  if (/permission|permiso/i.test(message)) return "Autoriza dispositivos cercanos para usar la impresora.";
  return fallback;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin actividad";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin actividad";
  return new Intl.DateTimeFormat("es-VE", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

function deviceState(lastSeen?: string | null) {
  if (!lastSeen) return { label: "Sin actividad", active: false };
  const elapsed = Date.now() - new Date(lastSeen).getTime();
  if (elapsed <= 2 * 60_000) return { label: "Activo ahora", active: true };
  return { label: `Ultima conexion: ${formatDate(lastSeen)}`, active: false };
}

const eventLabels = { received: "Pedido recibido", paid: "Pago verificado", manual: "Impresion manual" } as const;
const statusLabels = { pending: "Pendiente", processing: "Imprimiendo", printed: "Impresa", failed: "Error" } as const;

export function PrintingManager() {
  const { selectedStoreId, selectedStore, isFounderMode } = usePanelAuth();
  const [settings, setSettings] = useState<PrintSettings>({ is_enabled: false, trigger_mode: "received", paper_width_mm: 58, copies: 1, include_prices: false });
  const [devices, setDevices] = useState<PrintDevice[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [summary, setSummary] = useState<PrintSummary>({ pending: 0, failed: 0, last_printed_at: null });
  const [printers, setPrinters] = useState<NativePrinter[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [isNative, setIsNative] = useState(false);
  const [nativePaired, setNativePaired] = useState(false);
  const [nativeDeviceId, setNativeDeviceId] = useState("");
  const [legacyPairing, setLegacyPairing] = useState(false);
  const [supportsStorePairing, setSupportsStorePairing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const headers = useCallback(async (json = false) => ({ ...(await getPanelAuthHeaders()), ...(json ? { "Content-Type": "application/json" } : {}) }), []);

  const loadNative = useCallback(async () => {
    const plugin = getNativePrinter();
    setIsNative(Boolean(plugin));
    if (!plugin) return;
    setSupportsStorePairing(Boolean(plugin.setActiveStore));
    if (!plugin.setActiveStore || isFounderMode || !selectedStoreId) {
      setNativePaired(false);
      setNativeDeviceId("");
      return;
    }
    await plugin.setActiveStore({ storeId: selectedStoreId });
    let status = await plugin.getStatus();
    setLegacyPairing(Boolean(status.legacyPairing));
    if (!status.permission) {
      const permission = await plugin.requestPermissions();
      if (!permission.granted) throw new Error("Autoriza dispositivos cercanos para usar la impresora.");
      status = await plugin.getStatus();
    }
    setNativePaired(status.paired && status.activeStoreId === selectedStoreId);
    setNativeDeviceId(status.deviceId || "");
    setSelectedAddress(status.printerAddress || "");
    if (status.paired && status.activeStoreId === selectedStoreId) void plugin.registerPush().catch(() => undefined);
    if (status.enabled) setPrinters((await plugin.getPairedPrinters()).printers || []);
  }, [isFounderMode, selectedStoreId]);

  const load = useCallback(async (silent = false) => {
    if (!selectedStoreId) return;
    if (!silent) setLoading(true);
    setError("");
    try {
      const requestHeaders = await headers();
      const [settingsResponse, statusResponse] = await Promise.all([
        fetch("/api/panel/printing/settings", { headers: requestHeaders, cache: "no-store" }),
        fetch("/api/panel/printing/status", { headers: requestHeaders, cache: "no-store" }),
      ]);
      const settingsData = await responseJson(settingsResponse);
      const statusData = await responseJson(statusResponse);
      setSettings(settingsData.settings);
      setDevices(statusData.devices || []);
      setJobs(statusData.jobs || []);
      setSummary(statusData.summary || { pending: 0, failed: 0, last_printed_at: null });
      if (!silent) await loadNative();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar impresion.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [headers, loadNative, selectedStoreId]);

  useEffect(() => { void load(); }, [load]);

  const selectedPrinter = useMemo(() => printers.find((printer) => printer.address === selectedAddress), [printers, selectedAddress]);
  const pairedHere = nativePaired && devices.some((device) => device.id === nativeDeviceId);
  const printOnReceived = settings.is_enabled && ["received", "both"].includes(settings.trigger_mode);
  const printOnVerifiedPayment = settings.is_enabled && ["paid", "both"].includes(settings.trigger_mode);

  const updatePrintTrigger = (trigger: "received" | "paid", checked: boolean) => {
    const received = trigger === "received" ? checked : printOnReceived;
    const paid = trigger === "paid" ? checked : printOnVerifiedPayment;
    setSettings((value) => ({
      ...value,
      is_enabled: received || paid,
      trigger_mode: received && paid ? "both" : paid ? "paid" : "received",
    }));
  };

  const refreshStatus = async () => {
    setBusy("status"); setNotice("");
    await load(true);
    setBusy("");
  };

  const pairThisPhone = async () => {
    const plugin = getNativePrinter();
    if (!plugin?.setActiveStore || !selectedStoreId || isFounderMode) return;
    setBusy("pair"); setError(""); setNotice("");
    try {
      if (!window.confirm(`Vincular este telefono para imprimir los pedidos de ${selectedStore?.name || "este comercio"}?`)) return;
      await plugin.setActiveStore({ storeId: selectedStoreId });
      const codeData = await responseJson(await fetch("/api/panel/printing/devices", { method: "POST", headers: await headers(true), body: "{}" }));
      const pairData = await responseJson(await fetch("/api/printing-agent/pair", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeData.code, deviceName: "Somos Android", platform: "android", appVersion: "0.1.0" }),
      }));
      if (pairData.device?.store_id !== selectedStoreId || !pairData.device?.id) throw new Error("La vinculacion no corresponde al comercio activo.");
      await plugin.savePairingToken({ token: pairData.token, storeId: selectedStoreId, deviceId: pairData.device.id });
      void plugin.registerPush().catch(() => undefined);
      if (settings.is_enabled && selectedAddress) void plugin.setAutoPrint({ enabled: true }).catch(() => undefined);
      setNativePaired(true);
      setNativeDeviceId(pairData.device.id);
      setNotice("Este telefono quedo vinculado al comercio.");
      await load(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo vincular el telefono."); }
    finally { setBusy(""); }
  };

  const unpairThisPhone = async () => {
    const plugin = getNativePrinter();
    if (!plugin?.setActiveStore || !pairedHere || !selectedStoreId || !nativeDeviceId || isFounderMode) return;
    if (!window.confirm(`Desvincular este telefono de ${selectedStore?.name || "este comercio"}? Dejara de imprimir sus comandas. Los otros comercios no cambiaran.`)) return;
    setBusy("unpair"); setError(""); setNotice("");
    try {
      const status = await plugin.getStatus();
      if (status.activeStoreId !== selectedStoreId || status.deviceId !== nativeDeviceId) throw new Error("El comercio activo cambio. Actualiza e intenta de nuevo.");
      await responseJson(await fetch("/api/panel/printing/devices", {
        method: "DELETE", headers: await headers(true), body: JSON.stringify({ deviceId: nativeDeviceId }),
      }));
      await plugin.clearPairing();
      setNativePaired(false);
      setNativeDeviceId("");
      setNotice(`Este telefono ya no esta vinculado a ${selectedStore?.name || "este comercio"}.`);
      await load(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo desvincular el telefono."); }
    finally { setBusy(""); }
  };

  const choosePrinter = async (address: string) => {
    const printer = printers.find((item) => item.address === address);
    if (!printer || !getNativePrinter()) return;
    setBusy("printer"); setError("");
    try {
      await getNativePrinter()!.selectPrinter({ address, name: printer.name });
      setSelectedAddress(address);
      if (pairedHere && settings.is_enabled) await getNativePrinter()!.setAutoPrint({ enabled: true });
      setNotice(`${printer.name} guardada en este telefono.`);
    } catch (caught) { setError(friendlyNativeError(caught, "No se pudo guardar la impresora.")); }
    finally { setBusy(""); }
  };

  const refreshPrinters = async () => {
    setBusy("refresh"); setError(""); setNotice("");
    try {
      await loadNative();
      setNotice("Lista de impresoras actualizada.");
    } catch (caught) { setError(friendlyNativeError(caught, "No se pudieron actualizar las impresoras.")); }
    finally { setBusy(""); }
  };

  const testPrinter = async () => {
    if (!selectedAddress || !getNativePrinter()) return;
    setBusy("test"); setError(""); setNotice("");
    try {
      await getNativePrinter()!.printTest({ address: selectedAddress });
      setNotice("Ticket enviado. Confirma que haya salido en la impresora.");
    } catch (caught) { setError(friendlyNativeError(caught, "No se pudo imprimir.")); }
    finally { setBusy(""); }
  };

  const processQueue = async () => {
    if (!getNativePrinter() || !pairedHere) return;
    setBusy("queue"); setError(""); setNotice("");
    try {
      const result = await getNativePrinter()!.processQueue();
      setNotice(result.processed > 0 ? `${result.processed} comanda(s) impresa(s).` : "No hay comandas pendientes.");
      await load(true);
    } catch (caught) { setError(friendlyNativeError(caught, "No se pudo consultar la cola.")); }
    finally { setBusy(""); }
  };

  const retryJob = async (job: PrintJob) => {
    if (!window.confirm(`¿Reimprimir ${job.order_code}? Confirma que la comanda anterior no haya salido.`)) return;
    setBusy(`retry-${job.id}`); setError(""); setNotice("");
    try {
      await responseJson(await fetch("/api/panel/printing/status", {
        method: "PATCH",
        headers: await headers(true),
        body: JSON.stringify({ jobId: job.id }),
      }));
      setNotice("Comanda enviada nuevamente a la impresora.");
      await load(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo reintentar la impresion."); }
    finally { setBusy(""); }
  };

  const saveSettings = async () => {
    setBusy("save"); setError(""); setNotice("");
    try {
      const data = await responseJson(await fetch("/api/panel/printing/settings", {
        method: "PUT", headers: await headers(true),
        body: JSON.stringify({ isEnabled: settings.is_enabled, triggerMode: settings.trigger_mode, paperWidthMm: settings.paper_width_mm, copies: settings.copies, includePrices: settings.include_prices }),
      }));
      setSettings(data.settings);
      if (getNativePrinter() && pairedHere) await getNativePrinter()!.setAutoPrint({ enabled: data.settings.is_enabled === true });
      setNotice("Configuracion de impresion guardada.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar."); }
    finally { setBusy(""); }
  };

  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-[#0F5A5E]" /></div>;

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{notice}</p> : null}

      <section className="border-y border-[#25262B]/10 bg-white px-4 py-5 sm:rounded-lg sm:border">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-black">Estado de impresion</h2><p className="text-sm font-semibold text-[#746f69]">Controla la cola y detecta problemas antes de perder una comanda.</p></div>
          <button title="Actualizar estado" onClick={() => void refreshStatus()} disabled={busy !== ""} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#25262B]/20 disabled:opacity-50"><RefreshCw size={18} className={busy === "status" ? "animate-spin" : ""} /></button>
        </div>
        <div className="mt-4 grid grid-cols-3 divide-x divide-[#25262B]/10 border-y border-[#25262B]/10 py-3 text-center">
          <div className="px-2"><p className="text-xl font-black text-[#0F5A5E]">{devices.length}</p><p className="text-xs font-bold text-[#746f69]">Equipos</p></div>
          <div className="px-2"><p className="text-xl font-black text-[#B76A00]">{summary.pending}</p><p className="text-xs font-bold text-[#746f69]">Pendientes</p></div>
          <div className="px-2"><p className={`text-xl font-black ${summary.failed ? "text-red-700" : "text-[#25262B]"}`}>{summary.failed}</p><p className="text-xs font-bold text-[#746f69]">Errores recientes</p></div>
        </div>
        <p className="mt-3 text-xs font-semibold text-[#746f69]">Ultima impresion: {formatDate(summary.last_printed_at)}</p>
      </section>

      <section className="border-y border-[#25262B]/10 bg-white px-4 py-5 sm:rounded-lg sm:border">
        <div className="flex items-start gap-3"><Smartphone className="mt-0.5 text-[#0F5A5E]" /><div><h2 className="text-lg font-black">App Somos</h2><p className="text-sm font-semibold text-[#746f69]">Vincula el telefono que permanecera junto a la impresora.</p></div></div>
        {!isNative ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">Abre esta pantalla desde la app Android de Somos.</p> : isFounderMode ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">La impresion automatica esta pausada en admin.</p> : !supportsStorePairing ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">Actualiza la app para vincular la impresion por comercio.</p> : (
          <><div className="mt-4 flex flex-wrap gap-2"><button onClick={pairThisPhone} disabled={busy !== "" || pairedHere} className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg bg-[#0F5A5E] px-4 text-left text-sm font-black text-white disabled:opacity-50">
            {pairedHere ? <Check size={18} className="shrink-0" /> : busy === "pair" ? <Loader2 size={18} className="shrink-0 animate-spin" /> : <Link2 size={18} className="shrink-0" />}{pairedHere ? `Telefono vinculado a ${selectedStore?.name || "este comercio"}` : `Vincular este telefono a ${selectedStore?.name || "este comercio"}`}
          </button>{pairedHere ? <button onClick={unpairThisPhone} disabled={busy !== ""} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-bold text-red-700 disabled:opacity-50"><Unlink2 size={18} />Desvincular</button> : null}</div>{legacyPairing && !pairedHere ? <p className="mt-2 text-xs font-semibold text-amber-800">Confirma esta vinculacion para evitar imprimir pedidos de otro comercio.</p> : null}</>
        )}
        {devices.length ? <div className="mt-4 divide-y divide-[#25262B]/10 border-t border-[#25262B]/10">{devices.map((device) => {
          const state = deviceState(device.last_seen_at);
          return <div key={device.id} className="flex min-w-0 items-start justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="truncate font-bold">{device.name}</p><p className="text-xs font-semibold text-[#746f69]">{device.platform === "android" ? "Android" : "Windows"}{device.app_version ? ` · v${device.app_version}` : ""}</p></div><div className="shrink-0 text-right"><p className={`font-bold ${state.active ? "text-emerald-700" : "text-[#746f69]"}`}>{state.label}</p><p className={`text-xs font-semibold ${device.push_ready ? "text-[#0F5A5E]" : "text-amber-700"}`}>{device.push_ready ? "Avisos activos" : "Abre la app para activar avisos"}</p></div></div>;
        })}</div> : <p className="mt-4 text-sm font-semibold text-[#746f69]">Aun no hay telefonos vinculados.</p>}
      </section>

      <section className="border-y border-[#25262B]/10 bg-white px-4 py-5 sm:rounded-lg sm:border">
        <div className="flex items-start gap-3"><Bluetooth className="mt-0.5 text-[#FF6B35]" /><div><h2 className="text-lg font-black">Impresora Bluetooth</h2><p className="text-sm font-semibold text-[#746f69]">Debe estar encendida y emparejada desde Android.</p></div></div>
        <div className="mt-4 flex gap-2">
          <select value={selectedAddress} onChange={(event) => void choosePrinter(event.target.value)} disabled={!isNative || busy !== ""} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#25262B]/20 bg-white px-3 text-sm font-bold">
            <option value="">Elige una impresora</option>{printers.map((printer) => <option key={printer.address} value={printer.address}>{printer.name}</option>)}
          </select>
          <button title="Actualizar impresoras" onClick={() => void refreshPrinters()} disabled={busy !== ""} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#25262B]/20 disabled:opacity-50"><RefreshCw size={18} className={busy === "refresh" ? "animate-spin" : ""} /></button>
        </div>
        <button onClick={testPrinter} disabled={!selectedPrinter || busy !== ""} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#FFB547] px-4 text-sm font-black text-[#25262B] disabled:opacity-50"><Printer size={18} />{busy === "test" ? "Enviando..." : "Imprimir prueba"}</button>
      </section>

      <section className="border-y border-[#25262B]/10 bg-white px-4 py-5 sm:rounded-lg sm:border">
        <h2 className="text-lg font-black">Comandas recientes</h2>
        {jobs.length ? <div className="mt-3 divide-y divide-[#25262B]/10 border-t border-[#25262B]/10">{jobs.map((job) => (
          <div key={job.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate text-sm font-black">{job.order_code}</p><p className="text-xs font-semibold text-[#746f69]">{eventLabels[job.event_type]} · {formatDate(job.created_at)}</p></div>
              <div className={`inline-flex shrink-0 items-center gap-1 text-xs font-black ${job.status === "failed" ? "text-red-700" : job.status === "printed" ? "text-emerald-700" : "text-[#B76A00]"}`}>
                {job.status === "failed" ? <AlertTriangle size={15} /> : job.status === "printed" ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}{statusLabels[job.status]}
              </div>
            </div>
            {job.error_message ? <p className="mt-2 text-xs font-semibold text-red-700">{job.error_message}</p> : null}
            {job.status === "failed" && job.can_retry ? <button onClick={() => void retryJob(job)} disabled={busy !== ""} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-xs font-black text-red-700 disabled:opacity-50">{busy === `retry-${job.id}` ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}Reintentar</button> : null}
            {job.status === "failed" && !job.can_retry ? <p className="mt-2 text-xs font-semibold text-[#746f69]">Para una comanda antigua, usa Imprimir comanda desde el pedido.</p> : null}
          </div>
        ))}</div> : <p className="mt-3 text-sm font-semibold text-[#746f69]">Todavia no hay comandas en la cola.</p>}
      </section>

      <section className="border-y border-[#25262B]/10 bg-white px-4 py-5 sm:rounded-lg sm:border">
        <h2 className="text-lg font-black">Configuracion de comandas</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Ancho del papel<select value={settings.paper_width_mm} onChange={(event) => setSettings((value) => ({ ...value, paper_width_mm: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded-lg border border-[#25262B]/20 px-3"><option value={58}>58 mm</option><option value={80}>80 mm</option></select></label>
          <label className="text-sm font-bold">Copias<select value={settings.copies} onChange={(event) => setSettings((value) => ({ ...value, copies: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded-lg border border-[#25262B]/20 px-3"><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={settings.include_prices} onChange={(event) => setSettings((value) => ({ ...value, include_prices: event.target.checked }))} className="h-5 w-5 accent-[#0F5A5E]" />Mostrar precios en la comanda</label>
        <label className="mt-4 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={printOnReceived} onChange={(event) => updatePrintTrigger("received", event.target.checked)} className="h-5 w-5 accent-[#0F5A5E]" />Imprimir automaticamente al recibir el pedido</label>
        <label className="mt-4 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={printOnVerifiedPayment} onChange={(event) => updatePrintTrigger("paid", event.target.checked)} className="h-5 w-5 accent-[#0F5A5E]" />Imprimir al verificar el pago</label>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={saveSettings} disabled={busy !== ""} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#0F5A5E] px-5 text-sm font-black text-white disabled:opacity-50">{busy === "save" ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}Guardar</button>
          {isNative && pairedHere ? <button onClick={processQueue} disabled={busy !== "" || !selectedAddress} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#0F5A5E] px-4 text-sm font-black text-[#0F5A5E] disabled:opacity-50">{busy === "queue" ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}Imprimir pendientes</button> : null}
        </div>
      </section>
    </div>
  );
}
