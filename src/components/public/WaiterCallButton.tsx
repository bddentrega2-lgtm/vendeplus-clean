"use client";

import { BellRing, Loader2 } from "lucide-react";
import { useState } from "react";
import { normalizeTableAssistanceLabel, TABLE_ASSISTANCE_LABELS, type TableOrderContext } from "@/lib/table-orders";

export function WaiterCallButton({ context }: { context: Pick<TableOrderContext, "storeToken" | "tableId" | "fulfillmentMode" | "waiterCallsEnabled" | "waiterCallLabel"> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!context.waiterCallsEnabled || context.fulfillmentMode !== "table_service" || !context.tableId) return null;
  async function call() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/table-orders/waiter", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: context.storeToken, tableId: context.tableId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo pedir asistencia.");
      setMessage("Solicitud enviada. El personal recibió tu aviso.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Intenta nuevamente."); }
    finally { setBusy(false); }
  }
  return <div className="mt-3">
    <button type="button" onClick={() => void call()} disabled={busy} className="vp-button-soft max-w-full whitespace-normal [overflow-wrap:anywhere]">
      {busy ? <Loader2 size={17} className="shrink-0 animate-spin" /> : <BellRing size={17} className="shrink-0" />}
      {normalizeTableAssistanceLabel(context.waiterCallLabel) || TABLE_ASSISTANCE_LABELS[0]}
    </button>
    {message ? <p role="status" className="mt-2 text-xs font-bold">{message}</p> : null}
  </div>;
}
