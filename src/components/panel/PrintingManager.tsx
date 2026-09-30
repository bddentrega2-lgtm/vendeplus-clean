"use client";

import { Bluetooth, Check, Link2, Loader2, Printer, RefreshCw, Save, Smartphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getPanelAuthHeaders } from "@/lib/panel/client-auth";
import { usePanelAuth } from "@/components/panel/PanelAuthProvider";

type NativePrinter = { name: string; address: string; type: number };
type NativePlugin = {
  getStatus: () => Promise<{ supported: boolean; enabled: boolean; permission: boolean; paired: boolean; printerAddress: string; printerName: string }>;
  requestPermissions: () => Promise<{ granted: boolean }>;
  getPairedPrinters: () => Promise<{ printers: NativePrinter[] }>;
  selectPrinter: (input: { address: string; name: string }) => Promise<{ saved: boolean }>;
  savePairingToken: (input: { token: string }) => Promise<{ saved: boolean }>;
  clearPairing: () => Promise<{ cleared: boolean }>;
  printTest: (input: { address: string }) => Promise<{ sent: boolean }>;
  processQueue: () => Promise<{ processed: number; claimed?: number }>;
  setAutoPrint: (input: { enabled: boolean }) => Promise<{ enabled: boolean }>;
  registerPush: () => Promise<{ registered: boolean }>;
};

type PrintSettings = { is_enabled: boolean; trigger_mode: string; paper_width_mm: number; copies: number; include_prices: boolean };
type PrintDevice = { id: string; name: string; platform: string; app_version?: string | null; last_seen_at?: string | null; created_at: string };

function nativePlugin(): NativePlugin | null {
  if (typeof window === "undefined") return null;
  const capacitor = (window as typeof window & { Capacitor?: { Plugins?: { SomosPrinter?: NativePlugin } } }).Capacitor;
  return capacitor?.Plugins?.SomosPrinter || null;
}

async function responseJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo completar la accion.");
  return data;
}

