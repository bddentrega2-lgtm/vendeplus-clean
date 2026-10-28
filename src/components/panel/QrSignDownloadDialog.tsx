"use client";

import { Download, Loader2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  parseQrSignTableNumber,
  qrSignFilename,
  renderQrSign,
  type QrSignPlace,
} from "@/lib/qr-sign-renderer";

export function QrSignDownloadDialog({
  qrDataUrl,
  logoUrl,
  storeName,
  storeSlug,
  onClose,
}: {
  qrDataUrl: string;
  logoUrl: string;
  storeName: string;
  storeSlug: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderVersion = useRef(0);
  const titleId = useId();
  const [type, setType] = useState<"mesa" | "barra">("mesa");
  const [tableNumber, setTableNumber] = useState("1");
  const [isRendering, setIsRendering] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");

  const parsedTableNumber = parseQrSignTableNumber(tableNumber);
  const place = useMemo<QrSignPlace | null>(() => {
    if (type === "barra") return { type: "barra" };
    return parsedTableNumber ? { type: "mesa", tableNumber: parsedTableNumber } : null;
  }, [parsedTableNumber, type]);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    const version = ++renderVersion.current;
    if (!place || !canvasRef.current) {
      setIsRendering(false);
      setError(type === "mesa" ? "Indica un número de mesa entre 1 y 999." : "");
      return;
    }
    setIsRendering(true);
    setError("");
    void renderQrSign(canvasRef.current, { logoUrl, qrDataUrl, place })
      .catch((reason) => {
        if (version === renderVersion.current) {
          setError(reason instanceof Error ? reason.message : "No se pudo preparar el hablador.");
        }
      })
      .finally(() => {
        if (version === renderVersion.current) setIsRendering(false);
      });
  }, [logoUrl, place, qrDataUrl, type]);

  async function download() {
    if (!canvasRef.current || !place || isDownloading) return;
    setIsDownloading(true);
    setError("");
    try {
      await renderQrSign(canvasRef.current, { logoUrl, qrDataUrl, place });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvasRef.current?.toBlob((value) => value ? resolve(value) : reject(new Error("No se pudo crear el archivo PNG.")), "image/png");
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = qrSignFilename(storeSlug, place);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo descargar el hablador.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto rounded-lg bg-white p-4 text-[#25262B] shadow-2xl backdrop:bg-black/60 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-black">Descargar hablador</h2>
          <p className="truncate text-sm font-bold text-[#746f69]">{storeName}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F8F3E8]">
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(250px,360px)]">
        <div>
          <p className="text-sm font-black">Tipo</p>
          <div className="mt-2 grid grid-cols-2 rounded-lg bg-[#F8F3E8] p-1" role="group" aria-label="Tipo de hablador">
            <button type="button" onClick={() => setType("mesa")} aria-pressed={type === "mesa"}
              className={`min-h-11 rounded-md px-3 text-sm font-black ${type === "mesa" ? "bg-[#073D40] text-white shadow-sm" : "text-[#25262B]"}`}>
              Mesa
            </button>
            <button type="button" onClick={() => setType("barra")} aria-pressed={type === "barra"}
              className={`min-h-11 rounded-md px-3 text-sm font-black ${type === "barra" ? "bg-[#073D40] text-white shadow-sm" : "text-[#25262B]"}`}>
              Barra
            </button>
          </div>

          {type === "mesa" ? (
            <label className="mt-4 block text-sm font-black">
              Número de mesa
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="vp-input mt-2 w-full"
                value={tableNumber}
                maxLength={3}
                onChange={(event) => setTableNumber(event.target.value)}
                aria-invalid={parsedTableNumber === null}
              />
            </label>
          ) : null}

          {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="vp-button-soft justify-center" onClick={onClose}>Cancelar</button>
            <button type="button" className="vp-button-primary justify-center disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!place || isRendering || isDownloading || Boolean(error)} onClick={() => void download()}>
              {isDownloading ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
              {isDownloading ? "Preparando..." : "Descargar PNG"}
            </button>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[320px] overflow-hidden rounded-md bg-[#FFFCF4] shadow-md ring-1 ring-[#25262B]/10" style={{ aspectRatio: "2 / 3" }}>
          <canvas ref={canvasRef} aria-label="Vista previa del hablador" className="h-full w-full" />
          {isRendering ? <div role="status" className="absolute inset-0 grid place-items-center bg-[#FFFCF4]/85">
            <Loader2 className="animate-spin text-[#073D40]" size={28} />
          </div> : null}
        </div>
      </div>
    </dialog>
  );
}
