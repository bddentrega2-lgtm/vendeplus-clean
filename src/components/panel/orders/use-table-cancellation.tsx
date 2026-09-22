"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TABLE_CANCELLATION_REASONS, tableCancellationReason } from "@/lib/table-orders";

type Cancellation = { cancellationReason: string; cancellationDetail: string };

export function useTableCancellation() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const resolveRef = useRef<((value: Cancellation | null) => void) | null>(null);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");

  useEffect(() => () => resolveRef.current?.(null), []);

  function finish(value: Cancellation | null) {
    resolveRef.current?.(value);
    resolveRef.current = null;
    dialogRef.current?.close();
  }

  const requestCancellation = useCallback(() => {
    resolveRef.current?.(null);
    setReason("");
    setDetail("");
    dialogRef.current?.showModal();
    return new Promise<Cancellation | null>((resolve) => { resolveRef.current = resolve; });
  }, []);

  const cancellationDialog = (
    <dialog ref={dialogRef} onCancel={() => finish(null)} aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-white p-5 shadow-xl backdrop:bg-black/50">
      <h2 id={titleId} className="text-lg font-black">Cancelar pedido</h2>
      <label className="mt-4 block text-sm font-bold">Motivo
        <select className="vp-input mt-2 w-full" value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="">Selecciona un motivo</option>
          {TABLE_CANCELLATION_REASONS.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      {reason === "Otro" ? <label className="mt-3 block text-sm font-bold">Detalle
        <textarea className="vp-input mt-2 w-full" value={detail} maxLength={300} onChange={(event) => setDetail(event.target.value)} />
      </label> : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" className="vp-button-soft" onClick={() => finish(null)}>Volver</button>
        <button type="button" className="vp-button-primary" disabled={!tableCancellationReason(reason, detail)}
          onClick={() => finish({ cancellationReason: reason, cancellationDetail: detail })}>Confirmar cancelación</button>
      </div>
    </dialog>
  );
  return { requestCancellation, cancellationDialog };
}
