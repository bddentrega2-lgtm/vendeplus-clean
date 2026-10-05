export type NativePrinter = { name: string; address: string; type: number };

export type NativePrinterPlugin = {
  getStatus: () => Promise<{ supported: boolean; enabled: boolean; permission: boolean; paired: boolean; activeStoreId?: string; deviceId?: string; legacyPairing?: boolean; printerAddress: string; printerName: string }>;
  setActiveStore?: (input: { storeId: string }) => Promise<{ activeStoreId: string; paired: boolean; deviceId: string }>;
  requestPermissions: () => Promise<{ granted: boolean }>;
  getPairedPrinters: () => Promise<{ printers: NativePrinter[] }>;
  selectPrinter: (input: { address: string; name: string }) => Promise<{ saved: boolean }>;
  savePairingToken: (input: { token: string; storeId: string; deviceId: string }) => Promise<{ saved: boolean }>;
  clearPairing: () => Promise<{ cleared: boolean }>;
  printTest: (input: { address: string }) => Promise<{ sent: boolean }>;
  processQueue: () => Promise<{ processed: number; claimed?: number }>;
  setAutoPrint: (input: { enabled: boolean }) => Promise<{ enabled: boolean }>;
  registerPush: () => Promise<{ registered: boolean }>;
};

export function getNativePrinter(): NativePrinterPlugin | null {
  if (typeof window === "undefined") return null;
  return (window as typeof window & { Capacitor?: { Plugins?: { SomosPrinter?: NativePrinterPlugin } } }).Capacitor?.Plugins?.SomosPrinter || null;
}