export function PrintingManager() {
  const { selectedStoreId } = usePanelAuth();
  const [settings, setSettings] = useState<PrintSettings>({ is_enabled: false, trigger_mode: "received", paper_width_mm: 58, copies: 1, include_prices: false });
  const [devices, setDevices] = useState<PrintDevice[]>([]);
  const [printers, setPrinters] = useState<NativePrinter[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [isNative, setIsNative] = useState(false);
  const [nativePaired, setNativePaired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const headers = useCallback(async (json = false) => ({ ...(await getPanelAuthHeaders()), ...(json ? { "Content-Type": "application/json" } : {}) }), []);

  const loadNative = useCallback(async () => {
    const plugin = nativePlugin();
    setIsNative(Boolean(plugin));
    if (!plugin) return;
    let status = await plugin.getStatus();
    if (!status.permission) {
      const permission = await plugin.requestPermissions();
      if (!permission.granted) throw new Error("Autoriza dispositivos cercanos para usar la impresora.");
      status = await plugin.getStatus();
    }
    setNativePaired(status.paired);
    setSelectedAddress(status.printerAddress || "");
    if (status.paired) void plugin.registerPush().catch(() => undefined);
    if (status.enabled) setPrinters((await plugin.getPairedPrinters()).printers || []);
  }, []);

  const load = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    setError("");
    try {
      const requestHeaders = await headers();
      const [settingsResponse, devicesResponse] = await Promise.all([
        fetch("/api/panel/printing/settings", { headers: requestHeaders, cache: "no-store" }),
        fetch("/api/panel/printing/devices", { headers: requestHeaders, cache: "no-store" }),
      ]);
      const settingsData = await responseJson(settingsResponse);
      const devicesData = await responseJson(devicesResponse);
      setSettings(settingsData.settings);
      setDevices(devicesData.devices || []);
      await loadNative();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar impresion.");
    } finally {
      setLoading(false);
    }
  }, [headers, loadNative, selectedStoreId]);

  useEffect(() => { void load(); }, [load]);

  const selectedPrinter = useMemo(() => printers.find((printer) => printer.address === selectedAddress), [printers, selectedAddress]);

  const pairThisPhone = async () => {
    const plugin = nativePlugin();
    if (!plugin) return;
    setBusy("pair"); setError(""); setNotice("");
    try {
      const codeData = await responseJson(await fetch("/api/panel/printing/devices", { method: "POST", headers: await headers(true), body: "{}" }));
      const pairData = await responseJson(await fetch("/api/printing-agent/pair", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeData.code, deviceName: "Somos Android", platform: "android", appVersion: "0.1.0" }),
      }));
      await plugin.savePairingToken({ token: pairData.token });
      void plugin.registerPush().catch(() => undefined);
      setNativePaired(true);
      setNotice("Este telefono quedo vinculado al comercio.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo vincular el telefono."); }
    finally { setBusy(""); }
  };

  const choosePrinter = async (address: string) => {
    const printer = printers.find((item) => item.address === address);
    if (!printer || !nativePlugin()) return;
    setBusy("printer"); setError("");
    try {
      await nativePlugin()!.selectPrinter({ address, name: printer.name });
      setSelectedAddress(address);
      setNotice(`${printer.name} guardada en este telefono.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar la impresora."); }
    finally { setBusy(""); }
  };

  const refreshPrinters = async () => {
    setBusy("refresh"); setError(""); setNotice("");
    try {
      await loadNative();
      setNotice("Lista de impresoras actualizada.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudieron actualizar las impresoras."); }
    finally { setBusy(""); }
  };

  const testPrinter = async () => {
    if (!selectedAddress || !nativePlugin()) return;
    setBusy("test"); setError(""); setNotice("");
    try {
      await nativePlugin()!.printTest({ address: selectedAddress });
      setNotice("Ticket enviado. Confirma que haya salido en la impresora.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo imprimir."); }
    finally { setBusy(""); }
  };

  const processQueue = async () => {
    if (!nativePlugin()) return;
    setBusy("queue"); setError(""); setNotice("");
    try {
      const result = await nativePlugin()!.processQueue();
      setNotice(result.processed > 0 ? `${result.processed} comanda(s) impresa(s).` : "No hay comandas pendientes.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo consultar la cola."); }
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
      if (nativePlugin()) await nativePlugin()!.setAutoPrint({ enabled: data.settings.is_enabled === true });
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
        <div className="flex items-start gap-3"><Smartphone className="mt-0.5 text-[#0F5A5E]" /><div><h2 className="text-lg font-black">App Somos</h2><p className="text-sm font-semibold text-[#746f69]">Vincula el telefono que permanecera junto a la impresora.</p></div></div>
        {!isNative ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">Abre esta pantalla desde la app Android de Somos.</p> : (
          <button onClick={pairThisPhone} disabled={busy !== "" || nativePaired} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#0F5A5E] px-4 text-sm font-black text-white disabled:opacity-50">
            {nativePaired ? <Check size={18} /> : busy === "pair" ? <Loader2 size={18} className="animate-spin" /> : <Link2 size={18} />}{nativePaired ? "Telefono vinculado" : "Vincular este telefono"}
          </button>
        )}
        {devices.length ? <div className="mt-4 space-y-2">{devices.map((device) => <div key={device.id} className="flex items-center justify-between border-t border-[#25262B]/10 pt-3 text-sm"><span className="font-bold">{device.name}</span><span className="text-[#746f69]">{device.platform === "android" ? "Android" : "Windows"}</span></div>)}</div> : null}
      </section>

      <section className="border-y border-[#25262B]/10 bg-white px-4 py-5 sm:rounded-lg sm:border">
        <div className="flex items-start gap-3"><Bluetooth className="mt-0.5 text-[#FF6B35]" /><div><h2 className="text-lg font-black">Impresora Bluetooth</h2><p className="text-sm font-semibold text-[#746f69]">Debe estar encendida y emparejada desde Android.</p></div></div>
        <div className="mt-4 flex gap-2">
          <select value={selectedAddress} onChange={(event) => void choosePrinter(event.target.value)} disabled={!isNative || busy !== ""} className="min-h-11 flex-1 rounded-lg border border-[#25262B]/20 bg-white px-3 text-sm font-bold">
            <option value="">Elige una impresora</option>{printers.map((printer) => <option key={printer.address} value={printer.address}>{printer.name}</option>)}
          </select>
          <button title="Actualizar impresoras" onClick={() => void refreshPrinters()} disabled={busy !== ""} className="grid h-11 w-11 place-items-center rounded-lg border border-[#25262B]/20 disabled:opacity-50"><RefreshCw size={18} className={busy === "refresh" ? "animate-spin" : ""} /></button>
        </div>
        <button onClick={testPrinter} disabled={!selectedPrinter || busy !== ""} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#FFB547] px-4 text-sm font-black text-[#25262B] disabled:opacity-50"><Printer size={18} />{busy === "test" ? "Enviando..." : "Imprimir prueba"}</button>
      </section>

      <section className="border-y border-[#25262B]/10 bg-white px-4 py-5 sm:rounded-lg sm:border">
        <h2 className="text-lg font-black">Comandas</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Ancho del papel<select value={settings.paper_width_mm} onChange={(event) => setSettings((value) => ({ ...value, paper_width_mm: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded-lg border border-[#25262B]/20 px-3"><option value={58}>58 mm</option><option value={80}>80 mm</option></select></label>
          <label className="text-sm font-bold">Copias<select value={settings.copies} onChange={(event) => setSettings((value) => ({ ...value, copies: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded-lg border border-[#25262B]/20 px-3"><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={settings.include_prices} onChange={(event) => setSettings((value) => ({ ...value, include_prices: event.target.checked }))} className="h-5 w-5 accent-[#0F5A5E]" />Mostrar precios en la comanda</label>
        <label className="mt-4 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={settings.is_enabled} onChange={(event) => setSettings((value) => ({ ...value, is_enabled: event.target.checked }))} className="h-5 w-5 accent-[#0F5A5E]" />Imprimir pedidos automaticamente al recibirlos</label>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={saveSettings} disabled={busy !== ""} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#0F5A5E] px-5 text-sm font-black text-white disabled:opacity-50">{busy === "save" ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}Guardar</button>
          {isNative && nativePaired ? <button onClick={processQueue} disabled={busy !== "" || !selectedAddress} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#0F5A5E] px-4 text-sm font-black text-[#0F5A5E] disabled:opacity-50">{busy === "queue" ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}Imprimir pendientes</button> : null}
        </div>
      </section>
    </div>
  );
}
